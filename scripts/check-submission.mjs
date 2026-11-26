// 올라온 작품 자동 검사.
//   node scripts/check-submission.mjs            검사하고 문제가 있으면 종료 코드 1 (PR 검사용)
//   node scripts/check-submission.mjs --write    결과를 data/checks.json 에 기록 (main 검사용)
//   --all                                        7일 안에 검사한 작품도 다시 검사
// 환경변수(없으면 해당 검사는 "건너뜀"으로 기록한다. 포크 PR 에는 비밀값이 전달되지 않는다)
//   GSB_API_KEY   Google Safe Browsing API 키
//   VT_API_KEY    VirusTotal API 키
//   GITHUB_TOKEN  GitHub API 호출 한도를 늘리는 용도
// 이 검사는 위험 신호를 걸러 낼 뿐 안전을 보장하지 않는다. 화면에도 그렇게 적는다.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeManifest, checkResponse, checkUrl, redactSecrets, sanitizeLog, scanSource, summarize } from '../lib/checks.mjs';
import { safeHead, timedText } from '../lib/safe-fetch.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVICES = join(ROOT, 'data', 'services.json');
const CHECKS = join(ROOT, 'data', 'checks.json');
const args = new Set(process.argv.slice(2));
const TODAY = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // 한국 날짜
const STALE_DAYS = 7;
const MAX_SOURCE_FILES = 30;
const MAX_SOURCE_BYTES = 150_000;

// 검사한 주소 묶음. 작품 주소나 링크가 하나라도 바뀌면 7일이 안 지났어도 다시 검사한다(검사 후 바꿔치기 방지)
const checkKey = (s) => [s.url ?? '', ...(s.links ?? []).map((l) => l.url)].join('|');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const daysBetween = (a, b) => Math.floor((Date.parse(b) - Date.parse(a)) / 86_400_000);

// 고정된 신뢰 호스트(GitHub·Google·VirusTotal) 호출. 시간·크기 제한은 lib/safe-fetch.mjs
const timed = timedText;

// 오류 문장에서 비밀 값을 가리고 한 줄로 만든다(로그·checks.json 에 들어가므로)
const SECRET_ENV = ['GSB_API_KEY', 'VT_API_KEY', 'GITHUB_TOKEN'];
const errText = (error) => sanitizeLog(redactSecrets(error instanceof Error ? error.message : error, SECRET_ENV.map((k) => process.env[k])));

// ── 접속 확인 ──
async function checkReachable(url, label) {
  try {
    // 리다이렉트는 직접 따라가며 매번 내부 주소·형식을 검사한다(SSRF 방어)
    const res = await safeHead(url);
    const fails = checkResponse(
      { status: res.status, contentType: String(res.headers['content-type'] ?? ''), disposition: String(res.headers['content-disposition'] ?? '') },
      label,
    );
    return { fails, notes: fails.length ? [] : [`${label} 접속 확인(HTTP ${res.status})`] };
  } catch (error) {
    return { fails: [`${label}: 접속하지 못했습니다(${errText(error)})`], notes: [] };
  }
}

// ── Google Safe Browsing ──
async function safeBrowsing(urls) {
  const key = process.env.GSB_API_KEY;
  if (!key) return { fails: [], notes: ['Google Safe Browsing 검사는 건너뜀(키 없음)'] };
  try {
    const res = await timed('https://safebrowsing.googleapis.com/v4/threatMatches:find', {
      method: 'POST',
      // 키를 주소에 넣으면 오류·로그에 남기 쉬우므로 헤더로 보낸다
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        client: { clientId: 'juganlab-check', clientVersion: '1.0' },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: urls.map((url) => ({ url })),
        },
      }),
    });
    if (!res.ok) return { fails: [], notes: [`Google Safe Browsing 검사는 건너뜀(응답 ${res.status})`] };
    const data = await res.json();
    if (data.matches?.length) {
      const kinds = [...new Set(data.matches.map((m) => m.threatType))].join(', ');
      return { fails: [`Google Safe Browsing 이 위험 주소로 표시했습니다(${kinds})`], notes: [] };
    }
    return { fails: [], notes: ['Google Safe Browsing 위험 표시 없음'] };
  } catch (error) {
    return { fails: [], notes: [`Google Safe Browsing 검사는 건너뜀(${errText(error)})`] };
  }
}

// ── VirusTotal (무료 키는 분당 4회) ──
async function virusTotal(url) {
  const key = process.env.VT_API_KEY;
  if (!key) return { fails: [], warns: [], notes: ['VirusTotal 검사는 건너뜀(키 없음)'] };
  try {
    const post = await timed('https://www.virustotal.com/api/v3/urls', {
      method: 'POST',
      headers: { 'x-apikey': key, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url }),
    });
    if (!post.ok) return { fails: [], warns: [], notes: [`VirusTotal 검사는 건너뜀(응답 ${post.status})`] };
    const id = (await post.json()).data?.id;
    for (let i = 0; i < 8; i += 1) {
      await sleep(8_000);
      const get = await timed(`https://www.virustotal.com/api/v3/analyses/${id}`, { headers: { 'x-apikey': key } });
      if (!get.ok) continue;
      const attr = (await get.json()).data?.attributes;
      if (attr?.status !== 'completed') continue;
      const { malicious = 0, suspicious = 0 } = attr.stats ?? {};
      if (malicious >= 2) return { fails: [`VirusTotal 에서 ${malicious}개 엔진이 악성으로 판정했습니다`], warns: [], notes: [] };
      if (malicious || suspicious) return { fails: [], warns: [`VirusTotal 에서 ${malicious + suspicious}개 엔진이 의심으로 표시했습니다`], notes: [] };
      return { fails: [], warns: [], notes: ['VirusTotal 악성·의심 판정 없음'] };
    }
    return { fails: [], warns: [], notes: ['VirusTotal 검사는 건너뜀(시간 초과)'] };
  } catch (error) {
    return { fails: [], warns: [], notes: [`VirusTotal 검사는 건너뜀(${errText(error)})`] };
  }
}

// ── 확장 프로그램: 소스 저장소의 manifest 와 코드 ──
const ghHeaders = () => ({
  accept: 'application/vnd.github+json',
  'user-agent': 'juganlab-check',
  ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
});

async function checkExtension(service) {
  const repoLink = (service.links ?? []).map((l) => l.url).find((u) => /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(u));
  if (!repoLink) {
    return { fails: ['확장 프로그램은 소스가 있는 GitHub 저장소 주소를 links 에 넣어야 합니다'], warns: [], notes: [] };
  }
  const [owner, repo] = new URL(repoLink).pathname.split('/').filter(Boolean);
  try {
    const repoRes = await timed(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders() });
    if (!repoRes.ok) return { fails: [`저장소를 읽을 수 없습니다(HTTP ${repoRes.status})`], warns: [], notes: [] };
    const branch = (await repoRes.json()).default_branch;
    const treeRes = await timed(`https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers: ghHeaders() }, { maxBytes: 5_000_000 });
    if (!treeRes.ok) return { fails: [], warns: [], notes: ['소스 검사는 건너뜀(파일 목록을 읽지 못함)'] };
    const files = (await treeRes.json()).tree?.filter((f) => f.type === 'blob') ?? [];
    const manifestPath = files.map((f) => f.path).filter((p) => /(^|\/)manifest\.json$/.test(p) && !p.includes('node_modules/')).sort((a, b) => a.length - b.length)[0];
    if (!manifestPath) return { fails: ['저장소에서 manifest.json 을 찾지 못했습니다'], warns: [], notes: [] };
    const raw = (p) => timed(`https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${p.split('/').map(encodeURIComponent).join('/')}`, {}, { maxBytes: 400_000 });
    const manifest = JSON.parse(await (await raw(manifestPath)).text());
    const result = analyzeManifest(manifest);

    const sources = files
      .filter((f) => /\.(js|mjs|html)$/.test(f.path) && !/node_modules\/|\.min\.js$|(^|\/)(dist|vendor)\//.test(f.path) && (f.size ?? 0) <= MAX_SOURCE_BYTES)
      .slice(0, MAX_SOURCE_FILES);
    const found = new Set();
    for (const f of sources) {
      const text = await (await raw(f.path)).text();
      for (const hit of scanSource(text)) found.add(hit);
    }
    for (const hit of found) result.warns.push(`소스에서 ${hit} 발견(직접 확인 필요)`);
    result.notes.push(`소스 파일 ${sources.length}개 훑어봄(휴리스틱)`);
    return result;
  } catch (error) {
    return { fails: [], warns: [], notes: [`소스 검사는 건너뜀(${errText(error)})`] };
  }
}

// ── 작품 하나 ──
async function checkService(service) {
  const acc = { fails: [], warns: [], notes: [] };
  const merge = (r) => {
    acc.fails.push(...(r.fails ?? []));
    acc.warns.push(...(r.warns ?? []));
    acc.notes.push(...(r.notes ?? []));
  };
  const targets = [];
  if (service.status !== 'building' && service.url) targets.push([service.url, '작품 주소']);
  for (const l of service.links ?? []) targets.push([l.url, l.label]);

  for (const [url, label] of targets) merge(checkUrl(url, label));
  if (!acc.fails.length) {
    for (const [url, label] of targets) merge(await checkReachable(url, label));
  }
  if (!acc.fails.length && targets.length) {
    const urls = targets.map(([u]) => u);
    merge(await safeBrowsing(urls));
    if (service.url && service.status !== 'building') merge(await virusTotal(service.url));
  }
  if (!acc.fails.length && (service.type ?? 'web') === 'extension') merge(await checkExtension(service));
  return summarize({ ...acc, date: TODAY });
}

async function main() {
  const services = JSON.parse(readFileSync(SERVICES, 'utf8'));
  const previous = existsSync(CHECKS) ? JSON.parse(readFileSync(CHECKS, 'utf8')) : {};
  const next = {};
  let failed = 0;

  for (const s of services) {
    const prev = previous[s.id];
    const fresh = prev && prev.key === checkKey(s) && prev.result !== 'fail' && daysBetween(prev.date, TODAY) < STALE_DAYS;
    if (fresh && !args.has('--all')) {
      next[s.id] = prev;
      console.log(`- ${s.id}: ${prev.date} 검사 결과 유지`);
      continue;
    }
    const result = { url: s.url ?? '', key: checkKey(s), ...(await checkService(s)) };
    console.log(`- ${s.id}: ${result.result}`);
    for (const item of result.items) console.log(`    ${sanitizeLog(item)}`);
    if (result.result === 'fail') failed += 1;
    next[s.id] = result;
  }

  if (args.has('--write')) {
    // 실패한 작품은 배지를 달지 않는다(이전 기록이 없으면 항목 자체를 쓰지 않는다)
    const out = Object.fromEntries(Object.entries(next).filter(([, v]) => v.result !== 'fail'));
    writeFileSync(CHECKS, JSON.stringify(out, null, 2) + '\n');
  }
  if (failed) {
    console.error(`\n검사 실패 ${failed}건`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(errText(error));
  process.exit(1);
});

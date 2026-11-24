// AI 스킬 위주로 GitHub 에서 요즘 뜨는 저장소를 모아 data/trending.json 을 갱신한다.
//   node scripts/fetch-trending.mjs          매일 실행. 일요일(한국 시간)이면 주간 목록도 새로 만든다.
//   node scripts/fetch-trending.mjs --force  주간 목록도 지금 새로 만든다.
// GitHub 에는 '트렌딩' 공식 API 가 없다. 그래서 "지정한 토픽 중, 기간 안에 새로 만들어진 저장소를 별 많은 순"으로 뽑는다.
// 토큰(GITHUB_TOKEN)이 있으면 한도가 넉넉하다. 없어도 동작한다.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'data', 'trending.json');

// AI 스킬·에이전트 도구 위주 토픽
const TOPICS = ['agent-skills', 'claude-skills', 'claude-code', 'mcp-server', 'ai-agents', 'prompt-engineering'];
const TOP_N = 5;
const HISTORY_DAYS = 14;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const kstNow = () => new Date(Date.now() + KST_OFFSET_MS);

async function search(topic, sinceDay) {
  const q = `topic:${topic} created:>=${sinceDay}`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=10`;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'juganlab-hub-trending' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub 검색 실패(${topic}): ${res.status}`);
  const body = await res.json();
  return body.items ?? [];
}

// 별을 부풀리거나 악성 도구를 홍보하는 저장소가 섞이기 쉬워 설명이 없거나 수상한 이름은 뺀다
const SUSPICIOUS = /unlimited|crack|keygen|free[- ]?(credit|token|api)|bypass|jailbreak|hack|cheat|nsfw|leak/i;
const acceptable = (r) => !!r.description && !SUSPICIOUS.test(r.full_name + ' ' + r.description);

const pick = (r) => ({
  name: r.full_name,
  url: r.html_url,
  description: (r.description ?? '').trim().slice(0, 200),
  stars: r.stargazers_count,
  language: r.language ?? '',
  created: r.created_at.slice(0, 10),
});

async function topFor(sinceDay) {
  const seen = new Map();
  for (const topic of TOPICS) {
    for (const r of (await search(topic, sinceDay)).filter(acceptable)) seen.set(r.full_name, pick(r));
    await sleep(process.env.GITHUB_TOKEN ? 1500 : 7000); // 검색 API 는 분당 호출 수가 제한돼 있다
  }
  return [...seen.values()].sort((a, b) => b.stars - a.stars).slice(0, TOP_N);
}

const previous = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : null;
const today = isoDay(kstNow().getTime());
const isSunday = kstNow().getUTCDay() === 0;
const force = process.argv.includes('--force');

const dayMs = 24 * 60 * 60 * 1000;
const daily = { date: today, items: await topFor(isoDay(Date.now() - dayMs)) };

const needWeekly = force || isSunday || !previous?.weekly;
const weekly = needWeekly
  ? { date: today, from: isoDay(Date.now() - 7 * dayMs), items: await topFor(isoDay(Date.now() - 7 * dayMs)) }
  : previous.weekly;

// 일별 변화 기록: 같은 날짜는 덮어쓰고 최근 N일만 남긴다
const history = [
  { date: today, items: daily.items.map(({ name, stars }) => ({ name, stars })) },
  ...(previous?.history ?? []).filter((h) => h.date !== today),
]
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, HISTORY_DAYS);

const next = { updatedAt: new Date().toISOString(), topics: TOPICS, weekly, daily, history };
writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n');

// ── 한국어 요약·태그 (data/trending-ko.json) ──
// 새로 올라온 저장소만 Claude 로 요약한다. ANTHROPIC_API_KEY 가 없으면 건너뛰고, 페이지에는 '요약 준비 중'으로 나온다.
// 영어 원문은 그대로 번역·요약만 하고, 원문에 없는 기능을 지어내지 않게 지시한다.
const KO_FILE = join(ROOT, 'data', 'trending-ko.json');
const ko = existsSync(KO_FILE) ? JSON.parse(readFileSync(KO_FILE, 'utf8')) : {};
const KO_MODEL = 'claude-haiku-5-5';

async function summarizeKo(item) {
  const prompt = [
    '아래 GitHub 저장소 정보를 한국어로 정리해 주세요. 반드시 JSON 한 개만 출력합니다.',
    '{"summary": "무엇인지 + 언제 쓰는지를 담은 한국어 1~2문장(존댓말, 120자 안팎)", "tags": ["#태그", ...3~4개]}',
    '규칙: 원문에 없는 기능이나 수치를 지어내지 않는다. 제작자의 주장 수치는 "제작자 주장"이라고 밝힌다. 원문이 너무 짧아 용도를 알 수 없으면 summary 에 그렇게 쓰고 tags 는 ["#설명부족", "#확인필요"] 로 한다. 태그는 공백 없는 한국어 위주(고유명사는 그대로).',
    '',
    `저장소: ${item.name}`,
    `언어: ${item.language || '알 수 없음'}`,
    `원문 설명: ${item.description}`,
  ].join('\n');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: KO_MODEL, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`요약 API 실패 ${res.status}`);
  const text = (await res.json()).content?.find((c) => c.type === 'text')?.text ?? '';
  const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const tags = (parsed.tags ?? []).filter((t) => typeof t === 'string' && /^#\S+$/.test(t)).slice(0, 4);
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim() || !tags.length) throw new Error('요약 형식이 올바르지 않습니다');
  return { summary: parsed.summary.trim(), tags };
}

const shown = new Map([...weekly.items, ...daily.items].map((i) => [i.name, i]));
const missing = [...shown.values()].filter((i) => !ko[i.name]);
if (missing.length && !process.env.ANTHROPIC_API_KEY) {
  console.log(`한국어 요약 ${missing.length}개 없음 (ANTHROPIC_API_KEY 가 없어 건너뜀)`);
}
if (process.env.ANTHROPIC_API_KEY) {
  for (const item of missing) {
    try {
      ko[item.name] = await summarizeKo(item);
    } catch (error) {
      console.log(`요약 실패(${item.name}): ${error instanceof Error ? error.message : error}`);
    }
  }
}
// 더 이상 어디에도 나오지 않는 저장소의 요약은 지운다
const keep = new Set([...shown.keys(), ...history.flatMap((h) => h.items.map((i) => i.name))]);
for (const name of Object.keys(ko)) if (!keep.has(name)) delete ko[name];
writeFileSync(KO_FILE, JSON.stringify(ko, null, 2) + '\n');
console.log(`트렌딩 갱신: 오늘 ${daily.items.length}개, 주간 ${weekly.items.length}개${needWeekly ? ' (주간 새로 생성)' : ''}`);

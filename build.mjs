// 허브 페이지 빌드: data/*.json 을 읽어 src/index.template.html 의 자리표시자를 채우고 dist/ 에 쓴다.
// 서비스나 실험 일지를 추가할 때는 data/ 의 JSON 만 고치고 `node build.mjs` 를 실행한다.
// 화면 내용을 브라우저 스크립트가 아니라 빌드 때 HTML 로 만드는 이유: 검색 로봇과 애드센스 심사가
// 스크립트 실행 없이도 서비스 소개와 일지를 읽을 수 있어야 한다.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const STATIC_FILES = ['styles.css', 'app.js'];

// 광고 설정은 Vercel 환경변수로만 받는다. 값이 없으면 광고 스크립트·광고 칸·ads.txt 를 하나도 만들지 않는다.
//   ADSENSE_CLIENT    게시자 ID (ca-pub-16자리)
//   ADSENSE_SLOT_HUB  허브 본문 광고 단위 ID (숫자) — 없으면 스크립트와 ads.txt 만 나간다(사이트 확인용)
const ADSENSE_CLIENT_RE = /^ca-pub-\d{16}$/;
const ADSENSE_SLOT_RE = /^\d{6,20}$/;
// Google 이 ads.txt 에 쓰도록 안내하는 고정 인증 기관 ID
const GOOGLE_CERT_AUTHORITY_ID = 'f08c47fec0942fa0';

const STATUS_LABEL = { live: '운영 중', beta: '베타', building: '준비 중' };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9-]+$/;

const readJson = (file) => JSON.parse(readFileSync(join(ROOT, 'data', file), 'utf8'));

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const dotted = (isoDate) => isoDate.replaceAll('-', '.');

// ── 검증: 잘못된 데이터는 조용히 넘기지 않고 빌드를 멈춘다 ──

function validate(services, log) {
  const errors = [];
  const ids = new Set();

  services.forEach((s, i) => {
    const at = `services[${i}]${s?.id ? ` (${s.id})` : ''}`;
    if (!s.id || !ID_RE.test(s.id)) errors.push(`${at}: id 는 영문 소문자·숫자·하이픈만 쓸 수 있습니다`);
    if (ids.has(s.id)) errors.push(`${at}: id 가 중복됩니다`);
    ids.add(s.id);
    if (!s.name) errors.push(`${at}: name 이 비어 있습니다`);
    if (!STATUS_LABEL[s.status]) errors.push(`${at}: status 는 ${Object.keys(STATUS_LABEL).join(' / ')} 중 하나여야 합니다`);
    if (s.status !== 'building' && !/^https:\/\//.test(s.url ?? '')) errors.push(`${at}: url 은 https:// 로 시작해야 합니다`);
    if (!s.summary) errors.push(`${at}: summary 가 비어 있습니다`);
    if (s.since && !DATE_RE.test(s.since)) errors.push(`${at}: since 는 YYYY-MM-DD 형식이어야 합니다`);
    if (s.ping && !/^https:\/\//.test(s.ping)) errors.push(`${at}: ping 은 https:// 주소여야 합니다`);
    for (const stat of s.stats ?? []) {
      if (!stat.label || !Number.isFinite(stat.value)) errors.push(`${at}: stats 항목은 label 과 숫자 value 가 필요합니다`);
    }
  });

  log.forEach((e, i) => {
    const at = `log[${i}]`;
    if (!DATE_RE.test(e.date ?? '')) errors.push(`${at}: date 는 YYYY-MM-DD 형식이어야 합니다`);
    if (!ids.has(e.service)) errors.push(`${at}: service "${e.service}" 가 services.json 에 없습니다`);
    if (!e.title || !e.body) errors.push(`${at}: title 과 body 가 필요합니다`);
  });

  if (errors.length) {
    throw new Error(`데이터 오류 ${errors.length}건\n- ${errors.join('\n- ')}`);
  }
}

// ── 조각 렌더링 ──

const code = (index) => `EXP-${String(index + 1).padStart(2, '0')}`;

function renderStats(stats = []) {
  if (!stats.length) return '';
  const cells = stats
    .map((s) => `<div><dt>${escapeHtml(s.label)}</dt><dd data-count="${s.value}">${s.value.toLocaleString('ko-KR')}</dd></div>`)
    .join('');
  return `\n          <dl class="stats">${cells}</dl>`;
}

function renderService(s, index) {
  const domain = s.url ? new URL(s.url).host : '';
  const ping = s.ping && s.status !== 'building' ? ` data-ping="${escapeHtml(s.ping)}"` : '';
  const statusClass = s.status === 'building' ? 'status' : `status ${s.status}`;
  const classes = ['exp', s.featured && 'featured', s.status === 'building' && 'pending'].filter(Boolean).join(' ');
  const inner = `
          <div class="exp-top mono">
            <span>${code(index)}</span>
            <span class="${statusClass}"${ping}>${STATUS_LABEL[s.status]}</span>
          </div>
          <h3>${escapeHtml(s.name)}</h3>
          ${domain ? `<span class="domain">${escapeHtml(domain)}</span>` : ''}
          <p>${escapeHtml(s.summary)}</p>${renderStats(s.stats)}`;

  // 준비 중인 서비스는 아직 갈 곳이 없으므로 링크가 아닌 카드로 둔다.
  if (s.status === 'building' || !s.url) {
    return `        <div class="${classes}" id="svc-${s.id}">${inner}\n        </div>`;
  }
  return `        <a class="${classes}" id="svc-${s.id}" href="${escapeHtml(s.url)}">${inner}
          <span class="exp-cta">${escapeHtml(s.name)} 열기 <span aria-hidden="true">→</span></span>
        </a>`;
}

// 목록 끝에는 항상 "다음 실험" 자리를 둔다. 새 서비스를 추가하면 번호가 자동으로 밀린다.
function renderNextSlot(index) {
  return `        <div class="exp pending">
          <div class="exp-top mono">
            <span>${code(index)}</span>
            <span class="status">준비 중</span>
          </div>
          <h3>다음 실험</h3>
          <span class="domain">*.juganlab.com</span>
          <p>다음 서비스를 만들고 있습니다. 공개되면 이 자리에 소개와 주소를 올립니다.</p>
        </div>`;
}

function renderLogEntry(entry, serviceName) {
  const tag = [serviceName, entry.kind].filter(Boolean).map(escapeHtml).join(' · ');
  return `        <li class="entry${entry.highlight ? ' highlight' : ''}" data-service="${entry.service}">
          <time class="mono" datetime="${entry.date}">${dotted(entry.date)}</time>
          <div>
            <span class="entry-tag mono">${tag}</span>
            <h3>${escapeHtml(entry.title)}</h3>
            <p>${escapeHtml(entry.body)}</p>
          </div>
        </li>`;
}

// 서비스가 하나뿐이면 걸러 볼 이유가 없으므로 필터 버튼을 만들지 않는다.
function renderLogFilters(services, log) {
  const withEntries = services.filter((s) => log.some((e) => e.service === s.id));
  if (withEntries.length < 2) return '';
  const button = (value, label, pressed) =>
    `        <button type="button" class="filter-chip mono" data-filter="${value}" aria-pressed="${pressed}">${escapeHtml(label)}</button>`;
  return [button('all', '전체', true), ...withEntries.map((s) => button(s.id, s.name, false))].join('\n');
}

function renderHeroMeta(services, log) {
  const running = services.filter((s) => s.status !== 'building').length;
  const firstDate = [...services.map((s) => s.since), ...log.map((e) => e.date)].filter(Boolean).sort()[0];
  const since = firstDate ? dotted(firstDate).slice(0, 7) : String(new Date().getFullYear());
  return [
    `        <span>운영 중 <strong>${running}</strong></span>`,
    `        <span>실험 일지 <strong>${log.length}</strong></span>`,
    `        <span>Since <strong>${since}</strong></span>`,
  ].join('\n');
}

// 콘솔이 쓰는 최소 정보만 넘긴다. </script> 가 끼지 않도록 < 를 이스케이프한다.
function renderData(services) {
  const data = services.map((s, i) => ({
    id: s.id,
    code: code(i),
    name: s.name,
    status: STATUS_LABEL[s.status],
    url: s.status === 'building' ? null : s.url,
  }));
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

// ── 광고 ──

// 형식이 틀린 값은 광고를 끄는 대신 빌드를 멈춘다. 오타 난 ID 로 배포되면 심사·수익이 조용히 망가진다.
function readAdConfig(env) {
  const client = env.ADSENSE_CLIENT?.trim() || '';
  const slot = env.ADSENSE_SLOT_HUB?.trim() || '';
  if (client && !ADSENSE_CLIENT_RE.test(client)) throw new Error(`ADSENSE_CLIENT 형식이 틀립니다: "${client}" (ca-pub-16자리)`);
  if (slot && !ADSENSE_SLOT_RE.test(slot)) throw new Error(`ADSENSE_SLOT_HUB 는 숫자여야 합니다: "${slot}"`);
  if (slot && !client) throw new Error('ADSENSE_SLOT_HUB 를 쓰려면 ADSENSE_CLIENT 도 필요합니다');
  return { client, slot };
}

const renderAdHead = ({ client }) =>
  client
    ? `  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}" crossorigin="anonymous"></script>`
    : '';

// 높이를 미리 잡아 두어 광고가 늦게 떠도 아래 내용이 밀리지 않는다. 채워지지 않으면 CSS 가 칸을 접는다.
function renderAdHub({ client, slot }) {
  if (!client || !slot) return '';
  return `    <aside class="ad-slot wrap" aria-label="광고">
      <span class="ad-label mono">광고</span>
      <ins class="adsbygoogle" style="display:block;height:120px" data-ad-client="${client}" data-ad-slot="${slot}" data-ad-format="horizontal" data-full-width-responsive="false"></ins>
      <script>(window.adsbygoogle = window.adsbygoogle || []).push({});</script>
    </aside>`;
}

const renderAdsTxt = ({ client }) =>
  client ? `google.com, ${client.replace(/^ca-/, '')}, DIRECT, ${GOOGLE_CERT_AUTHORITY_ID}\n` : null;

function fillTemplate(file, parts) {
  let html = readFileSync(join(SRC, file), 'utf8');
  for (const [key, value] of Object.entries(parts)) {
    const marker = `<!-- @${key} -->`;
    if (!html.includes(marker)) throw new Error(`${file} 에 ${marker} 자리가 없습니다`);
    html = html.replace(marker, () => value);
  }
  return html;
}

// ── 조립 ──

function build() {
  const services = readJson('services.json');
  const log = readJson('log.json');
  validate(services, log);
  const ads = readAdConfig(process.env);

  const nameOf = Object.fromEntries(services.map((s) => [s.id, s.name]));
  const sortedLog = [...log].sort((a, b) => b.date.localeCompare(a.date));

  const parts = {
    heroMeta: renderHeroMeta(services, sortedLog),
    services: [...services.map(renderService), renderNextSlot(services.length)].join('\n'),
    logFilters: renderLogFilters(services, sortedLog),
    log: sortedLog.map((e) => renderLogEntry(e, nameOf[e.service])).join('\n'),
    data: renderData(services),
    adHead: renderAdHead(ads),
    adHub: renderAdHub(ads),
  };

  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  writeFileSync(join(DIST, 'index.html'), fillTemplate('index.template.html', parts));
  writeFileSync(join(DIST, 'privacy.html'), fillTemplate('privacy.html', { adHead: parts.adHead }));
  for (const file of STATIC_FILES) cpSync(join(SRC, file), join(DIST, file));
  const adsTxt = renderAdsTxt(ads);
  if (adsTxt) writeFileSync(join(DIST, 'ads.txt'), adsTxt);

  const adState = !ads.client ? '광고 꺼짐' : ads.slot ? '광고 스크립트+광고 칸+ads.txt' : '광고 스크립트+ads.txt(광고 칸 없음)';
  console.log(`빌드 완료: 서비스 ${services.length}개, 실험 일지 ${log.length}개, ${adState} → dist/`);
}

try {
  build();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

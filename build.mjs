// 허브 페이지 빌드: data/*.json 을 읽어 src/index.template.html 의 자리표시자를 채우고 dist/ 에 쓴다.
// 서비스나 실험 일지를 추가할 때는 data/ 의 JSON 만 고치고 `node build.mjs` 를 실행한다.
// 화면 내용을 브라우저 스크립트가 아니라 빌드 때 HTML 로 만드는 이유: 검색 로봇과 애드센스 심사가
// 스크립트 실행 없이도 서비스 소개와 일지를 읽을 수 있어야 한다.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderAbout, renderLogIndex, renderPost } from './lib/pages.mjs';
import { readDojang, renderDojangIndex, renderRef, renderUiDojang } from './lib/dojang.mjs';
import { readPosts } from './lib/posts.mjs';
import { checkInternalLinks, renderRobots, renderSitemap } from './lib/seo.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const STATIC_FILES = ['styles.css', 'app.js', 'favicon.ico', 'icon.svg', 'apple-touch-icon.png', 'icon-512.png'];

// 광고 설정은 Vercel 환경변수로만 받는다. 값이 없으면 광고 스크립트·광고 칸·ads.txt 를 하나도 만들지 않는다.
//   ADSENSE_CLIENT    게시자 ID (ca-pub-16자리)
//   ADSENSE_SLOT_HUB  허브 본문 광고 단위 ID (숫자) — 없으면 스크립트와 ads.txt 만 나간다(사이트 확인용)
const ADSENSE_CLIENT_RE = /^ca-pub-\d{16}$/;
const ADSENSE_SLOT_RE = /^\d{6,20}$/;
// Google 이 ads.txt 에 쓰도록 안내하는 고정 인증 기관 ID
const GOOGLE_CERT_AUTHORITY_ID = 'f08c47fec0942fa0';

const STATUS_LABEL = { live: '운영 중', beta: '베타', building: '준비 중' };
const TYPE_LABEL = { web: '웹 서비스', extension: '크롬 확장', guide: '도감' };
const statusText = (s) => s.statusLabel || STATUS_LABEL[s.status];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9-]+$/;

const readJson = (file) => JSON.parse(readFileSync(join(ROOT, 'data', file), 'utf8'));

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const dotted = (isoDate) => isoDate.replaceAll('-', '.');

// ── 검증: 잘못된 데이터는 조용히 넘기지 않고 빌드를 멈춘다 ──

function validate(services, log, posts) {
  const slugs = new Set(posts.map((p) => p.slug));
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
    if (s.type && !TYPE_LABEL[s.type]) errors.push(`${at}: type 은 ${Object.keys(TYPE_LABEL).join(' / ')} 중 하나여야 합니다`);
    for (const f of s.features ?? []) {
      if (!f.title) errors.push(`${at}: features 항목에는 title 이 필요합니다`);
    }
    for (const g of s.groups ?? []) {
      if (!g.name || !Array.isArray(g.items) || !g.items.length) errors.push(`${at}: groups 항목에는 name 과 items 가 필요합니다`);
    }
    for (const l of s.links ?? []) {
      if (!l.label || !/^https:\/\//.test(l.url ?? '')) errors.push(`${at}: links 항목은 label 과 https:// url 이 필요합니다`);
    }
    for (const stat of s.stats ?? []) {
      if (!stat.label || !Number.isFinite(stat.value)) errors.push(`${at}: stats 항목은 label 과 숫자 value 가 필요합니다`);
    }
  });

  log.forEach((e, i) => {
    const at = `log[${i}]`;
    if (!DATE_RE.test(e.date ?? '')) errors.push(`${at}: date 는 YYYY-MM-DD 형식이어야 합니다`);
    if (!ids.has(e.service)) errors.push(`${at}: service "${e.service}" 가 services.json 에 없습니다`);
    if (!e.title || !e.body) errors.push(`${at}: title 과 body 가 필요합니다`);
    if (e.post && !slugs.has(e.post)) errors.push(`${at}: post "${e.post}" 글이 data/posts 에 없습니다`);
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

const typeOf = (s) => s.type || 'web';

function renderTags(tags = []) {
  if (!tags.length) return '';
  return `
          <ul class="tags">${tags.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
}

function renderService(s, index) {
  const domain = s.url ? new URL(s.url).host : '';
  const ping = s.ping && s.status !== 'building' ? ` data-ping="${escapeHtml(s.ping)}"` : '';
  const statusClass = s.status === 'building' ? 'status' : `status ${s.status}`;
  const classes = ['exp', s.featured && 'featured', s.status === 'building' && 'pending'].filter(Boolean).join(' ');
  const search = [s.name, s.summary, ...(s.tags ?? [])].join(' ').toLowerCase();
  const open = s.url && s.status !== 'building'
    ? `<a class="exp-link" href="${escapeHtml(s.url)}">열기 <span aria-hidden="true">↗</span></a>`
    : '';
  return `        <article class="${classes}" id="svc-${s.id}" data-type="${typeOf(s)}" data-search="${escapeHtml(search)}">
          <div class="exp-top mono">
            <span>${code(index)} · ${TYPE_LABEL[typeOf(s)]}</span>
            <span class="${statusClass}"${ping}>${escapeHtml(statusText(s))}</span>
          </div>
          <h3>${escapeHtml(s.name)}</h3>
          ${domain ? `<span class="domain">${escapeHtml(domain)}</span>` : ''}
          <p>${escapeHtml(s.summary)}</p>${renderTags(s.tags)}${renderStats(s.stats)}
          <div class="exp-actions">
            <button type="button" class="exp-detail" data-detail="${s.id}" aria-haspopup="dialog">기능·사용법 보기 <span aria-hidden="true">→</span></button>
            ${open}
          </div>
        </article>`;
}

// 카드마다 기능·사용법 상세 창을 만든다. 스크립트 없이도 검색 로봇이 읽을 수 있게 빌드 때 HTML 로 둔다.
function renderDetail(s) {
  const features = (s.features ?? []).length
    ? `<h3>주요 기능</h3>
        <ul class="feature-list">${s.features.map((f) => `<li><strong>${escapeHtml(f.title)}</strong>${f.desc ? `<span>${escapeHtml(f.desc)}</span>` : ''}</li>`).join('')}</ul>`
    : '';
  const groups = (s.groups ?? []).length
    ? `<h3>다루는 내용 <span class="count mono">${s.groups.reduce((n, g) => n + g.items.length, 0)}개</span></h3>
        ${s.groups.map((g) => `<div class="group"><h4 class="mono">${escapeHtml(g.name)}</h4><ul class="chips">${g.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul></div>`).join('')}`
    : '';
  const howtoTitle = s.status === 'building' ? '이렇게 쓰게 됩니다' : '사용 방법';
  const howto = (s.howto ?? []).length
    ? `<h3>${howtoTitle}</h3>
        <ol class="steps">${s.howto.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ol>`
    : '';
  const actions = [
    s.url && s.status !== 'building' ? `<a class="mail" href="${escapeHtml(s.url)}">${escapeHtml(s.name)} 열기</a>` : '',
    ...(s.links ?? []).map((l) => `<a class="ghost-link" href="${escapeHtml(l.url)}">${escapeHtml(l.label)} ↗</a>`),
  ].join('');
  return `    <dialog class="detail" id="detail-${s.id}" aria-labelledby="detail-title-${s.id}">
      <form method="dialog" class="detail-close"><button aria-label="닫기">닫기 <kbd>Esc</kbd></button></form>
      <div class="detail-body">
        <p class="mono detail-kind">${TYPE_LABEL[typeOf(s)]} · ${escapeHtml(statusText(s))}</p>
        <h2 id="detail-title-${s.id}">${escapeHtml(s.name)}</h2>
        <p class="detail-summary">${escapeHtml(s.summary)}</p>
        ${features}${groups}${howto}
        ${actions ? `<div class="detail-actions">${actions}</div>` : ''}
      </div>
    </dialog>`;
}

function renderMarketFilters(services) {
  const types = [...new Set(services.map(typeOf))];
  if (types.length < 2) return '';
  const button = (value, label, pressed) =>
    `        <button type="button" class="filter-chip market-chip mono" data-type-filter="${value}" aria-pressed="${pressed}">${escapeHtml(label)}</button>`;
  return [button('all', '전체', true), ...types.map((t) => button(t, TYPE_LABEL[t], false))].join('\n');
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
            <h3>${entry.post ? `<a href="/log/${entry.post}">${escapeHtml(entry.title)}</a>` : escapeHtml(entry.title)}</h3>
            <p>${escapeHtml(entry.body)}</p>${
              entry.post
                ? `\n            <a class="entry-more mono" href="/log/${entry.post}">개발기 읽기 <span aria-hidden="true">→</span></a>`
                : ''
            }
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
    status: statusText(s),
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

// ── 개발기 글 ──

// /log 는 log.html, /log/<slug> 는 log/<slug>.html (vercel.json 의 cleanUrls 로 .html 없이 열린다)
function writePosts(posts, nameOf, adHead) {
  writeFileSync(join(DIST, 'log.html'), renderLogIndex(posts, nameOf, adHead));
  mkdirSync(join(DIST, 'log'), { recursive: true });
  posts.forEach((post, i) => {
    writeFileSync(join(DIST, 'log', `${post.slug}.html`), renderPost(post, posts[i - 1], posts[i + 1], nameOf, adHead));
  });
}

// 날짜를 아는 페이지만 lastmod 를 단다. 모르는 날짜를 지어내지 않는다.
const PRIVACY_EFFECTIVE = '2026-10-21'; // src/privacy.html 의 시행일

function sitemapPages(sortedLog, posts, dojang) {
  const latest = (dates) => dates.filter(Boolean).sort().at(-1);
  const postDate = (p) => p.updated || p.date;
  return [
    { path: '/', lastmod: latest([...sortedLog.map((e) => e.date), ...posts.map(postDate)]) },
    { path: '/about' },
    { path: '/privacy', lastmod: PRIVACY_EFFECTIVE },
    { path: '/dojang' },
    { path: '/dojang/ui' },
    ...dojang.refs.map((r) => ({ path: `/dojang/${r.slug}` })),
    { path: '/log', lastmod: latest(posts.map(postDate)) },
    ...[...posts].reverse().map((p) => ({ path: `/log/${p.slug}`, lastmod: postDate(p) })),
  ];
}

// ── 조립 ──

function writeDojang(dojang, adHead) {
  mkdirSync(join(DIST, 'dojang'), { recursive: true });
  writeFileSync(join(DIST, 'dojang.html'), renderDojangIndex(dojang, adHead));
  writeFileSync(join(DIST, 'dojang', 'ui.html'), renderUiDojang(dojang, adHead));
  for (const ref of dojang.refs) writeFileSync(join(DIST, 'dojang', `${ref.slug}.html`), renderRef(ref, adHead));
  // 데모 스크립트·스타일은 그대로 복사한다(빌드 도구 없이 순수 JS/CSS)
  if (existsSync(join(SRC, 'dojang'))) cpSync(join(SRC, 'dojang'), join(DIST, 'dojang'), { recursive: true });
}

function build() {
  const services = readJson('services.json');
  const log = readJson('log.json');
  const posts = readPosts(join(ROOT, 'data', 'posts'), new Set(services.map((s) => s.id)));
  validate(services, log, posts);
  const ads = readAdConfig(process.env);

  const nameOf = Object.fromEntries(services.map((s) => [s.id, s.name]));
  const sortedLog = [...log].sort((a, b) => b.date.localeCompare(a.date));

  const parts = {
    heroMeta: renderHeroMeta(services, sortedLog),
    services: [...services.map(renderService), renderNextSlot(services.length)].join('\n'),
    marketFilters: renderMarketFilters(services),
    details: services.map(renderDetail).join('\n'),
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
  writeFileSync(join(DIST, 'about.html'), renderAbout(services, posts, parts.adHead));
  writePosts(posts, nameOf, parts.adHead);
  const dojang = readDojang(join(ROOT, 'data', 'dojang'));
  writeDojang(dojang, parts.adHead);
  for (const file of STATIC_FILES) cpSync(join(SRC, file), join(DIST, file));
  const adsTxt = renderAdsTxt(ads);
  if (adsTxt) writeFileSync(join(DIST, 'ads.txt'), adsTxt);
  writeFileSync(join(DIST, 'robots.txt'), renderRobots());
  writeFileSync(join(DIST, 'sitemap.xml'), renderSitemap(sitemapPages(sortedLog, posts, dojang)));
  checkInternalLinks(DIST);

  const adState = !ads.client ? '광고 꺼짐' : ads.slot ? '광고 스크립트+광고 칸+ads.txt' : '광고 스크립트+ads.txt(광고 칸 없음)';
  console.log(`빌드 완료: 서비스 ${services.length}개, 실험 일지 ${log.length}개, 개발기 ${posts.length}편, ${adState} → dist/`);
}

try {
  build();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

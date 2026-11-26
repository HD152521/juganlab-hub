// 허브 페이지 빌드: data/*.json 을 읽어 src/index.template.html 의 자리표시자를 채우고 dist/ 에 쓴다.
// 작품이나 일지를 추가할 때는 data/ 의 JSON 만 고치고 `node build.mjs` 를 실행한다.
// 화면 내용을 브라우저 스크립트가 아니라 빌드 때 HTML 로 만드는 이유: 검색 로봇과 애드센스 심사가
// 스크립트 실행 없이도 서비스 소개와 일지를 읽을 수 있어야 한다.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderAbout, renderLogIndex, renderPost } from './lib/pages.mjs';
import { readDojang, renderDojangIndex, renderRef, renderUiDojang } from './lib/dojang.mjs';
import { renderLearn, renderSubmit } from './lib/learn.mjs';
import { renderWorks } from './lib/works.mjs';
import { readAiGuides, renderAiIndex } from './lib/ai.mjs';
import { readTrending, renderTrending } from './lib/trending.mjs';
import { buildSearchIndex, renderHeroMeta as renderHomeMeta, renderToolbox } from './lib/home.mjs';
import { hasEnglish, renderEnHome, renderEnWorks, renderEnProject, renderEnSubmit } from './lib/en.mjs';
import { CATEGORIES, categoryOf, renderCheck, renderProject, statusText, TYPE_LABEL, typeOf } from './lib/projects.mjs';
import { renderCard, renderHow, renderMarketBar, renderMoreButton, renderSlot } from './lib/market.mjs';
import { howtoOf, screenshotsOf, validateMedia } from './lib/media.mjs';
import { readPosts } from './lib/posts.mjs';
import { checkInternalLinks, renderRobots, renderSitemap } from './lib/seo.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const STATIC_FILES = ['styles.css', 'app.js', 'market.js', 'favicon.ico', 'icon.svg', 'apple-touch-icon.png', 'icon-512.png'];

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
    if (s.author !== undefined && (typeof s.author !== 'string' || !s.author.trim())) errors.push(`${at}: author 는 비어 있지 않은 문자열이어야 합니다`);
    for (const key of ['name_en', 'summary_en']) {
      if (s[key] !== undefined && (typeof s[key] !== 'string' || !s[key].trim())) errors.push(`${at}: ${key} 는 비어 있지 않은 문자열이어야 합니다`);
    }
    if (Boolean(s.name_en) !== Boolean(s.summary_en)) errors.push(`${at}: name_en 과 summary_en 은 함께 적어야 합니다`);
    if (s.since && !DATE_RE.test(s.since)) errors.push(`${at}: since 는 YYYY-MM-DD 형식이어야 합니다`);
    if (s.ping && !/^https:\/\//.test(s.ping)) errors.push(`${at}: ping 은 https:// 주소여야 합니다`);
    if (s.category && !CATEGORIES.some((c) => c.id === s.category)) errors.push(`${at}: category 는 ${CATEGORIES.map((c) => c.id).join(' / ')} 중 하나여야 합니다`);
    if (s.type && !TYPE_LABEL[s.type]) errors.push(`${at}: type 은 ${Object.keys(TYPE_LABEL).join(' / ')} 중 하나여야 합니다`);
    validateMedia(s, at, errors);
    for (const ref of [s.thumbnail, ...screenshotsOf(s).map((x) => x.src), ...howtoOf(s).map((x) => x.image)]) {
      if (typeof ref === 'string' && ref.startsWith('/') && !existsSync(join(SRC, ref))) errors.push(`${at}: 이미지 파일이 없습니다 (src${ref})`);
    }
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

// 작품 카드·필터 막대(한국어). 영어 홈은 lib/en.mjs 가 같은 조각(lib/market.mjs)으로 만든다.
const koItem = (s, entryCount, check) => {
  const cat = categoryOf(s);
  return {
    s,
    href: `/p/${s.id}`,
    name: s.name,
    summary: s.summary,
    type: typeOf(s),
    typeLabel: TYPE_LABEL[typeOf(s)],
    cat: cat.id,
    catLabel: cat.label,
    statusClass: s.status === 'building' ? 'status' : `status ${s.status}`,
    statusText: statusText(s),
    ping: s.ping && s.status !== 'building' ? s.ping : '',
    logCount: entryCount,
    badge: renderCheck(check),
  };
};

// 기본 순서는 최신순(since 내림차순, 날짜 없으면 뒤). 같으면 데이터 순서.
const newestFirst = (services) => [...services].sort((a, b) => (b.since ?? '').localeCompare(a.since ?? ''));

const HOME_COUNT = 6; // 홈에는 최신 작품 몇 개만. 전체는 /works

function renderMarket(services, entriesOf, checks, limit = Infinity) {
  const sorted = newestFirst(services).slice(0, limit);
  return [...sorted.map((sv, i) => renderCard(koItem(sv, entriesOf(sv.id).length, checks[sv.id]), i, 'ko')), renderSlot('ko', '/submit')].join('\n');
}

function renderMarketControls(services) {
  return renderMarketBar(services, {
    lang: 'ko',
    types: Object.entries(TYPE_LABEL),
    cats: CATEGORIES.map((c) => [c.id, c.label]),
    typeOf,
    catOf: (s) => categoryOf(s).id,
  });
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

function sitemapPages(sortedLog, posts, dojang, aiGuides, services) {
  const latest = (dates) => dates.filter(Boolean).sort().at(-1);
  const postDate = (p) => p.updated || p.date;
  return [
    { path: '/', lastmod: latest([...sortedLog.map((e) => e.date), ...posts.map(postDate)]) },
    { path: '/about' },
    ...services.map((sv) => ({ path: `/p/${sv.id}`, lastmod: sortedLog.find((e) => e.service === sv.id)?.date })),
    { path: '/privacy', lastmod: PRIVACY_EFFECTIVE },
    { path: '/learn' },
    { path: '/trending' },
    ...(aiGuides.length ? [{ path: '/ai' }, ...aiGuides.map((g) => ({ path: `/ai/${g.slug}` }))] : []),
    { path: '/submit' },
    { path: '/works' },
    { path: '/en' },
    { path: '/en/works' },
    { path: '/en/submit' },
    ...services.filter(hasEnglish).map((sv) => ({ path: `/en/p/${sv.id}` })),
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

  const dojang = readDojang(join(ROOT, 'data', 'dojang'));
  const aiGuides = readAiGuides(join(ROOT, 'data', 'ai'));
  const trending = readTrending(join(ROOT, 'data', 'trending.json'), join(ROOT, 'data', 'trending-ko.json'));

  const nameOf = Object.fromEntries(services.map((s) => [s.id, s.name]));
  const sortedLog = [...log].sort((a, b) => b.date.localeCompare(a.date));
  const entriesOf = (id) => sortedLog.filter((e) => e.service === id);
  // 자동 검사 결과(CI 가 data/checks.json 에 기록한다). 없으면 배지를 달지 않는다.
  const checks = existsSync(join(ROOT, 'data', 'checks.json')) ? readJson('checks.json') : {};

  const parts = {
    heroMeta: renderHomeMeta(services, posts, dojang, aiGuides),
    services: renderMarket(services, entriesOf, checks, HOME_COUNT),
    marketAll: `      <p class="market-all"><a class="ghost-link" href="/works">전체 작품 ${services.length}개 보기 <span aria-hidden="true">→</span></a></p>`,
    how: renderHow('ko', '/submit'),
    toolbox: renderToolbox(dojang, aiGuides, trending),
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
  mkdirSync(join(DIST, 'p'), { recursive: true });
  for (const sv of services) writeFileSync(join(DIST, 'p', `${sv.id}.html`), renderProject(sv, entriesOf(sv.id), checks[sv.id], parts.adHead));
  writeDojang(dojang, parts.adHead);
  writeFileSync(join(DIST, 'learn.html'), renderLearn(dojang, posts, parts.adHead));
  writeFileSync(
    join(DIST, 'works.html'),
    renderWorks({ barHtml: renderMarketControls(services), cardsHtml: renderMarket(services, entriesOf, checks), moreHtml: renderMoreButton('ko'), total: services.length, adHead: parts.adHead }),
  );
  writeFileSync(join(DIST, 'submit.html'), renderSubmit(parts.adHead));
  // 영어 페이지: 영어 소개가 있는 작품만
  mkdirSync(join(DIST, 'en', 'p'), { recursive: true });
  writeFileSync(join(DIST, 'en.html'), renderEnHome(services, checks, parts.adHead));
  writeFileSync(join(DIST, 'en', 'submit.html'), renderEnSubmit(parts.adHead));
  writeFileSync(join(DIST, 'en', 'works.html'), renderEnWorks(services, checks, parts.adHead));
  for (const sv of services.filter(hasEnglish)) writeFileSync(join(DIST, 'en', 'p', `${sv.id}.html`), renderEnProject(sv, checks[sv.id], parts.adHead));
  if (aiGuides.length) {
    mkdirSync(join(DIST, 'ai'), { recursive: true });
    writeFileSync(join(DIST, 'ai.html'), renderAiIndex(aiGuides, parts.adHead));
    for (const g of aiGuides) writeFileSync(join(DIST, 'ai', `${g.slug}.html`), renderRef(g, parts.adHead, { base: '/ai', parent: 'AI 활용', nav: 'ai' }));
  }
  writeFileSync(join(DIST, 'trending.html'), renderTrending(trending, parts.adHead));
  writeFileSync(join(DIST, 'search-index.json'), JSON.stringify(buildSearchIndex(dojang, aiGuides, services)));
  for (const file of STATIC_FILES) cpSync(join(SRC, file), join(DIST, file));
  // 작품 이미지(src/img)는 그대로 복사한다
  if (existsSync(join(SRC, 'img'))) cpSync(join(SRC, 'img'), join(DIST, 'img'), { recursive: true });
  const adsTxt = renderAdsTxt(ads);
  if (adsTxt) writeFileSync(join(DIST, 'ads.txt'), adsTxt);
  writeFileSync(join(DIST, 'robots.txt'), renderRobots());
  writeFileSync(join(DIST, 'sitemap.xml'), renderSitemap(sitemapPages(sortedLog, posts, dojang, aiGuides, services)));
  checkInternalLinks(DIST);

  const adState = !ads.client ? '광고 꺼짐' : ads.slot ? '광고 스크립트+광고 칸+ads.txt' : '광고 스크립트+ads.txt(광고 칸 없음)';
  console.log(`빌드 완료: 서비스 ${services.length}개, 일지 ${log.length}개, 개발기 ${posts.length}편, ${adState} → dist/`);
}

try {
  build();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

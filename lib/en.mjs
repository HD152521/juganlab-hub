// 영어 페이지(/en, /en/p/<id>, /en/submit). name_en·summary_en 이 있는 작품만 싣는다.
// 일지·도구함 본문은 한국어라서 영어 페이지에서는 한국어 페이지로 안내한다.
import { escapeHtml } from './markdown.mjs';
import { head } from './pages.mjs';
import { categoryOf, CATEGORIES, EXT_REL, hostOf, renderShots } from './projects.mjs';
import { renderCard, renderHow, renderMarketBar, renderMoreButton, renderSlot } from './market.mjs';

const TYPE_EN = { web: 'Web', app: 'App', extension: 'Extension' };
const STATUS_EN = { live: 'Live', beta: 'Beta', building: 'In progress' };
const typeOf = (s) => s.type || 'web';

export const hasEnglish = (s) => Boolean(s.name_en && s.summary_en);

const nav = `  <header class="topbar">
    <div class="wrap">
      <a class="brand" href="/en" aria-label="JUGAN LAB home">
        <span class="brand-mark" aria-hidden="true">JL</span>
        JUGAN LAB
      </a>
      <nav class="nav nav-sub" aria-label="Main menu">
        <a href="/en">Home</a>
        <a href="/en/works">Projects</a>
        <a href="/en/submit">Submit</a>
        <a href="/" hreflang="ko" lang="ko">한국어</a>
      </nav>
    </div>
  </header>`;

const footer = `  <footer class="footer">
    <div class="wrap">
      <span>© 2026 JUGAN LAB</span>
      <span class="footer-links"><a href="/en/submit">Submit</a><a href="/">한국어</a><a href="/privacy">Privacy (Korean)</a></span>
    </div>
  </footer>
</body>
</html>
`;

function badge(check) {
  if (!check) return '';
  const ok = check.result === 'pass';
  return `<span class="chk mono ${ok ? 'chk-pass' : 'chk-warn'}">${ok ? 'Automated check passed' : 'Check: notes'} ${check.date}</span>`;
}

function enItem(s, check, newestIdx) {
  const cat = categoryOf(s);
  return {
    s,
    href: `/en/p/${s.id}`,
    name: s.name_en,
    summary: s.summary_en,
    type: typeOf(s),
    typeLabel: TYPE_EN[typeOf(s)],
    cat: cat.id,
    catLabel: cat.en,
    statusClass: s.status === 'building' ? 'status' : `status ${s.status}`,
    statusText: STATUS_EN[s.status],
    ping: '',
    logCount: 0,
    badge: badge(check),
    newestIdx,
  };
}

const alt = (korean, english) => ({ ko: korean, en: english });

const HOME_COUNT = 6; // 홈에는 최신 작품 몇 개만. 전체는 /en/works
const newest = (list) => [...list].sort((a, b) => (b.since ?? '').localeCompare(a.since ?? ''));

// 작품 목록 전용 페이지. 검색·필터·정렬·더 보기.
export function renderEnWorks(services, checks, adHead) {
  const list = services.filter(hasEnglish);
  return `${head({
    title: 'Projects | JUGAN LAB',
    description: `Browse ${list.length} web apps, mobile apps and browser extensions shared by first-time makers. Listed projects go through automated checks, which do not guarantee safety.`,
    path: '/en/works',
    extraHead: '  <script src="/market.js" defer></script>\n',
    adHead,
    lang: 'en',
    alt: alt('/works', '/en/works'),
  })}
<body>
${nav}

  <main class="wrap works">
    <div class="works-head">
      <p class="mono doc-label"><a href="/en">Home</a> / Projects</p>
      <h1>Projects</h1>
      <p class="doc-lede">Browse what first-time makers have built. Filter by type and category, or search by name, maker or tag.</p>
    </div>

${renderMarketBar(list, { lang: 'en', types: Object.entries(TYPE_EN), cats: CATEGORIES.map((c) => [c.id, c.en]), typeOf, catOf: (s) => categoryOf(s).id })}
      <div class="experiments" id="market-grid">
${newest(list).map((s, i) => renderCard(enItem(s, checks[s.id], i), i, 'en')).join('\n')}
${renderSlot('en', '/en/submit')}
      </div>
${renderMoreButton('en')}
    <p class="works-note">Projects are posted by their makers. Automated checks look for warning signs and do not guarantee safety. To submit yours, see <a href="/en/submit">how to submit</a>.</p>
  </main>

${footer}`;
}

export function renderEnHome(services, checks, adHead) {
  const list = services.filter(hasEnglish);
  return `${head({
    title: 'JUGAN LAB | Share and try first-time web apps, apps and extensions',
    description: 'JUGAN LAB is a small marketplace where first-time makers share web apps, mobile apps and browser extensions and get them seen. Listed projects go through automated link and permission checks.',
    path: '/en',
    adHead,
    lang: 'en',
    alt: alt('/', '/en'),
  })}
<body>
${nav}

  <main class="wrap">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-grid">
        <div class="hero-main">
          <p class="hero-label mono">JUGAN LAB · a maker market</p>
          <h1 id="hero-title">Share your first web app, mobile app or extension, <em>and try other people's</em></h1>
          <p class="hero-lede">Post what you built <strong>with just a description and a link</strong>, and anyone can browse and try it. Unfinished or first attempts are welcome.</p>
          <div class="hero-cta"><a class="mail" href="/en/works">Browse projects</a><a class="ghost-link" href="/en/submit">Submit yours <span aria-hidden="true">→</span></a></div>
          <ul class="hero-for" aria-label="Who this is for">
            <li>First-time makers with nowhere to show what they built</li>
            <li>People who like trying small new web apps, apps and extensions</li>
            <li>People who want to get inspired by what others built</li>
          </ul>
        </div>
        ${renderHow('en', '/en/submit')}
      </div>
    </section>

    <section id="works" class="section" aria-labelledby="works-title">
      <div class="section-head"><span class="mono">01 / Works</span><h2 id="works-title">Projects</h2></div>
      <div class="experiments" id="market-grid">
${newest(list).slice(0, HOME_COUNT).map((s, i) => renderCard(enItem(s, checks[s.id], i), i, 'en')).join('\n')}
${renderSlot('en', '/en/submit')}
      </div>
      <p class="market-all"><a class="ghost-link" href="/en/works">View all ${list.length} projects <span aria-hidden="true">→</span></a></p>
      <p class="section-lede" style="margin-top:24px">The maker toolbox is written in Korean. <a href="/">Open the Korean site</a>.</p>
    </section>
  </main>

${footer}`;
}

export function renderEnProject(s, check, adHead) {
  const live = s.url && s.status !== 'building';
  const host = live ? hostOf(s.url) : '';
  const actions = [
    live ? `<a class="mail" href="${escapeHtml(s.url)}" rel="${EXT_REL}" title="Opens an external site: ${escapeHtml(host)}">Open ${escapeHtml(s.name_en)} <span aria-hidden="true">↗</span></a>` : '',
    ...(s.links ?? []).map((l) => `<a class="ghost-link" href="${escapeHtml(l.url)}" rel="${EXT_REL}" title="Opens an external site: ${escapeHtml(hostOf(l.url))}">Source / link ↗</a>`),
  ].join('');
  const extNote = actions
    ? `<p class="ext-note"><span class="ext-tag mono">Leaves this site</span> The buttons above open <strong>an external address posted by the maker</strong>${host ? ` (${escapeHtml(host)})` : ''}. The site operator does not vouch for its content, so check it yourself before installing or signing in.</p>`
    : '';
  return `${head({
    title: `${s.name_en} | JUGAN LAB`,
    description: s.summary_en.slice(0, 150),
    path: `/en/p/${s.id}`,
    adHead,
    lang: 'en',
    alt: alt(`/p/${s.id}`, `/en/p/${s.id}`),
  })}
<body>
${nav}

  <main class="doc wrap">
    <p class="mono doc-label"><a href="/en#works">Projects</a> · ${TYPE_EN[typeOf(s)]} · ${STATUS_EN[s.status]}</p>
    <h1>${escapeHtml(s.name_en)}</h1>
    <p class="proj-by mono">${s.author ? `by ${escapeHtml(s.author)} ` : ''}${badge(check)}</p>
    <p class="doc-lede">${escapeHtml(s.summary_en)}</p>
    ${actions ? `<div class="proj-actions">${actions}</div>` : ''}
    ${extNote}${renderShots(s, 'en')}
    <p class="proj-note">The automated check looks at the link, malware lists and (for extensions) requested permissions. It does <strong>not</strong> guarantee safety. Review a project yourself before installing it or signing in.</p>
    <p class="proj-note">Full description (Korean): <a href="/p/${s.id}" hreflang="ko" lang="ko">${escapeHtml(s.name)}</a></p>
  </main>

${footer}`;
}

export function renderEnSubmit(adHead) {
  return `${head({
    title: 'Submit your project | JUGAN LAB',
    description: 'How to list your web app, mobile app or browser extension on JUGAN LAB, and what the automated checks cover.',
    path: '/en/submit',
    adHead,
    lang: 'en',
    alt: alt('/submit', '/en/submit'),
  })}
<body>
${nav}

  <main class="doc wrap">
    <p class="mono doc-label"><a href="/en">Home</a> / Submit</p>
    <h1>Submit your project</h1>
    <p class="doc-lede">Web apps, mobile apps and browser extensions are all welcome, including first attempts and unfinished ones. You get a project page.</p>

    <h2>How</h2>
    <ol>
      <li>Fork <a href="https://github.com/HD152521/juganlab-hub">HD152521/juganlab-hub</a>.</li>
      <li>Add an entry to <code>data/services.json</code>. Use <code>type</code> web / app / extension, and fill <code>name_en</code> and <code>summary_en</code> so it appears on the English pages.</li>
      <li>Run <code>node build.mjs</code> to validate, then open a pull request.</li>
    </ol>

    <h2>Automated checks</h2>
    <ul>
      <li><strong>URL rules</strong>: https only; no URL shorteners, raw IP addresses or direct downloads of executables and archives.</li>
      <li><strong>Reachability</strong>: the link must open, and must not trigger a file download.</li>
      <li><strong>Malware lists</strong>: Google Safe Browsing and VirusTotal.</li>
      <li><strong>Extensions</strong>: a public GitHub source repository is required. Requested permissions in <code>manifest.json</code> are shown on the project page, and the source is scanned for patterns such as <code>eval</code> or remote scripts.</li>
    </ul>
    <p><strong>These checks filter out warning signs; they do not prove a project is safe.</strong> The site shows what was checked and when, never a "safe" label.</p>
    <p>Questions or reports: <a href="mailto:wkdrndydtlr@gmail.com">wkdrndydtlr@gmail.com</a></p>
  </main>

${footer}`;
}

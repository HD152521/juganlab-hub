// 영어 페이지(/en, /en/p/<id>, /en/submit). name_en·summary_en 이 있는 작품만 싣는다.
// 일지·도구함 본문은 한국어라서 영어 페이지에서는 한국어 페이지로 안내한다.
import { escapeHtml } from './markdown.mjs';
import { head } from './pages.mjs';
import { categoryOf } from './projects.mjs';

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

function card(s, check) {
  const open = s.url && s.status !== 'building' ? `<a class="exp-link" href="${escapeHtml(s.url)}" rel="noopener">Open <span aria-hidden="true">↗</span></a>` : '';
  return `        <article class="exp" data-type="${typeOf(s)}">
          <div class="exp-top mono"><span>${TYPE_EN[typeOf(s)]}</span><span class="status${s.status === 'building' ? '' : ` ${s.status}`}">${STATUS_EN[s.status]}</span></div>
          <h3><a class="exp-title" href="/en/p/${s.id}">${escapeHtml(s.name_en)}</a></h3>
          ${s.author ? `<span class="by mono">by ${escapeHtml(s.author)}</span>` : ''}
          <p>${escapeHtml(s.summary_en)}</p>
          ${check ? `<p class="exp-meta mono">${badge(check)}</p>` : ''}
          <div class="exp-actions"><a class="exp-detail" href="/en/p/${s.id}">Details <span aria-hidden="true">→</span></a>${open}</div>
        </article>`;
}

const alt = (korean, english) => ({ ko: korean, en: english });

export function renderEnHome(services, checks, adHead) {
  const list = services.filter(hasEnglish);
  return `${head({
    title: 'JUGAN LAB | Show your first web app, mobile app or browser extension',
    description: 'JUGAN LAB is a small marketplace where first-time makers share web apps, mobile apps and browser extensions with a development log. Listed projects go through automated link and permission checks.',
    path: '/en',
    adHead,
    lang: 'en',
    alt: alt('/', '/en'),
  })}
<body>
${nav}

  <main class="wrap">
    <section class="hero" aria-labelledby="hero-title">
      <p class="hero-label mono">JUGAN LAB · a clumsy maker market</p>
      <h1 id="hero-title">First things you built, <em>shown here</em></h1>
      <p class="hero-lede">I started building with no idea where to show my work, so I made a place for it. Share a web app, mobile app or browser extension together with the story of making it. Every listing goes through automated link, malware-list and extension-permission checks.</p>
      <div class="hero-cta"><a class="mail" href="#works">Browse projects</a><a class="ghost-link" href="/en/submit">Submit yours <span aria-hidden="true">→</span></a></div>
    </section>

    <section id="works" class="section" aria-labelledby="works-title">
      <div class="section-head"><span class="mono">01 / Works</span><h2 id="works-title">Projects</h2></div>
      <div class="experiments">
${list.map((s) => card(s, checks[s.id])).join('\n')}
      </div>
      <p class="section-lede" style="margin-top:24px">Most of the development logs and the maker toolbox are written in Korean. <a href="/">Open the Korean site</a>.</p>
    </section>
  </main>

${footer}`;
}

export function renderEnProject(s, check, adHead) {
  const live = s.url && s.status !== 'building';
  const actions = [
    live ? `<a class="mail" href="${escapeHtml(s.url)}" rel="noopener">Open ${escapeHtml(s.name_en)} <span aria-hidden="true">↗</span></a>` : '',
    ...(s.links ?? []).map((l) => `<a class="ghost-link" href="${escapeHtml(l.url)}" rel="noopener">Source / link ↗</a>`),
  ].join('');
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
    <p class="proj-note">The automated check looks at the link, malware lists and (for extensions) requested permissions. It does <strong>not</strong> guarantee safety. Review a project yourself before installing it or signing in.</p>
    <p class="proj-note">Full description and development log (Korean): <a href="/p/${s.id}" hreflang="ko" lang="ko">${escapeHtml(s.name)}</a></p>
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
    <p class="doc-lede">Web apps, mobile apps and browser extensions are all welcome, including first attempts and unfinished ones. You get a project page, and the things you ran into while building can pile up as a development log.</p>

    <h2>How</h2>
    <ol>
      <li>Fork <a href="https://github.com/HD152521/juganlab-hub">HD152521/juganlab-hub</a>.</li>
      <li>Add an entry to <code>data/services.json</code>. Use <code>type</code> web / app / extension, and fill <code>name_en</code> and <code>summary_en</code> so it appears on the English pages.</li>
      <li>Optionally add log entries to <code>data/log.json</code> (the Korean submit page has a template).</li>
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

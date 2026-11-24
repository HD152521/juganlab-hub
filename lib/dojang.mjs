// 도감 페이지: /dojang (목차), /dojang/ui (UI 도감, 실제 동작 데모), /dojang/<slug> (개발 참고 도감).
// 데이터는 data/dojang/*.json. UI 데모 자체(JS/CSS)는 src/dojang/ 에 있고 빌드가 dist/dojang/ 로 복사한다.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { escapeHtml } from './markdown.mjs';
import { SITE, footer, head, topbar } from './pages.mjs';

// UI 도감 묶음 순서(= 파일 이름). 항목 순서는 JSON 안의 순서를 따른다.
export const UI_GROUPS = ['ui-input', 'ui-overlay', 'ui-nav', 'ui-layout', 'ui-motion', 'ui-psych'];
const ID_RE = /^[a-z0-9-]+$/;

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

export function readDojang(dir) {
  const errors = [];
  const ui = UI_GROUPS.map((g) => ({ file: g, ...readJson(join(dir, `${g}.json`)) }));
  const ids = new Set();
  for (const group of ui) {
    for (const item of group.items) {
      const at = `${group.file}/${item.id}`;
      if (!ID_RE.test(item.id ?? '')) errors.push(`${at}: id 형식이 잘못됐습니다`);
      if (ids.has(item.id)) errors.push(`${at}: id 가 중복됩니다`);
      ids.add(item.id);
      if (!item.title || !item.summary) errors.push(`${at}: title·summary 가 필요합니다`);
      if (!item.when?.length || !item.avoid?.length) errors.push(`${at}: when·avoid 가 필요합니다`);
    }
  }
  const refs = readdirSync(dir)
    .filter((f) => /^ref-.+\.json$/.test(f))
    .sort()
    .map((f) => readJson(join(dir, f)));
  for (const ref of refs) {
    if (!ID_RE.test(ref.slug ?? '')) errors.push(`ref ${ref.slug}: slug 형식이 잘못됐습니다`);
    for (const s of ref.sections) for (const i of s.items) if (!i.term || !i.short) errors.push(`ref ${ref.slug}: term·short 가 필요합니다`);
  }
  if (errors.length) throw new Error(`도감 데이터 오류 ${errors.length}건\n- ${errors.join('\n- ')}`);
  return { ui, refs };
}

const countRef = (ref) => ref.sections.reduce((n, s) => n + s.items.length, 0);
const countUi = (ui) => ui.reduce((n, g) => n + g.items.length, 0);
const li = (items) => items.map((t) => `<li>${escapeHtml(t)}</li>`).join('');

export function renderDojangIndex({ ui, refs }, adHead) {
  const cards = [
    {
      href: '/dojang/ui',
      kind: 'UI · 직접 눌러 보기',
      title: 'UI 도감',
      desc: `토글 vs 체크박스부터 모달, 탭, 애니메이션까지 ${countUi(ui)}개를 실제로 동작하는 데모로 보고, 코드를 복사해 가져갑니다.`,
      meta: `${countUi(ui)}개 데모`,
    },
    ...refs.map((r) => ({ href: `/dojang/${r.slug}`, kind: '개발 참고', title: r.title.replace(/ 도감$/, '') + ' 도감', desc: r.description, meta: `${countRef(r)}개 항목` })),
  ];
  const items = cards
    .map(
      (c) => `      <a class="exp dojang-card" href="${c.href}">
        <div class="exp-top mono"><span>${escapeHtml(c.kind)}</span><span>${escapeHtml(c.meta)}</span></div>
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.desc)}</p>
        <span class="exp-cta">열어 보기 <span aria-hidden="true">→</span></span>
      </a>`,
    )
    .join('\n');
  const description = '주간실험실 도감: 실제로 동작하는 UI 데모와 HTTP 상태 코드·Git·정규식 같은 개발 참고 자료를 한곳에 모았습니다.';
  return `${head({ title: '도감 | 주간실험실', description, path: '/dojang', adHead })}
<body>
${topbar('learn')}

  <main class="doc doc-wide wrap">
    <p class="mono doc-label">Dojang · 도감</p>
    <h1>개발할 때 펼쳐 보는 도감</h1>
    <p class="doc-lede">헷갈리는 UI 요소는 직접 눌러 보며, 자주 찾는 개발 지식은 상황별로 찾아볼 수 있게 모았습니다. 모든 항목은 바로 복사해 쓸 수 있습니다.</p>
    <div class="experiments dojang-grid">
${items}
    </div>
  </main>

${footer}`;
}

function renderUiItem(item, group) {
  const search = [item.title, item.summary, group.group].join(' ').toLowerCase();
  return `      <article class="dm-item" id="${item.id}" data-group="${group.file}" data-search="${escapeHtml(search)}">
        <header>
          <span class="mono dm-group">${escapeHtml(group.group)}</span>
          <h3><a href="#${item.id}">${escapeHtml(item.title)}</a></h3>
          <p>${escapeHtml(item.summary)}</p>
        </header>
        <div class="dm-stage-wrap">
          <div class="dm-stage" data-demo="${item.id}" role="group" aria-label="${escapeHtml(item.title)} 데모"><p class="dm-noscript">이 데모는 자바스크립트가 켜져 있어야 동작합니다.</p></div>
          <div class="dm-tools"><button type="button" class="dm-btn" data-replay="${item.id}">다시 재생</button></div>
        </div>
        <details class="dm-more">
          <summary>언제 쓰고 언제 피하나</summary>
          <div class="dm-cols">
            <div><h4 class="mono">이럴 때 쓰세요</h4><ul class="dm-list good">${li(item.when)}</ul></div>
            <div><h4 class="mono">이럴 땐 피하세요</h4><ul class="dm-list bad">${li(item.avoid)}</ul></div>
          </div>
          ${item.tip ? `<p class="dm-tip"><strong>한 줄 팁</strong> ${escapeHtml(item.tip)}</p>` : ''}
        </details>
        <details class="dm-code" data-code="${item.id}">
          <summary>코드 보기·복사</summary>
          <div class="dm-code-body"></div>
        </details>
      </article>`;
}

export function renderUiDojang({ ui }, adHead) {
  const total = countUi(ui);
  const chips = [
    `<button type="button" class="filter-chip mono" data-group-filter="all" aria-pressed="true">전체 ${total}</button>`,
    ...ui.map((g) => `<button type="button" class="filter-chip mono" data-group-filter="${g.file}" aria-pressed="false">${escapeHtml(g.group)} ${g.items.length}</button>`),
  ].join('\n        ');
  const sections = ui
    .map(
      (g) => `    <section class="dm-section" data-group="${g.file}" aria-labelledby="g-${g.file}">
      <h2 id="g-${g.file}" class="dm-section-title"><span class="mono">${String(UI_GROUPS.indexOf(g.file) + 1).padStart(2, '0')}</span> ${escapeHtml(g.group)}</h2>
      <div class="dm-grid">
${g.items.map((i) => renderUiItem(i, g)).join('\n')}
      </div>
    </section>`,
    )
    .join('\n');
  const description = `토글 vs 체크박스, 토스트 vs 스낵바, 모달, 탭, 페이지네이션, 카운트업까지 UI ${total}개를 직접 눌러 보고 코드를 복사해 쓰는 UI 도감입니다.`;
  const ld = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'UI 도감',
    url: `${SITE}/dojang/ui`,
    description,
  }).replace(/</g, '\\u003c')}</script>`;
  const assets = UI_GROUPS.map((g) => `  <link rel="stylesheet" href="/dojang/${g}.css">`).join('\n');
  const scripts = [...UI_GROUPS.map((g) => `/dojang/${g}.js`), '/dojang/dojang-ui.js'].map((s) => `<script src="${s}" defer></script>`).join('\n  ');
  const extraHead = `  <link rel="stylesheet" href="/dojang/dojang.css">\n${assets}\n  ${ld}\n  ${scripts}\n`;
  return `${head({ title: 'UI 도감 | 주간실험실', description, path: '/dojang/ui', extraHead, adHead })}
<body>
${topbar('learn')}

  <main class="doc doc-wide wrap dm-page">
    <p class="mono doc-label"><a href="/dojang">도감</a> / UI</p>
    <h1>UI 도감</h1>
    <p class="doc-lede">헷갈리는 UI 요소를 직접 눌러 보고, 언제 쓰고 언제 피할지 확인한 뒤 코드를 가져가세요. 데모는 모두 이 사이트에서 직접 만든 순수 HTML·CSS·JS 입니다.</p>

    <div class="dm-bar">
      <div class="dm-chips" role="group" aria-label="묶음별로 보기">
        ${chips}
      </div>
      <label class="market-search">
        <span class="visually-hidden">UI 검색</span>
        <input type="search" id="dm-search" placeholder="예: 모달, 탭, 토글" autocomplete="off">
      </label>
    </div>
    <p class="market-empty" id="dm-empty" hidden>찾는 항목이 없습니다. 다른 단어로 검색해 보세요.</p>

${sections}
    <div class="dm-toast" id="dm-toast" role="status" aria-live="polite"></div>
  </main>

${footer}`;
}

function renderRefItem(i) {
  const search = [i.term, i.short, i.detail ?? ''].join(' ').toLowerCase();
  return `      <li class="rf-item" data-search="${escapeHtml(search)}">
        <h3>${escapeHtml(i.term)}</h3>
        <p class="rf-short">${escapeHtml(i.short)}</p>
        ${i.example ? `<div class="rf-code"><pre><code>${escapeHtml(i.example)}</code></pre><button type="button" class="dm-btn" data-copy>복사</button></div>` : ''}
        ${i.detail ? `<p class="rf-detail">${escapeHtml(i.detail)}</p>` : ''}
      </li>`;
}

// base/parent 를 바꾸면 같은 참고 페이지 틀을 다른 섹션(예: /ai)에서도 쓴다.
export function renderRef(ref, adHead, { base = '/dojang', parent = '도감', nav = 'learn' } = {}) {
  const sections = ref.sections
    .map(
      (s, n) => `    <section class="rf-section" aria-labelledby="s${n}">
      <h2 id="s${n}" class="dm-section-title">${escapeHtml(s.name)}</h2>
      <ul class="rf-list">
${s.items.map(renderRefItem).join('\n')}
      </ul>
    </section>`,
    )
    .join('\n');
  const toc = ref.sections.map((s, n) => `<a class="hint-chip mono" href="#s${n}">${escapeHtml(s.name)}</a>`).join('');
  const extraHead = `  <link rel="stylesheet" href="/dojang/dojang.css">\n  <script src="/dojang/dojang-ref.js" defer></script>\n`;
  return `${head({ title: `${ref.title} | 주간실험실`, description: ref.description, path: `${base}/${ref.slug}`, extraHead, adHead })}
<body>
${topbar(nav)}

  <main class="doc doc-wide wrap dm-page">
    <p class="mono doc-label"><a href="${base}">${escapeHtml(parent)}</a> / ${escapeHtml(ref.slug)}</p>
    <h1>${escapeHtml(ref.title)}</h1>
    <p class="doc-lede">${escapeHtml(ref.intro)}</p>
    <div class="dm-bar">
      <div class="rf-toc">${toc}</div>
      <label class="market-search">
        <span class="visually-hidden">검색</span>
        <input type="search" id="rf-search" placeholder="검색" autocomplete="off">
      </label>
    </div>
    <p class="market-empty" id="rf-empty" hidden>찾는 항목이 없습니다. 다른 단어로 검색해 보세요.</p>
${sections}
    <div class="dm-toast" id="dm-toast" role="status" aria-live="polite"></div>
  </main>

${footer}`;
}

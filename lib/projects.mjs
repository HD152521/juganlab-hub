// 작품 상세 페이지(/p/<id>): 소개·기능·사용법을 한곳에 모은다. (개발일지는 첫 올리기 버전에서 뺐다. 11-27 결정)
import { escapeHtml } from './markdown.mjs';
import { howtoOf, renderImg, screenshotsOf } from './media.mjs';
import { hasEnglish } from './en.mjs';
import { footer, head, SITE, topbar } from './pages.mjs';

export const TYPE_LABEL = { web: '웹', app: '앱', extension: '확장 프로그램' };
const STATUS_LABEL = { live: '운영 중', beta: '베타', building: '준비 중' };

// 작품 카테고리. 목록에 없는 값은 빌드가 막는다. 새 카테고리는 여기에 추가한다.
export const CATEGORIES = [
  { id: 'study', label: '학습·교육', en: 'Learning' },
  { id: 'productivity', label: '생산성·도구', en: 'Productivity' },
  { id: 'finance', label: '금융·가계', en: 'Finance' },
  { id: 'dev', label: '개발자 도구', en: 'Developer tools' },
  { id: 'ai', label: 'AI', en: 'AI' },
  { id: 'life', label: '생활·건강', en: 'Lifestyle' },
  { id: 'game', label: '게임·재미', en: 'Games & fun' },
  { id: 'creative', label: '디자인·미디어', en: 'Creative' },
  { id: 'etc', label: '기타', en: 'Other' },
];
export const categoryOf = (s) => CATEGORIES.find((c) => c.id === (s.category || 'etc')) ?? CATEGORIES.at(-1);

export const statusText = (s) => s.statusLabel || STATUS_LABEL[s.status];
export const typeOf = (s) => s.type || 'web';

const dotted = (day) => day.replaceAll('-', '.');
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

// 자동 검사 결과 배지. 안전을 보장한다는 말은 하지 않고, 무엇을 언제 봤는지만 적는다.
export function renderCheck(check) {
  if (!check) return '';
  const ok = check.result === 'pass';
  const label = ok ? `자동 검사 통과 ${dotted(check.date)}` : `검사 주의 ${dotted(check.date)}`;
  return `<span class="chk mono ${ok ? 'chk-pass' : 'chk-warn'}" title="${escapeHtml((check.items ?? []).join(' · '))}">${escapeHtml(label)}</span>`;
}

function renderChecks(check) {
  if (!check) return '';
  return `
      <h2>자동 검사</h2>
      <p class="proj-note">올라온 주소와 파일을 자동으로 확인한 결과입니다. <strong>안전을 보장하는 것은 아닙니다.</strong> 설치하거나 로그인하기 전에 직접 확인하세요.</p>
      <ul class="chk-list">${(check.items ?? []).map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
}

const renderFeatures = (features = []) =>
  features.length
    ? `
      <h2>주요 기능</h2>
      <ul class="feature-list">${features.map((f) => `<li><strong>${escapeHtml(f.title)}</strong>${f.desc ? `<span>${escapeHtml(f.desc)}</span>` : ''}</li>`).join('')}</ul>`
    : '';

const renderGroups = (groups = []) =>
  groups.length
    ? `
      <h2>다루는 내용</h2>
      ${groups.map((g) => `<div class="group"><h4 class="mono">${escapeHtml(g.name)}</h4><ul class="chips">${g.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul></div>`).join('')}`
    : '';

// 사용법 단계. 단계마다 설명 문장과 (있으면) 화면 이미지를 붙인다.
const renderHowto = (s) => {
  const steps = howtoOf(s);
  if (!steps.length) return '';
  const items = steps
    .map((h) => `<li><p>${escapeHtml(h.text)}</p>${h.image ? `<figure class="step-shot">${renderImg(h.image, '', { width: 960, height: 600 })}</figure>` : ''}</li>`)
    .join('');
  return `
      <h2>${s.status === 'building' ? '이렇게 쓰게 됩니다' : '사용 방법'}</h2>
      <ol class="steps">${items}</ol>`;
};

// 스크린샷 갤러리. 없으면 자리만 보여 준다(올라오면 같은 자리에 채워진다).
export const SHOTS_TEXT = {
  ko: { empty: '아직 올라온 스크린샷이 없습니다. 만든 사람이 올리면 이 자리에 보입니다.', label: (n) => `스크린샷 ${n}장`, list: '스크린샷 목록, 좌우로 넘겨 보세요', alt: (name, i) => `${name} 스크린샷 ${i}` },
  en: { empty: 'No screenshots yet. They appear here once the maker adds them.', label: (n) => `${n} screenshots`, list: 'Screenshots, scroll sideways', alt: (name, i) => `${name} screenshot ${i}` },
};

export function renderShots(s, lang = 'ko') {
  const T = SHOTS_TEXT[lang];
  const name = lang === 'en' ? s.name_en : s.name;
  const shots = screenshotsOf(s);
  if (!shots.length) {
    return `
    <section class="shots shots-empty">
      <div class="shot-ph" aria-hidden="true"></div><div class="shot-ph" aria-hidden="true"></div>
      <p>${T.empty}</p>
    </section>`;
  }
  return `
    <section class="shots" aria-label="${T.label(shots.length)}">
      <ul class="shots-list" tabindex="0" aria-label="${T.list}">${shots
        .map((x, i) => `<li><figure>${renderImg(x.src, x.caption || T.alt(name, i + 1), { width: 960, height: 600, eager: i === 0 })}${x.caption ? `<figcaption>${escapeHtml(x.caption)}</figcaption>` : ''}</figure></li>`)
        .join('')}</ul>
    </section>`;
}

export const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};
// 외부 링크는 항상 같은 속성과 표시를 쓴다
export const EXT_REL = 'noopener noreferrer nofollow ugc';

export function renderProject(s, entries, check, adHead) {
  const path = `/p/${s.id}`;
  const live = s.url && s.status !== 'building';
  const ld = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: s.name,
    description: s.summary,
    applicationCategory: typeOf(s) === 'extension' ? 'BrowserApplication' : typeOf(s) === 'app' ? 'MobileApplication' : 'WebApplication',
    url: `${SITE}${path}`,
    ...(live ? { sameAs: s.url } : {}),
  });
  const host = live ? hostOf(s.url) : '';
  const actions = [
    live ? `<a class="mail" href="${escapeHtml(s.url)}" rel="${EXT_REL}" title="외부 사이트로 이동: ${escapeHtml(host)}">${escapeHtml(s.name)} 열기 <span aria-hidden="true">↗</span></a>` : '',
    ...(s.links ?? []).map((l) => `<a class="ghost-link" href="${escapeHtml(l.url)}" rel="${EXT_REL}" title="외부 사이트로 이동: ${escapeHtml(hostOf(l.url))}">${escapeHtml(l.label)} ↗</a>`),
  ].join('');
  const extNote = actions
    ? `<p class="ext-note"><span class="ext-tag mono">외부로 이동</span> 위 버튼과 링크는 <strong>만든 사람이 올린 외부 주소</strong>${host ? `(${escapeHtml(host)})` : ''}로 이동합니다. 운영자가 그 내용을 보증하지 않으니, 설치하거나 로그인하기 전에 직접 확인하세요.</p>`
    : '';
  const stats = (s.stats ?? []).length
    ? `<dl class="stats">${s.stats.map((x) => `<div><dt>${escapeHtml(x.label)}</dt><dd>${x.value.toLocaleString('ko-KR')}</dd></div>`).join('')}</dl>`
    : '';
  return `${head({
    title: `${s.name} | 주간실험실`,
    description: s.summary.slice(0, 150),
    path,
    extraHead: `  ${ld}\n`,
    adHead,
    alt: hasEnglish(s) ? { ko: path, en: `/en${path}` } : undefined,
  })}
<body>
${topbar('home')}

  <main class="doc wrap">
    <p class="mono doc-label"><a href="/#market">작품</a> · ${TYPE_LABEL[typeOf(s)]} · ${categoryOf(s).label} · ${escapeHtml(statusText(s))}</p>
    <h1>${escapeHtml(s.name)}</h1>
    <p class="proj-by mono">${s.author ? `by ${escapeHtml(s.author)}` : ''}${s.since ? `${s.author ? ' · ' : ''}${dotted(s.since)} 시작` : ''} ${renderCheck(check)}</p>
    <p class="doc-lede">${escapeHtml(s.summary)}</p>
    ${(s.tags ?? []).length ? `<ul class="tags">${s.tags.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
    ${stats}
    ${actions ? `<div class="proj-actions">${actions}</div>` : ''}
    ${extNote}${renderShots(s)}
${renderFeatures(s.features)}${renderGroups(s.groups)}${renderHowto(s)}${renderChecks(check)}
  </main>

${footer}`;
}

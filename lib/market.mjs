// 홈의 "올라온 작품" 영역(카드·검색·필터·정렬 막대)과 "어떻게 돌아가나" 안내. 한국어·영어 홈이 함께 쓴다.
// 이 파일은 다른 lib 을 불러오지 않는다. 언어별 문구와 라벨은 호출하는 쪽이 넘긴다.
import { escapeHtml } from './markdown.mjs';
import { renderThumb } from './media.mjs';

export const PAGE_SIZE = 12;

export const MARKET_TEXT = {
  ko: {
    all: '전체',
    allCats: '모든 분야',
    searchLabel: '작품 검색',
    searchPh: '이름·만든 사람·태그 검색',
    typeGroup: '종류별로 보기',
    catLabel: '분야',
    sortLabel: '정렬',
    sorts: [['new', '최신순'], ['name', '이름순']],
    total: '총 {n}개',
    found: '{n}개 찾음',
    more: '더 보기 ({n}개 남음)',
    empty: '찾는 작품이 없습니다. 다른 단어로 검색하거나 필터를 풀어 보세요.',
    by: 'by',
    logs: '일지',
    since: '시작',
    slot: ['웹 · 앱 · 확장 프로그램', '여기에 내 작품 올리기', '처음 만든 것도 괜찮습니다. 올리면 이 자리에 카드가 생깁니다.', '올리는 방법 →'],
  },
  en: {
    all: 'All',
    allCats: 'All categories',
    searchLabel: 'Search projects',
    searchPh: 'Search by name, maker or tag',
    typeGroup: 'Filter by type',
    catLabel: 'Category',
    sortLabel: 'Sort',
    sorts: [['new', 'Newest'], ['name', 'Name']],
    total: '{n} projects',
    found: '{n} found',
    more: 'Show more ({n} left)',
    empty: 'No projects match. Try another word or clear the filters.',
    by: 'by',
    logs: 'log',
    since: 'since',
    slot: ['Web · App · Extension', 'Your project goes here', 'A first attempt is fine. Submit it and a card appears in this spot.', 'How to submit →'],
  },
};

const fill = (tpl, n) => tpl.replace('{n}', String(n));

// 카드 한 장. 카드 전체가 작품 페이지로 가는 링크다(제목 링크를 ::after 로 덮는다).
// item: { s, id, href, name, summary, type, typeLabel, cat, catLabel, statusClass, statusText, logCount, badge, ping }
export function renderCard(item, index, lang) {
  const L = MARKET_TEXT[lang];
  const { s } = item;
  const search = [item.name, item.summary, s.author, item.catLabel, item.typeLabel, ...(s.tags ?? [])].filter(Boolean).join(' ').toLowerCase();
  const meta = [
    s.author ? `${L.by} ${escapeHtml(s.author)}` : '',
    item.badge,
  ].filter(Boolean).join(' ');
  const ping = item.ping ? ` data-ping="${escapeHtml(item.ping)}"` : '';
  return `        <article class="exp exp-c" id="svc-${s.id}" data-type="${item.type}" data-cat="${item.cat}" data-since="${escapeHtml(s.since ?? '')}" data-name="${escapeHtml(item.name.toLowerCase())}" data-idx="${index}" data-search="${escapeHtml(search)}">
          ${renderThumb(s, { type: item.type, cat: item.cat, kindLabel: item.typeLabel })}
          <div class="exp-body">
            <div class="exp-top mono">
              <span>${escapeHtml(item.catLabel)}</span>
              <span class="${item.statusClass}"${ping}>${escapeHtml(item.statusText)}</span>
            </div>
            <h3><a class="exp-title" href="${item.href}">${escapeHtml(item.name)}</a></h3>
            <p>${escapeHtml(item.summary)}</p>
            ${meta ? `<p class="exp-meta mono">${meta}</p>` : ''}
          </div>
        </article>`;
}

// 목록 끝의 "내 작품" 자리. 검색·필터 중에는 스크립트가 숨긴다.
export function renderSlot(lang, submitHref) {
  const [top, title, desc, link] = MARKET_TEXT[lang].slot;
  return `        <a class="exp exp-c exp-slot" href="${submitHref}" data-slot>
          <div class="exp-thumb ph ph-slot" aria-hidden="true"><span class="ph-glyph">+</span></div>
          <div class="exp-body">
            <div class="exp-top mono"><span>${escapeHtml(top)}</span></div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(desc)}</p>
            <p class="exp-meta mono">${escapeHtml(link)}</p>
          </div>
        </a>`;
}

// 검색 + 종류 칩 + 분야·정렬 선택 + 개수 줄 + 더 보기 버튼. 스크립트가 없어도 목록은 전부 보인다.
// types: [[id, label]], cats: [[id, label]]
export function renderMarketBar(services, { lang, types, cats, typeOf, catOf }) {
  const L = MARKET_TEXT[lang];
  const chip = (value, label, pressed, n) =>
    `<button type="button" class="filter-chip market-chip mono" data-type-filter="${value}" aria-pressed="${pressed}"${n === 0 ? ' data-empty' : ''}>${escapeHtml(label)} <span class="chip-n">${n}</span></button>`;
  const typeChips = [chip('all', L.all, true, services.length), ...types.map(([id, label]) => chip(id, label, false, services.filter((s) => typeOf(s) === id).length))].join('\n          ');
  const catOpts = [`<option value="all">${escapeHtml(L.allCats)} (${services.length})</option>`, ...cats.map(([id, label]) => `<option value="${id}">${escapeHtml(label)} (${services.filter((s) => catOf(s) === id).length})</option>`)].join('');
  const sortOpts = L.sorts.map(([v, label]) => `<option value="${v}">${escapeHtml(label)}</option>`).join('');
  return `      <div class="market-bar" id="market-bar" data-page="${PAGE_SIZE}" data-t-total="${escapeHtml(L.total)}" data-t-found="${escapeHtml(L.found)}" data-t-more="${escapeHtml(L.more)}">
        <label class="market-search">
          <span class="visually-hidden">${escapeHtml(L.searchLabel)}</span>
          <input type="search" id="market-search" placeholder="${escapeHtml(L.searchPh)}" autocomplete="off">
        </label>
        <div class="market-types" role="group" aria-label="${escapeHtml(L.typeGroup)}">
          ${typeChips}
        </div>
        <label class="market-sel"><span class="mono">${escapeHtml(L.catLabel)}</span><select id="market-cat">${catOpts}</select></label>
        <label class="market-sel"><span class="mono">${escapeHtml(L.sortLabel)}</span><select id="market-sort">${sortOpts}</select></label>
      </div>
      <p class="market-count mono" id="market-count" aria-live="polite">${escapeHtml(fill(L.total, services.length))}</p>
      <p class="market-empty" id="market-empty" hidden>${escapeHtml(L.empty)}</p>`;
}

export const renderMoreButton = (lang) =>
  `      <p class="market-more-wrap"><button type="button" class="market-more mono" id="market-more" hidden>${escapeHtml(fill(MARKET_TEXT[lang].more, 0))}</button></p>`;

// 어떻게 돌아가는지 4단계. 자동 검사는 보증이 아니라는 점을 숨기지 않는다.
const HOW = {
  ko: {
    title: '어떻게 돌아가나요',
    steps: [
      ['올리기', '작품 소개와 링크를 올립니다. 웹·앱·확장 프로그램 모두 됩니다.'],
      ['자동 검사', '주소가 열리는지, 위험 목록에 있는지, 확장 프로그램 권한은 무엇인지 기계가 봅니다.'],
      ['공개', '통과하면 작품 페이지가 생기고 누구나 둘러보고 써 볼 수 있습니다.'],
    ],
    note: '자동 검사는 위험 신호를 거르는 것이지 안전을 보장하지 않습니다.',
    more: '올리는 방법 보기',
  },
  en: {
    title: 'How it works',
    steps: [
      ['Submit', 'Add your project and its link. Web apps, mobile apps and browser extensions all work.'],
      ['Automated check', 'Machines check that the link opens, whether it is on malware lists, and what an extension asks for.'],
      ['Published', 'Once it passes, a project page appears and anyone can browse and try it.'],
    ],
    note: 'The check filters out warning signs. It does not guarantee safety.',
    more: 'How to submit',
  },
};

export function renderHow(lang, submitHref) {
  const h = HOW[lang];
  return `<aside class="how" aria-labelledby="how-title">
        <h2 id="how-title" class="how-title mono">${escapeHtml(h.title)}</h2>
        <ol class="how-steps">
${h.steps.map(([t, d]) => `          <li><strong>${escapeHtml(t)}</strong><span>${escapeHtml(d)}</span></li>`).join('\n')}
        </ol>
        <p class="how-note">${escapeHtml(h.note)} <a href="${submitHref}">${escapeHtml(h.more)} <span aria-hidden="true">→</span></a></p>
      </aside>`;
}

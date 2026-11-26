// 작품 목록의 검색·종류·분야 필터·정렬·더 보기. 한국어·영어 홈이 같이 쓴다.
// 스크립트가 없으면 모든 카드가 그대로 보이고 막대의 입력은 쓰이지 않는다.
(() => {
  'use strict';

  const grid = document.getElementById('market-grid');
  const bar = document.getElementById('market-bar');
  if (!grid || !bar) return;

  const cards = [...grid.querySelectorAll('.exp[data-type]')];
  const slot = grid.querySelector('[data-slot]');
  const typeChips = [...bar.querySelectorAll('[data-type-filter]')];
  const search = document.getElementById('market-search');
  const catSel = document.getElementById('market-cat');
  const sortSel = document.getElementById('market-sort');
  const count = document.getElementById('market-count');
  const empty = document.getElementById('market-empty');
  const more = document.getElementById('market-more');
  const pageSize = Number(bar.dataset.page) || 12;
  const tpl = (key, n) => (bar.dataset[key] || '{n}').replace('{n}', String(n));

  const collator = new Intl.Collator(document.documentElement.lang || 'ko');
  const sorters = {
    new: (a, b) => (b.dataset.since || '').localeCompare(a.dataset.since || '') || a.dataset.idx - b.dataset.idx,
    name: (a, b) => collator.compare(a.dataset.name, b.dataset.name),
    logs: (a, b) => b.dataset.logs - a.dataset.logs || a.dataset.idx - b.dataset.idx,
  };

  let type = 'all';
  let limit = pageSize;

  const render = () => {
    const q = (search?.value || '').trim().toLowerCase();
    const cat = catSel?.value || 'all';
    const filtering = Boolean(q) || type !== 'all' || cat !== 'all';
    const matched = cards
      .filter((c) => (type === 'all' || c.dataset.type === type) && (cat === 'all' || c.dataset.cat === cat) && (!q || c.dataset.search.includes(q)))
      .sort(sorters[sortSel?.value] || sorters.new);

    // 정렬 결과대로 DOM 순서를 바꾼다. 맞지 않는 카드는 뒤에서 숨긴다.
    const matchedSet = new Set(matched);
    [...matched, ...cards.filter((c) => !matchedSet.has(c))].forEach((c) => grid.append(c));
    if (slot) grid.append(slot);

    matched.forEach((c, i) => (c.hidden = i >= limit));
    cards.forEach((c) => {
      if (!matchedSet.has(c)) c.hidden = true;
    });
    if (slot) slot.hidden = filtering;

    if (count) count.textContent = tpl(filtering ? 'tFound' : 'tTotal', matched.length);
    if (empty) empty.hidden = matched.length !== 0;
    if (more) {
      const rest = matched.length - limit;
      more.hidden = rest <= 0;
      more.textContent = tpl('tMore', Math.max(rest, 0));
    }
  };

  const reset = () => {
    limit = pageSize;
    render();
  };

  typeChips.forEach((chip) =>
    chip.addEventListener('click', () => {
      type = chip.dataset.typeFilter;
      typeChips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      reset();
    }),
  );
  search?.addEventListener('input', reset);
  catSel?.addEventListener('change', reset);
  sortSel?.addEventListener('change', reset);
  more?.addEventListener('click', () => {
    // 더 보기를 누르면 새로 나온 첫 카드로 초점을 옮긴다(키보드 사용자가 길을 잃지 않게)
    const before = limit;
    limit += pageSize;
    render();
    const firstNew = [...grid.querySelectorAll('.exp[data-type]:not([hidden])')][before];
    firstNew?.querySelector('a')?.focus({ preventScroll: false });
  });

  render();
})();

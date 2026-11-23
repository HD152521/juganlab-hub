// 개발 참고 도감 런타임: 검색과 예시 복사.
(() => {
  'use strict';

  const toastEl = document.getElementById('dm-toast');
  let timer = 0;
  const toast = (message) => {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  };

  document.querySelectorAll('[data-copy]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const text = btn.parentElement.querySelector('code').textContent;
      try {
        await navigator.clipboard.writeText(text);
        toast('복사했습니다');
      } catch {
        toast('복사하지 못했습니다. 코드를 직접 선택해 복사하세요');
      }
    }),
  );

  const items = [...document.querySelectorAll('.rf-item')];
  const sections = [...document.querySelectorAll('.rf-section')];
  const search = document.getElementById('rf-search');
  const empty = document.getElementById('rf-empty');
  search?.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    items.forEach((item) => {
      const ok = !q || item.dataset.search.includes(q);
      item.hidden = !ok;
      if (ok) shown += 1;
    });
    sections.forEach((s) => (s.hidden = !s.querySelector('.rf-item:not([hidden])')));
    if (empty) empty.hidden = shown !== 0;
  });
})();

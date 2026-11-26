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

  // "/" 로 검색창 이동, Esc 로 비우기
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/^(input|textarea|select)$/i.test(document.activeElement?.tagName ?? '') && search) {
      e.preventDefault();
      search.focus();
    }
  });
  search?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      search.value = '';
      search.dispatchEvent(new Event('input'));
    }
  });

  // 목차: 지금 읽는 섹션 표시
  const links = [...document.querySelectorAll('.rf-toc a')];
  if (links.length && 'IntersectionObserver' in window) {
    const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const mark = (id) => links.forEach((a) => (a === byId.get(id) ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => en.isIntersecting && mark(en.target.id)),
      { rootMargin: '-80px 0px -65% 0px' },
    );
    sections.forEach((s) => io.observe(s));
  }
})();

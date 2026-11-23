// UI 도감 페이지 런타임: 데모를 화면에 보일 때 mount, 다시 재생, 코드 탭·복사, 묶음 필터·검색.
// 데모는 window.JL_DEMOS[id] = { mount(stage), code: { html, css, js } } 형태로 등록돼 있다.
(() => {
  'use strict';

  const demos = window.JL_DEMOS || {};
  const toastEl = document.getElementById('dm-toast');
  let toastTimer = 0;

  const toast = (message) => {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('복사했습니다');
    } catch {
      // 클립보드 권한이 없으면 선택 가능한 상태로 두고 안내한다
      toast('복사하지 못했습니다. 코드를 직접 선택해 복사하세요');
    }
  };

  // ── 데모 mount: 화면 가까이 올 때 한 번. 오류가 나도 다른 데모에는 영향이 없다 ──
  const mount = (stage) => {
    const id = stage.dataset.demo;
    const demo = demos[id];
    stage.replaceChildren();
    if (!demo) {
      stage.textContent = '이 데모는 준비 중입니다.';
      return;
    }
    try {
      demo.mount(stage);
    } catch (error) {
      console.error(`[dojang] ${id}`, error);
      stage.textContent = '데모를 불러오지 못했습니다.';
    }
  };

  const stages = [...document.querySelectorAll('.dm-stage[data-demo]')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          mount(entry.target);
        }
      },
      { rootMargin: '300px 0px' },
    );
    stages.forEach((s) => observer.observe(s));
  } else {
    stages.forEach(mount);
  }

  document.querySelectorAll('[data-replay]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const stage = document.querySelector(`.dm-stage[data-demo="${btn.dataset.replay}"]`);
      if (stage) mount(stage);
    }),
  );

  // ── 코드 보기: 처음 열 때 탭을 만든다(HTML/CSS/JS 중 있는 것만) ──
  const LABEL = { html: 'HTML', css: 'CSS', js: 'JS' };
  const buildCode = (details) => {
    const body = details.querySelector('.dm-code-body');
    if (body.childElementCount) return;
    const code = demos[details.dataset.code]?.code;
    const keys = code ? ['html', 'css', 'js'].filter((k) => code[k]) : [];
    if (!keys.length) {
      body.textContent = '코드는 준비 중입니다.';
      return;
    }
    const tabs = document.createElement('div');
    tabs.className = 'dm-tabs';
    tabs.setAttribute('role', 'tablist');
    const pre = document.createElement('pre');
    const codeEl = document.createElement('code');
    pre.append(codeEl);
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'dm-btn dm-copy';
    copyBtn.textContent = '복사';
    let current = keys[0];

    const show = (key) => {
      current = key;
      codeEl.textContent = code[key].trim();
      tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.key === key)));
    };
    keys.forEach((key) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.role = 'tab';
      b.dataset.key = key;
      b.textContent = LABEL[key];
      b.addEventListener('click', () => show(key));
      tabs.append(b);
    });
    copyBtn.addEventListener('click', () => copy(code[current].trim()));
    tabs.append(copyBtn);
    body.append(tabs, pre);
    show(current);
  };
  document.querySelectorAll('details.dm-code').forEach((d) => d.addEventListener('toggle', () => d.open && buildCode(d)));

  // ── 묶음 필터 + 검색 ──
  const items = [...document.querySelectorAll('.dm-item')];
  const sections = [...document.querySelectorAll('.dm-section')];
  const chips = [...document.querySelectorAll('[data-group-filter]')];
  const search = document.getElementById('dm-search');
  const empty = document.getElementById('dm-empty');
  let group = 'all';

  const render = () => {
    const q = (search?.value || '').trim().toLowerCase();
    let shown = 0;
    items.forEach((item) => {
      const ok = (group === 'all' || item.dataset.group === group) && (!q || item.dataset.search.includes(q));
      item.hidden = !ok;
      if (ok) shown += 1;
    });
    sections.forEach((s) => (s.hidden = !s.querySelector('.dm-item:not([hidden])')));
    if (empty) empty.hidden = shown !== 0;
  };
  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      group = chip.dataset.groupFilter;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      render();
    }),
  );
  search?.addEventListener('input', render);

  // 주소 해시(#toast-vs-snackbar)로 들어오면 그 항목으로 이동한다. 지연 mount 때문에 레이아웃이 밀릴 수 있어 한 번 더 맞춘다.
  if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) setTimeout(() => target.scrollIntoView(), 300);
  }
})();

(function () {
  'use strict';
  window.JL_DEMOS = window.JL_DEMOS || {};

  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const $ = (r, s) => r.querySelector(s);
  const $$ = (r, s) => Array.from(r.querySelectorAll(s));
  function flash(e) {
    e.classList.remove('is-flash');
    void e.offsetWidth;
    e.classList.add('is-flash');
  }
  function reg(id, mount, code) {
    window.JL_DEMOS[id] = {
      mount(stage) {
        stage.textContent = '';
        mount(stage, 'dm-' + id + '-');
      },
      code,
    };
  }

  /* ───────── 토글 vs 체크박스 ───────── */
  reg('toggle-vs-checkbox', (stage, p) => {
    stage.innerHTML = `
<div class="${p}wrap">
  <section class="${p}panel">
    <h4 class="${p}label">토글 · 즉시 적용</h4>
    <p class="${p}sub">누르는 순간 설정이 바뀝니다. 저장 버튼이 없습니다.</p>
    <div class="${p}row"><span>푸시 알림</span>
      <button type="button" role="switch" aria-checked="false" aria-label="푸시 알림" class="${p}switch" data-name="푸시 알림"><span class="${p}knob"></span></button></div>
    <div class="${p}row"><span>다크 모드</span>
      <button type="button" role="switch" aria-checked="false" aria-label="다크 모드" class="${p}switch" data-name="다크 모드"><span class="${p}knob"></span></button></div>
    <p class="${p}out" role="status" aria-live="polite">눌러 보세요. 바로 반영됩니다.</p>
  </section>
  <section class="${p}panel">
    <h4 class="${p}label">체크박스 · 제출해야 적용</h4>
    <p class="${p}sub">고른 뒤 '저장'을 눌러야 반영됩니다.</p>
    <label class="${p}row"><span>이메일 수신</span><input type="checkbox" class="${p}check" data-name="이메일"></label>
    <label class="${p}row"><span>문자 수신</span><input type="checkbox" class="${p}check" data-name="문자"></label>
    <label class="${p}row"><span>광고 수신</span><input type="checkbox" class="${p}check" data-name="광고"></label>
    <div class="${p}foot"><button type="button" class="dm-btn primary ${p}save" disabled>저장</button>
    <p class="${p}out" role="status" aria-live="polite">변경 없음</p></div>
  </section>
</div>`;
    const [left, right] = $$(stage, '.' + p + 'panel');
    const leftOut = $(left, '.' + p + 'out');
    $$(left, '.' + p + 'switch').forEach((sw) => {
      sw.addEventListener('click', () => {
        const on = sw.getAttribute('aria-checked') !== 'true';
        sw.setAttribute('aria-checked', String(on));
        leftOut.textContent = sw.dataset.name + ' ' + (on ? '켜짐' : '꺼짐') + ' · 바로 적용됨';
        flash(leftOut);
      });
    });
    const checks = $$(right, '.' + p + 'check');
    const save = $(right, '.' + p + 'save');
    const rightOut = $(right, '.' + p + 'out');
    let saved = checks.map(() => false);
    function dirtyCount() {
      return checks.filter((c, i) => c.checked !== saved[i]).length;
    }
    checks.forEach((c) =>
      c.addEventListener('change', () => {
        const n = dirtyCount();
        save.disabled = n === 0;
        rightOut.textContent = n ? '저장 전 · 변경 ' + n + '개 대기 중' : '변경 없음';
        flash(rightOut);
      })
    );
    save.addEventListener('click', () => {
      saved = checks.map((c) => c.checked);
      save.disabled = true;
      rightOut.textContent = '저장됨 · ' + (saved.filter(Boolean).length) + '개 수신 중';
      flash(rightOut);
    });
  }, {
    html: `<label>푸시 알림
  <button type="button" role="switch" aria-checked="false" id="sw"><span></span></button>
</label>
<p id="swOut" role="status"></p>

<form id="form">
  <label><input type="checkbox" name="mail"> 이메일 수신</label>
  <label><input type="checkbox" name="sms"> 문자 수신</label>
  <button disabled>저장</button>
  <p id="formOut" role="status"></p>
</form>`,
    css: `[role="switch"] { width: 46px; height: 26px; border: 0; border-radius: 999px;
  background: #ccc; padding: 3px; cursor: pointer; transition: background .2s; }
[role="switch"] span { display: block; width: 20px; height: 20px; border-radius: 50%;
  background: #fff; transition: transform .25s; }
[role="switch"][aria-checked="true"] { background: #e8572a; }
[role="switch"][aria-checked="true"] span { transform: translateX(20px); }
[role="switch"]:focus-visible { outline: 2px solid #e8572a; outline-offset: 2px; }`,
    js: `const sw = document.getElementById('sw');
sw.addEventListener('click', () => {
  const on = sw.getAttribute('aria-checked') !== 'true';
  sw.setAttribute('aria-checked', String(on));
  // 토글은 누르는 즉시 적용합니다
  document.getElementById('swOut').textContent = on ? '켜짐 (적용됨)' : '꺼짐 (적용됨)';
});

const form = document.getElementById('form');
form.addEventListener('change', () => { form.querySelector('button').disabled = false; });
form.addEventListener('submit', (e) => {
  e.preventDefault(); // 체크박스는 제출할 때 한꺼번에 적용합니다
  form.querySelector('button').disabled = true;
  document.getElementById('formOut').textContent = '저장됨';
});`,
  });

  /* ───────── 라디오 vs 체크박스 ───────── */
  reg('radio-vs-checkbox', (stage, p) => {
    stage.innerHTML = `
<div class="${p}wrap">
  <fieldset class="${p}panel">
    <legend class="${p}label">라디오 · 하나만</legend>
    <p class="${p}sub">배송 방법 (반드시 하나)</p>
    <label class="${p}row"><input type="radio" name="${p}ship" class="${p}radio" value="일반배송" checked><span>일반배송</span></label>
    <label class="${p}row"><input type="radio" name="${p}ship" class="${p}radio" value="새벽배송"><span>새벽배송</span></label>
    <label class="${p}row"><input type="radio" name="${p}ship" class="${p}radio" value="매장 픽업"><span>매장 픽업</span></label>
    <p class="${p}out" role="status" aria-live="polite">선택: 일반배송</p>
  </fieldset>
  <fieldset class="${p}panel">
    <legend class="${p}label">체크박스 · 여러 개</legend>
    <p class="${p}sub">받을 알림 (0개도 가능)</p>
    <label class="${p}row"><input type="checkbox" class="${p}check" value="주문 상태"><span>주문 상태</span></label>
    <label class="${p}row"><input type="checkbox" class="${p}check" value="할인 소식"><span>할인 소식</span></label>
    <label class="${p}row"><input type="checkbox" class="${p}check" value="리뷰 요청"><span>리뷰 요청</span></label>
    <p class="${p}out" role="status" aria-live="polite">선택: 없음</p>
  </fieldset>
</div>`;
    const [a, b] = $$(stage, '.' + p + 'panel');
    const outA = $(a, '.' + p + 'out');
    $$(a, 'input').forEach((r) =>
      r.addEventListener('change', () => {
        outA.textContent = '선택: ' + r.value;
        flash(outA);
      })
    );
    const outB = $(b, '.' + p + 'out');
    const boxes = $$(b, 'input');
    boxes.forEach((c) =>
      c.addEventListener('change', () => {
        const v = boxes.filter((x) => x.checked).map((x) => x.value);
        outB.textContent = '선택: ' + (v.length ? v.join(', ') : '없음');
        flash(outB);
      })
    );
  }, {
    html: `<fieldset>
  <legend>배송 방법</legend>
  <label><input type="radio" name="ship" value="일반배송" checked> 일반배송</label>
  <label><input type="radio" name="ship" value="새벽배송"> 새벽배송</label>
  <label><input type="radio" name="ship" value="픽업"> 매장 픽업</label>
</fieldset>

<fieldset>
  <legend>받을 알림</legend>
  <label><input type="checkbox" name="n" value="order"> 주문 상태</label>
  <label><input type="checkbox" name="n" value="sale"> 할인 소식</label>
</fieldset>
<p id="out"></p>`,
    css: `fieldset { margin-bottom: 12px; }
label { display: block; padding: 6px 0; cursor: pointer; }
input[type="radio"], input[type="checkbox"] { accent-color: #e8572a; margin-right: 6px; }`,
    js: `const out = document.getElementById('out');
document.addEventListener('change', () => {
  const ship = document.querySelector('input[name="ship"]:checked').value;
  const alerts = [...document.querySelectorAll('input[name="n"]:checked')].map((c) => c.value);
  out.textContent = '배송: ' + ship + ' / 알림: ' + (alerts.join(', ') || '없음');
});`,
  });

  /* ───────── 드롭다운 vs 피커 ───────── */
  reg('dropdown-vs-picker', (stage, p) => {
    const cities = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종'];
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const mins = ['00', '10', '20', '30', '40', '50'];
    stage.innerHTML = `
<div class="${p}wrap">
  <section class="${p}panel">
    <h4 class="${p}label">드롭다운 · 목록에서 고르기</h4>
    <p class="${p}sub">항목이 이름으로 구별될 때. 눌러서 펼칩니다.</p>
    <div class="${p}dd">
      <button type="button" class="${p}trigger" aria-haspopup="listbox" aria-expanded="false"><span class="${p}value">도시 선택</span><span class="${p}caret" aria-hidden="true"></span></button>
      <ul class="${p}menu" role="listbox" aria-label="도시" hidden>${cities
        .map((c) => `<li role="option" tabindex="-1" aria-selected="false">${c}</li>`)
        .join('')}</ul>
    </div>
    <p class="${p}out" role="status" aria-live="polite">선택: 없음</p>
  </section>
  <section class="${p}panel">
    <h4 class="${p}label">피커 · 돌려서 고르기</h4>
    <p class="${p}sub">값이 연속적인 숫자일 때. 스크롤하거나 ↑↓ 키.</p>
    <div class="${p}wheels">
      <div class="${p}wheel" tabindex="0" role="spinbutton" aria-label="시" aria-valuemin="0" aria-valuemax="23" aria-valuenow="0" data-kind="h">${hours.map((h) => `<div class="${p}it">${h}</div>`).join('')}</div>
      <span class="${p}colon" aria-hidden="true">:</span>
      <div class="${p}wheel" tabindex="0" role="spinbutton" aria-label="분" aria-valuemin="0" aria-valuemax="50" aria-valuenow="0" data-kind="m">${mins.map((m) => `<div class="${p}it">${m}</div>`).join('')}</div>
      <div class="${p}band" aria-hidden="true"></div>
    </div>
    <p class="${p}out" role="status" aria-live="polite">시각: 00:00</p>
  </section>
</div>`;
    // 드롭다운
    const dd = $(stage, '.' + p + 'dd');
    const trigger = $(dd, '.' + p + 'trigger');
    const menu = $(dd, '.' + p + 'menu');
    const opts = $$(menu, 'li');
    const ddOut = $(stage, '.' + p + 'out');
    let selected = -1;
    const open = () => {
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      (opts[selected] || opts[0]).focus();
    };
    const close = (back) => {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (back) trigger.focus();
    };
    const choose = (i) => {
      selected = i;
      opts.forEach((o, k) => o.setAttribute('aria-selected', String(k === i)));
      $(trigger, '.' + p + 'value').textContent = opts[i].textContent;
      ddOut.textContent = '선택: ' + opts[i].textContent;
      flash(ddOut);
      close(true);
    };
    trigger.addEventListener('click', () => (menu.hidden ? open() : close(true)));
    opts.forEach((o, i) => o.addEventListener('click', () => choose(i)));
    menu.addEventListener('keydown', (e) => {
      const i = opts.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); opts[Math.min(i + 1, opts.length - 1)].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); opts[Math.max(i - 1, 0)].focus(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (i >= 0) choose(i); }
      else if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') close(false);
    });
    stage.addEventListener('click', (e) => { if (!dd.contains(e.target) && !menu.hidden) close(false); });

    // 피커
    const ROW = 36;
    const pickOut = $$(stage, '.' + p + 'out')[1];
    const wheels = $$(stage, '.' + p + 'wheel');
    const vals = ['00', '00'];
    wheels.forEach((w, wi) => {
      const items = $$(w, '.' + p + 'it');
      const sync = () => {
        const i = Math.max(0, Math.min(items.length - 1, Math.round(w.scrollTop / ROW)));
        items.forEach((it, k) => it.classList.toggle('is-on', k === i));
        vals[wi] = items[i].textContent;
        w.setAttribute('aria-valuenow', String(wi === 0 ? i : i * 10));
        w.setAttribute('aria-valuetext', items[i].textContent + (wi === 0 ? '시' : '분'));
        pickOut.textContent = '시각: ' + vals[0] + ':' + vals[1];
      };
      w.addEventListener('scroll', sync, { passive: true });
      const go = (i) => w.scrollTo({ top: Math.max(0, Math.min(items.length - 1, i)) * ROW, behavior: reduced() ? 'auto' : 'smooth' });
      items.forEach((it, i) => it.addEventListener('click', () => go(i)));
      w.addEventListener('keydown', (e) => {
        const i = Math.round(w.scrollTop / ROW);
        if (e.key === 'ArrowDown') { e.preventDefault(); go(i + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); go(i - 1); }
      });
      sync();
    });
  }, {
    html: `<button id="trigger" aria-haspopup="listbox" aria-expanded="false">도시 선택</button>
<ul id="menu" role="listbox" hidden>
  <li role="option" tabindex="-1">서울</li>
  <li role="option" tabindex="-1">부산</li>
  <li role="option" tabindex="-1">대구</li>
</ul>

<div id="wheel" tabindex="0" role="spinbutton" aria-label="시" aria-valuenow="0">
  <div>00</div><div>01</div><div>02</div><div>03</div><div>04</div><div>05</div>
</div>
<p id="out"></p>`,
    css: `#menu { list-style: none; margin: 4px 0; padding: 4px; border: 1px solid #ccc; border-radius: 8px; width: 160px; }
#menu li { padding: 8px 10px; border-radius: 6px; cursor: pointer; }
#menu li:hover, #menu li:focus { background: #fde6dd; outline: 0; }
#wheel { height: 108px; width: 80px; overflow-y: auto; scroll-snap-type: y mandatory;
  padding: 36px 0; border: 1px solid #ccc; border-radius: 8px; text-align: center; scrollbar-width: none; }
#wheel div { height: 36px; line-height: 36px; scroll-snap-align: center; color: #888; }
#wheel div.on { color: #000; font-weight: 700; }`,
    js: `const trigger = document.getElementById('trigger');
const menu = document.getElementById('menu');
const opts = [...menu.children];
const out = document.getElementById('out');

trigger.onclick = () => {
  menu.hidden = !menu.hidden;
  trigger.setAttribute('aria-expanded', String(!menu.hidden));
  if (!menu.hidden) opts[0].focus();
};
opts.forEach((o, i) => {
  o.onclick = () => {
    trigger.textContent = o.textContent;
    menu.hidden = true;
    trigger.focus();
  };
  o.onkeydown = (e) => {
    if (e.key === 'ArrowDown') opts[i + 1]?.focus();
    if (e.key === 'ArrowUp') opts[i - 1]?.focus();
    if (e.key === 'Enter') o.click();
    if (e.key === 'Escape') { menu.hidden = true; trigger.focus(); }
  };
});

const wheel = document.getElementById('wheel');
const rows = [...wheel.children];
wheel.onscroll = () => {
  const i = Math.round(wheel.scrollTop / 36);
  rows.forEach((r, k) => r.classList.toggle('on', k === i));
  wheel.setAttribute('aria-valuenow', i);
  out.textContent = rows[i].textContent + '시';
};
wheel.onkeydown = (e) => {
  const i = Math.round(wheel.scrollTop / 36);
  if (e.key === 'ArrowDown') wheel.scrollTo({ top: (i + 1) * 36, behavior: 'smooth' });
  if (e.key === 'ArrowUp') wheel.scrollTo({ top: (i - 1) * 36, behavior: 'smooth' });
};
wheel.onscroll();`,
  });

  /* ───────── 캘린더 ───────── */
  reg('calendar', (stage, p) => {
    const WD = ['일', '월', '화', '수', '목', '금', '토'];
    const DAY = 86400000;
    const t0 = new Date();
    const today = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate()).getTime();
    let view = new Date(t0.getFullYear(), t0.getMonth(), 1);
    let start = null, end = null, hover = null, focusT = today;
    stage.innerHTML = `
<div class="${p}cal">
  <div class="${p}head">
    <button type="button" class="${p}nav" data-d="-1" aria-label="이전 달">‹</button>
    <strong class="${p}title" aria-live="polite"></strong>
    <button type="button" class="${p}nav" data-d="1" aria-label="다음 달">›</button>
  </div>
  <div class="${p}grid ${p}wd" aria-hidden="true">${WD.map((w, i) => `<span class="${i === 0 ? p + 'sun' : ''}">${w}</span>`).join('')}</div>
  <div class="${p}grid ${p}days" role="group" aria-label="날짜"></div>
  <p class="${p}out" role="status" aria-live="polite">시작일을 고르세요</p>
  <div class="${p}foot"><button type="button" class="dm-btn ${p}today">오늘</button><button type="button" class="dm-btn ${p}reset">초기화</button></div>
</div>`;
    const title = $(stage, '.' + p + 'title');
    const daysEl = $(stage, '.' + p + 'days');
    const out = $(stage, '.' + p + 'out');
    const fmt = (t) => { const d = new Date(t); return d.getMonth() + 1 + '월 ' + d.getDate() + '일'; };
    let cells = [];
    function build() {
      const y = view.getFullYear(), m = view.getMonth();
      title.textContent = y + '년 ' + (m + 1) + '월';
      daysEl.textContent = '';
      cells = [];
      const lead = new Date(y, m, 1).getDay();
      const last = new Date(y, m + 1, 0).getDate();
      for (let i = 0; i < lead; i++) daysEl.appendChild(document.createElement('span'));
      for (let d = 1; d <= last; d++) {
        const t = new Date(y, m, d).getTime();
        const b = document.createElement('button');
        b.type = 'button';
        b.className = p + 'day';
        b.textContent = d;
        b.dataset.t = t;
        b.setAttribute('aria-label', y + '년 ' + (m + 1) + '월 ' + d + '일');
        if (new Date(y, m, d).getDay() === 0) b.classList.add(p + 'sun');
        if (t === today) b.classList.add('is-today');
        cells.push(b);
        daysEl.appendChild(b);
      }
      paint();
    }
    function paint() {
      const e2 = end !== null ? end : hover;
      const lo = start !== null && e2 !== null ? Math.min(start, e2) : null;
      const hi = start !== null && e2 !== null ? Math.max(start, e2) : null;
      cells.forEach((b) => {
        const t = +b.dataset.t;
        const isS = t === start, isE = t === end;
        b.classList.toggle('is-start', isS);
        b.classList.toggle('is-end', isE);
        b.classList.toggle('is-in', lo !== null && t > lo && t < hi);
        b.classList.toggle('is-edge-l', lo !== null && lo !== hi && t === lo);
        b.classList.toggle('is-edge-r', lo !== null && lo !== hi && t === hi);
        b.setAttribute('aria-pressed', String(isS || isE));
        b.tabIndex = t === focusT ? 0 : -1;
      });
      if (!cells.some((b) => b.tabIndex === 0) && cells[0]) cells[0].tabIndex = 0;
      if (start === null) out.textContent = '시작일을 고르세요';
      else if (end === null) out.textContent = fmt(start) + ' ~ 종료일을 고르세요';
      else {
        const n = Math.round((end - start) / DAY);
        out.textContent = fmt(start) + ' ~ ' + fmt(end) + ' · ' + n + '박 ' + (n + 1) + '일';
        flash(out);
      }
    }
    function pick(t) {
      focusT = t;
      if (start === null || end !== null) { start = t; end = null; hover = null; }
      else if (t === start) { end = t; }
      else { end = Math.max(start, t); start = Math.min(start, t); }
      paint();
    }
    function focusDate(t) {
      focusT = t;
      const d = new Date(t);
      if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) {
        view = new Date(d.getFullYear(), d.getMonth(), 1);
        build();
      } else paint();
      const b = cells.find((c) => +c.dataset.t === t);
      if (b) b.focus();
    }
    daysEl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) pick(+b.dataset.t); });
    daysEl.addEventListener('mouseover', (e) => {
      const b = e.target.closest('button');
      if (b && start !== null && end === null) { hover = +b.dataset.t; paint(); }
    });
    daysEl.addEventListener('mouseleave', () => { if (hover !== null) { hover = null; paint(); } });
    daysEl.addEventListener('focusin', (e) => {
      const b = e.target.closest('button');
      if (b && start !== null && end === null) { hover = +b.dataset.t; paint(); }
    });
    daysEl.addEventListener('keydown', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = new Date(+b.dataset.t);
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (step === undefined) return;
      e.preventDefault();
      focusDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + step).getTime());
    });
    $$(stage, '.' + p + 'nav').forEach((n) =>
      n.addEventListener('click', () => {
        view = new Date(view.getFullYear(), view.getMonth() + Number(n.dataset.d), 1);
        focusT = view.getTime();
        build();
      })
    );
    $(stage, '.' + p + 'today').addEventListener('click', () => {
      view = new Date(t0.getFullYear(), t0.getMonth(), 1);
      focusT = today;
      build();
    });
    $(stage, '.' + p + 'reset').addEventListener('click', () => { start = end = hover = null; paint(); });
    build();
  }, {
    html: `<div class="cal">
  <div class="head">
    <button id="prev" aria-label="이전 달">‹</button>
    <strong id="title"></strong>
    <button id="next" aria-label="다음 달">›</button>
  </div>
  <div class="grid"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
  <div class="grid" id="days"></div>
  <p id="out">시작일을 고르세요</p>
</div>`,
    css: `.cal { width: 280px; font: 14px sans-serif; }
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.grid { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; }
#days button { height: 36px; border: 0; background: none; cursor: pointer; border-radius: 8px; }
#days button:hover { background: #fde6dd; }
#days button.edge { background: #e8572a; color: #fff; }
#days button.in { background: #fde6dd; border-radius: 0; }
#days button:focus-visible { outline: 2px solid #e8572a; }`,
    js: `let view = new Date(); view.setDate(1);
let start = null, end = null;
const days = document.getElementById('days');

function render() {
  const y = view.getFullYear(), m = view.getMonth();
  document.getElementById('title').textContent = y + '년 ' + (m + 1) + '월';
  days.textContent = '';
  for (let i = 0; i < new Date(y, m, 1).getDay(); i++) days.append(document.createElement('span'));
  for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) {
    const t = new Date(y, m, d).getTime();
    const b = document.createElement('button');
    b.textContent = d;
    b.classList.toggle('edge', t === start || t === end);
    b.classList.toggle('in', start && end && t > start && t < end);
    b.onclick = () => pick(t);
    days.append(b);
  }
}
function pick(t) {
  if (start === null || end !== null) { start = t; end = null; }
  else { end = Math.max(start, t); start = Math.min(start, t); }
  const f = (x) => new Date(x).toLocaleDateString('ko-KR');
  document.getElementById('out').textContent = end ? f(start) + ' ~ ' + f(end) : f(start) + ' ~ 종료일을 고르세요';
  render();
}
document.getElementById('prev').onclick = () => { view.setMonth(view.getMonth() - 1); render(); };
document.getElementById('next').onclick = () => { view.setMonth(view.getMonth() + 1); render(); };
render();`,
  });

  /* ───────── 약관 동의 ───────── */
  reg('terms-agreement', (stage, p) => {
    const rows = [
      { t: '만 14세 이상입니다', req: true },
      { t: '서비스 이용약관', req: true },
      { t: '개인정보 수집·이용', req: true },
      { t: '마케팅 정보 수신', req: false },
      { t: '야간 알림 수신', req: false },
    ];
    stage.innerHTML = `
<form class="${p}form" novalidate>
  <label class="${p}all"><input type="checkbox" class="${p}check ${p}master"><span>전체 동의</span></label>
  <div class="${p}list">${rows
    .map(
      (r) => `<label class="${p}row"><input type="checkbox" class="${p}check ${p}item" data-req="${r.req ? 1 : 0}"><span class="${p}text">${r.t}</span><em class="${p}tag ${r.req ? 'is-req' : ''}">${r.req ? '필수' : '선택'}</em></label>`
    )
    .join('')}</div>
  <button type="submit" class="dm-btn primary ${p}go" disabled>가입하기</button>
  <p class="${p}out" role="status" aria-live="polite">필수 항목 3개가 남았습니다</p>
</form>`;
    const form = $(stage, 'form');
    const master = $(stage, '.' + p + 'master');
    const items = $$(stage, '.' + p + 'item');
    const go = $(stage, '.' + p + 'go');
    const out = $(stage, '.' + p + 'out');
    function sync() {
      const n = items.filter((i) => i.checked).length;
      master.checked = n === items.length;
      master.indeterminate = n > 0 && n < items.length;
      const left = items.filter((i) => i.dataset.req === '1' && !i.checked).length;
      go.disabled = left > 0;
      out.textContent = left ? '필수 항목 ' + left + '개가 남았습니다' : '모두 확인했습니다. 가입할 수 있어요';
      flash(out);
    }
    master.addEventListener('change', () => {
      items.forEach((i) => (i.checked = master.checked));
      sync();
    });
    items.forEach((i) => i.addEventListener('change', sync));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      out.textContent = '가입 완료 (흉내 · 실제 전송 없음)';
      flash(out);
    });
  }, {
    html: `<form id="terms">
  <label><input type="checkbox" id="all"> 전체 동의</label>
  <hr>
  <label><input type="checkbox" class="item" data-req> [필수] 서비스 이용약관</label>
  <label><input type="checkbox" class="item" data-req> [필수] 개인정보 수집·이용</label>
  <label><input type="checkbox" class="item"> [선택] 마케팅 정보 수신</label>
  <button disabled>가입하기</button>
</form>`,
    css: `#terms label { display: block; padding: 6px 0; cursor: pointer; }
#terms input { accent-color: #e8572a; margin-right: 8px; }
#terms button:disabled { opacity: .4; cursor: not-allowed; }`,
    js: `const all = document.getElementById('all');
const items = [...document.querySelectorAll('.item')];
const btn = document.querySelector('#terms button');

function sync() {
  const n = items.filter((i) => i.checked).length;
  all.checked = n === items.length;
  all.indeterminate = n > 0 && n < items.length; // 일부만 선택
  btn.disabled = items.some((i) => i.hasAttribute('data-req') && !i.checked);
}
all.onchange = () => { items.forEach((i) => (i.checked = all.checked)); sync(); };
items.forEach((i) => (i.onchange = sync));`,
  });

  /* ───────── 간편 로그인 ───────── */
  reg('social-login', (stage, p) => {
    const methods = [
      { id: 'kakao', name: '카카오', mark: 'K' },
      { id: 'naver', name: '네이버', mark: 'N' },
      { id: 'google', name: 'Google', mark: 'G' },
      { id: 'apple', name: 'Apple', mark: 'A' },
    ];
    let order = methods.slice();
    let recent = null;
    let layout = 'list';
    stage.innerHTML = `
<div class="${p}card">
  <div class="${p}seg" role="group" aria-label="배치 방식">
    <button type="button" class="${p}segb is-on" aria-pressed="true" data-l="list">세로 버튼</button>
    <button type="button" class="${p}segb" aria-pressed="false" data-l="icons">아이콘 가로</button>
  </div>
  <h4 class="${p}head">시작하기</h4>
  <div class="${p}btns is-list"></div>
  <div class="${p}or"><span>또는</span></div>
  <form class="${p}mail"><input type="email" class="${p}input" placeholder="이메일 주소" aria-label="이메일 주소"><button type="submit" class="dm-btn primary">이메일로 계속</button></form>
  <p class="${p}out" role="status" aria-live="polite">버튼을 눌러 보세요 (실제 로그인 아님)</p>
</div>`;
    const wrap = $(stage, '.' + p + 'btns');
    const out = $(stage, '.' + p + 'out');
    const nodes = {};
    methods.forEach((m) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = p + 'btn';
      b.innerHTML = `<span class="${p}mark" aria-hidden="true">${m.mark}</span><span class="${p}name">${m.name}로 계속하기</span><em class="${p}badge">최근 사용</em>`;
      b.setAttribute('aria-label', m.name + '로 계속하기');
      b.addEventListener('click', () => {
        recent = m.id;
        order = [m].concat(methods.filter((x) => x.id !== m.id));
        layoutRender(true);
        out.textContent = m.name + ' 로그인 흉내 · 다음 방문엔 맨 앞에 놓입니다';
        flash(out);
      });
      nodes[m.id] = b;
    });
    function layoutRender(animate) {
      const first = {};
      if (animate && !reduced()) order.forEach((m) => (first[m.id] = nodes[m.id].getBoundingClientRect()));
      order.forEach((m) => {
        nodes[m.id].classList.toggle('is-recent', m.id === recent);
        wrap.appendChild(nodes[m.id]);
      });
      if (animate && !reduced()) {
        order.forEach((m) => {
          const n = nodes[m.id];
          const r = n.getBoundingClientRect();
          const dx = first[m.id].left - r.left, dy = first[m.id].top - r.top;
          if (!dx && !dy) return;
          n.style.transition = 'none';
          n.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
          void n.offsetWidth;
          n.style.transition = '';
          n.style.transform = '';
        });
      }
    }
    $$(stage, '.' + p + 'segb').forEach((s) =>
      s.addEventListener('click', () => {
        layout = s.dataset.l;
        $$(stage, '.' + p + 'segb').forEach((x) => {
          x.classList.toggle('is-on', x === s);
          x.setAttribute('aria-pressed', String(x === s));
        });
        wrap.classList.toggle('is-list', layout === 'list');
        wrap.classList.toggle('is-icons', layout === 'icons');
      })
    );
    $(stage, '.' + p + 'mail').addEventListener('submit', (e) => {
      e.preventDefault();
      out.textContent = '이메일 로그인 흉내 · 실제 전송 없음';
      flash(out);
    });
    layoutRender(false);
  }, {
    html: `<h3>시작하기</h3>
<div id="social">
  <button data-name="카카오">카카오로 계속하기</button>
  <button data-name="네이버">네이버로 계속하기</button>
  <button data-name="Google">Google로 계속하기</button>
</div>
<p>또는</p>
<form><input type="email" placeholder="이메일 주소"> <button>이메일로 계속</button></form>
<p id="out"></p>`,
    css: `#social { display: grid; gap: 8px; width: 260px; }
#social button { padding: 12px; border: 1px solid #ccc; border-radius: 10px;
  background: #fff; font: inherit; cursor: pointer; transition: transform .15s, border-color .15s; }
#social button:hover { border-color: #e8572a; }
#social button:active { transform: scale(.98); }
#social button:focus-visible { outline: 2px solid #e8572a; outline-offset: 2px; }`,
    js: `const box = document.getElementById('social');
const last = localStorage.getItem('lastLogin');   // 마지막에 쓴 방법을 맨 위로
const btn = last && [...box.children].find((b) => b.dataset.name === last);
if (btn) { box.prepend(btn); btn.textContent += ' (최근 사용)'; }

box.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  localStorage.setItem('lastLogin', b.dataset.name);
  document.getElementById('out').textContent = b.dataset.name + ' 로그인으로 이동합니다';
  // 실제로는 여기서 각 서비스의 인증 페이지로 보냅니다
});`,
  });

  /* ───────── 기본값 효과 ───────── */
  reg('default-effect', (stage, p) => {
    stage.innerHTML = `
<div class="${p}wrap">
  <section class="${p}panel">
    <h4 class="${p}label">A · 기본값 꺼짐</h4>
    <p class="${p}sub">원하는 사람만 직접 켭니다.</p>
    <label class="${p}row"><input type="checkbox" class="${p}check"><span>뉴스레터 받기</span></label>
    <button type="button" class="dm-btn ${p}next">다음</button>
    <p class="${p}out" role="status" aria-live="polite">제출 전</p>
  </section>
  <section class="${p}panel">
    <h4 class="${p}label">B · 기본값 켜짐</h4>
    <p class="${p}sub">원하지 않는 사람만 직접 끕니다.</p>
    <label class="${p}row"><input type="checkbox" class="${p}check" checked><span>뉴스레터 받기</span></label>
    <button type="button" class="dm-btn ${p}next">다음</button>
    <p class="${p}out" role="status" aria-live="polite">제출 전</p>
  </section>
</div>
<div class="${p}sim">
  <label class="${p}slider">기본값을 건드리지 않고 넘어가는 사람 <b class="${p}pct">70%</b>
    <input type="range" min="0" max="100" step="5" value="70" aria-label="기본값을 건드리지 않는 사람 비율">
  </label>
  <div class="${p}bar"><span>A</span><div class="${p}track"><i class="${p}fill" data-k="a"></i></div><b class="${p}n" data-k="a"></b></div>
  <div class="${p}bar"><span>B</span><div class="${p}track"><i class="${p}fill is-b" data-k="b"></i></div><b class="${p}n" data-k="b"></b></div>
  <p class="${p}note">가정 계산입니다. 건드린 사람은 반반으로 고른다고 둔 100명 기준이며 실제 통계가 아닙니다.</p>
</div>`;
    const panels = $$(stage, '.' + p + 'panel');
    panels.forEach((pn) => {
      const box = $(pn, 'input');
      const out = $(pn, '.' + p + 'out');
      $(pn, '.' + p + 'next').addEventListener('click', () => {
        out.textContent = '제출됨 · 구독 ' + (box.checked ? '함' : '안 함');
        flash(out);
      });
    });
    const range = $(stage, 'input[type=range]');
    const pct = $(stage, '.' + p + 'pct');
    function calc() {
      const x = Number(range.value);
      pct.textContent = x + '%';
      const a = (100 - x) / 2;
      const b = x + (100 - x) / 2;
      [['a', a], ['b', b]].forEach(([k, v]) => {
        $(stage, '.' + p + 'fill[data-k=' + k + ']').style.transform = 'scaleX(' + v / 100 + ')';
        $(stage, '.' + p + 'n[data-k=' + k + ']').textContent = v + '명';
      });
    }
    range.addEventListener('input', calc);
    calc();
  }, {
    html: `<form id="a">
  <p>A · 기본 꺼짐</p>
  <label><input type="checkbox" name="news"> 뉴스레터 받기</label>
</form>
<form id="b">
  <p>B · 기본 켜짐</p>
  <label><input type="checkbox" name="news" checked> 뉴스레터 받기</label>
</form>
<p id="out"></p>`,
    css: `form { display: inline-block; vertical-align: top; width: 200px; padding: 12px;
  margin: 0 8px 8px 0; border: 1px solid #ccc; border-radius: 10px; }
input { accent-color: #e8572a; margin-right: 6px; }`,
    js: `// 사용자가 기본값을 건드리지 않으면 선택은 기본값 그대로 제출됩니다
const count = (id) => document.querySelector('#' + id + ' input').checked;
document.addEventListener('change', report);
function report() {
  document.getElementById('out').textContent =
    'A 구독: ' + count('a') + ' / B 구독: ' + count('b');
}
report();
// 기본값은 "추천"처럼 읽힙니다. 사용자에게 불리한 방향으로 쓰지 마세요.`,
  });
})();

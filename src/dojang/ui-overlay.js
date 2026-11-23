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
  const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),[href],[tabindex]:not([tabindex="-1"])';

  /**
   * host 안에 겹침 화면(모달·시트·드로어)을 연다. host 바깥 어디도 건드리지 않는다.
   * variant: 'center' | 'left' | 'right' | 'bottom'
   * 뒤쪽(body)은 inert 로 막고, Tab 은 안에서만 돌고, Esc/바깥 클릭으로 닫힌다.
   */
  function openLayer(p, host, body, opts) {
    const variant = opts.variant || 'center';
    const opener = document.activeElement;
    const scrim = document.createElement('div');
    scrim.className = p + 'scrim is-' + variant + (opts.cls ? ' ' + opts.cls : '');
    const dlg = document.createElement('div');
    dlg.className = p + 'dlg';
    dlg.setAttribute('role', opts.role || 'dialog');
    dlg.setAttribute('aria-modal', 'true');
    dlg.setAttribute('aria-label', opts.label);
    dlg.innerHTML = opts.html;
    scrim.appendChild(dlg);
    host.appendChild(scrim);
    body.inert = true;
    let closed = false;
    function close(value) {
      if (closed) return;
      closed = true;
      scrim.classList.remove('is-open');
      body.inert = false;
      const done = () => scrim.remove();
      if (reduced()) done();
      else setTimeout(done, 260);
      if (opener && opener.focus && opener.isConnected) opener.focus();
      if (opts.onClose) opts.onClose(value);
    }
    $$(dlg, '[data-v]').forEach((b) => b.addEventListener('click', () => close(b.dataset.v)));
    scrim.addEventListener('mousedown', (e) => {
      if (e.target === scrim && opts.scrimClose !== false) close('scrim');
    });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close('esc'); return; }
      if (e.key !== 'Tab') return;
      const f = $$(dlg, FOCUSABLE);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    void scrim.offsetWidth;
    scrim.classList.add('is-open');
    const target = $(dlg, '[data-autofocus]') || $(dlg, FOCUSABLE);
    if (target) target.focus({ preventScroll: true });
    return { close, dlg, scrim };
  }

  /* ───────── 토스트 vs 스낵바 ───────── */
  reg('toast-vs-snackbar', (stage, p) => {
    stage.innerHTML = `
<div class="${p}wrap">
  <section class="${p}panel">
    <h4 class="${p}label">토스트 · 알려주기만</h4>
    <p class="${p}sub">잠깐 떴다 사라집니다. 누를 곳이 없습니다.</p>
    <div class="${p}main"><button type="button" class="dm-btn primary ${p}save">저장</button></div>
    <div class="${p}layer" role="status" aria-live="polite"></div>
  </section>
  <section class="${p}panel">
    <h4 class="${p}label">스낵바 · 되돌릴 기회</h4>
    <p class="${p}sub">짧은 알림 + 행동 하나. 더 오래 머뭅니다.</p>
    <ul class="${p}files"></ul>
    <div class="${p}layer" role="status" aria-live="polite"></div>
  </section>
</div>`;
    const [a, b] = $$(stage, '.' + p + 'panel');
    const live = () => stage.isConnected;
    // 토스트
    const layerA = $(a, '.' + p + 'layer');
    let n = 0;
    $(a, '.' + p + 'save').addEventListener('click', () => {
      const t = document.createElement('div');
      t.className = p + 'toast';
      t.textContent = '저장했습니다 (' + ++n + ')';
      layerA.appendChild(t);
      void t.offsetWidth;
      t.classList.add('is-in');
      setTimeout(() => {
        t.classList.remove('is-in');
        setTimeout(() => t.remove(), 260);
      }, 2000);
    });
    // 스낵바
    const list = $(b, '.' + p + 'files');
    const layerB = $(b, '.' + p + 'layer');
    const names = ['회의록.pdf', '견적서.xlsx', '사진 모음.zip'];
    const rows = names.map((name) => {
      const li = document.createElement('li');
      li.className = p + 'file';
      li.innerHTML = `<span class="${p}fname">${name}</span><button type="button" class="${p}del" aria-label="${name} 삭제">삭제</button>`;
      list.appendChild(li);
      return li;
    });
    let current = null;
    function finalize() {
      if (!current) return;
      clearTimeout(current.timer);
      current.row.hidden = true;
      current.bar.remove();
      current = null;
    }
    rows.forEach((row, i) => {
      $(row, '.' + p + 'del').addEventListener('click', () => {
        finalize();
        row.classList.add('is-gone');
        const bar = document.createElement('div');
        bar.className = p + 'snack';
        bar.innerHTML = `<span>${names[i]} 삭제됨</span><button type="button" class="${p}undo">되돌리기</button><i class="${p}life"></i>`;
        layerB.appendChild(bar);
        void bar.offsetWidth;
        bar.classList.add('is-in');
        const timer = setTimeout(() => {
          if (!live()) return;
          bar.classList.remove('is-in');
          setTimeout(() => { if (current && current.bar === bar) finalize(); else bar.remove(); }, 260);
        }, 5000);
        current = { row, bar, timer };
        $(bar, '.' + p + 'undo').addEventListener('click', () => {
          clearTimeout(timer);
          row.classList.remove('is-gone');
          bar.classList.remove('is-in');
          setTimeout(() => bar.remove(), 260);
          if (current && current.bar === bar) current = null;
        });
      });
    });
  }, {
    html: `<button id="save">저장</button>
<ul id="files"><li>회의록.pdf <button>삭제</button></li></ul>
<div id="layer" role="status" aria-live="polite"></div>`,
    css: `#layer { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%);
  display: grid; gap: 8px; z-index: 10; }
.bar { display: flex; align-items: center; gap: 14px; padding: 10px 16px; border-radius: 999px;
  background: #18202e; color: #fff; font: 14px sans-serif; animation: up .25s ease-out; }
.bar button { background: none; border: 0; color: #ff9a76; font: inherit; font-weight: 700; cursor: pointer; }
@keyframes up { from { opacity: 0; transform: translateY(12px); } }`,
    js: `const layer = document.getElementById('layer');

// 토스트: 알려주기만 하고 스스로 사라집니다
function toast(text) {
  const el = document.createElement('div');
  el.className = 'bar';
  el.textContent = text;
  layer.append(el);
  setTimeout(() => el.remove(), 2000);
}
document.getElementById('save').onclick = () => toast('저장했습니다');

// 스낵바: 되돌리기 행동이 붙고, 조금 더 오래 머뭅니다
document.querySelectorAll('#files button').forEach((btn) => {
  btn.onclick = () => {
    const li = btn.parentElement;
    li.hidden = true;
    const el = document.createElement('div');
    el.className = 'bar';
    el.innerHTML = '삭제됨 <button>되돌리기</button>';
    layer.append(el);
    const timer = setTimeout(() => { li.remove(); el.remove(); }, 5000);
    el.querySelector('button').onclick = () => { clearTimeout(timer); li.hidden = false; el.remove(); };
  };
});`,
  });

  /* ───────── 알럿 vs 컨펌 ───────── */
  reg('alert-vs-confirm', (stage, p) => {
    stage.innerHTML = `
<div class="${p}wrap">
  <section class="${p}panel">
    <div class="${p}body">
      <h4 class="${p}label">알럿 · 알림만</h4>
      <p class="${p}sub">읽고 '확인'만 누르면 됩니다. 선택지가 없습니다.</p>
      <button type="button" class="dm-btn primary ${p}open-a">저장 완료 띄우기</button>
      <p class="${p}out" role="status" aria-live="polite">아직 열지 않음</p>
    </div>
  </section>
  <section class="${p}panel">
    <div class="${p}body">
      <h4 class="${p}label">컨펌 · 결정 받기</h4>
      <p class="${p}sub">되돌리기 어려운 일 앞에서 취소할 길을 줍니다.</p>
      <button type="button" class="dm-btn primary ${p}open-c">계정 삭제 띄우기</button>
      <p class="${p}out" role="status" aria-live="polite">아직 열지 않음</p>
    </div>
  </section>
</div>`;
    const [a, b] = $$(stage, '.' + p + 'panel');
    $(a, '.' + p + 'open-a').addEventListener('click', () => {
      const out = $(a, '.' + p + 'out');
      openLayer(p, a, $(a, '.' + p + 'body'), {
        role: 'alertdialog',
        label: '저장 완료',
        html: `<h5 class="${p}dt">저장했습니다</h5><p class="${p}dm">변경 내용이 반영됐어요.</p><div class="${p}acts"><button type="button" class="dm-btn primary" data-v="ok" data-autofocus>확인</button></div>`,
        onClose: () => { out.textContent = '확인을 눌렀습니다'; flash(out); },
      });
    });
    $(b, '.' + p + 'open-c').addEventListener('click', () => {
      const out = $(b, '.' + p + 'out');
      openLayer(p, b, $(b, '.' + p + 'body'), {
        role: 'alertdialog',
        label: '계정 삭제 확인',
        scrimClose: false,
        html: `<h5 class="${p}dt">계정을 삭제할까요?</h5><p class="${p}dm">삭제하면 되돌릴 수 없습니다.</p><div class="${p}acts"><button type="button" class="dm-btn" data-v="cancel" data-autofocus>취소</button><button type="button" class="dm-btn ${p}danger" data-v="del">삭제</button></div>`,
        onClose: (v) => {
          out.textContent = v === 'del' ? '삭제를 선택했습니다 (흉내)' : '취소했습니다 · Esc 도 취소입니다';
          flash(out);
        },
      });
    });
  }, {
    html: `<button id="openAlert">알럿</button>
<button id="openConfirm">컨펌</button>

<dialog id="dlg">
  <h3 id="title"></h3>
  <p id="msg"></p>
  <form method="dialog">
    <button value="cancel" id="cancel">취소</button>
    <button value="ok" id="ok">확인</button>
  </form>
</dialog>
<p id="out"></p>`,
    css: `dialog { border: 1px solid #ccc; border-radius: 14px; padding: 20px; max-width: 280px; }
dialog::backdrop { background: rgba(24, 32, 46, .45); }
dialog form { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
dialog[data-kind="alert"] #cancel { display: none; }`,
    js: `const dlg = document.getElementById('dlg');
function ask(kind, title, msg) {
  dlg.dataset.kind = kind;                       // alert 는 취소 버튼을 숨김
  document.getElementById('title').textContent = title;
  document.getElementById('msg').textContent = msg;
  dlg.showModal();                                // 포커스 가둠·Esc 닫기 기본 제공
}
openAlert.onclick = () => ask('alert', '저장했습니다', '변경 내용이 반영됐어요.');
openConfirm.onclick = () => ask('confirm', '삭제할까요?', '되돌릴 수 없습니다.');
dlg.onclose = () => { out.textContent = '결과: ' + dlg.returnValue; };`,
  });

  /* ───────── 팝업 vs 모달 ───────── */
  reg('popup-vs-modal', (stage, p) => {
    stage.innerHTML = `
<div class="${p}wrap">
  <section class="${p}panel">
    <div class="${p}body">
      <h4 class="${p}label">팝업 · 말풍선</h4>
      <p class="${p}sub">뒤 화면이 그대로 살아 있습니다.</p>
      <div class="${p}pop-host">
        <button type="button" class="dm-btn ${p}pop-btn" aria-expanded="false">도움말 ?</button>
        <div class="${p}bubble" role="tooltip" hidden>배송비는 3만 원 이상 구매하면 무료입니다.</div>
      </div>
      <button type="button" class="dm-btn primary ${p}count">+1 담기 · 0</button>
    </div>
  </section>
  <section class="${p}panel">
    <div class="${p}body">
      <h4 class="${p}label">모달 · 화면 가로막기</h4>
      <p class="${p}sub">닫기 전에는 뒤를 누를 수 없습니다.</p>
      <button type="button" class="dm-btn ${p}modal-btn">약관 열기</button>
      <button type="button" class="dm-btn primary ${p}count">+1 담기 · 0</button>
    </div>
  </section>
</div>`;
    const [a, b] = $$(stage, '.' + p + 'panel');
    $$(stage, '.' + p + 'count').forEach((c) => {
      let n = 0;
      c.addEventListener('click', () => { c.textContent = '+1 담기 · ' + ++n; flash(c); });
    });
    // 팝업(비차단)
    const btn = $(a, '.' + p + 'pop-btn');
    const bubble = $(a, '.' + p + 'bubble');
    const setPop = (on) => {
      bubble.hidden = !on;
      btn.setAttribute('aria-expanded', String(on));
    };
    btn.addEventListener('click', (e) => { e.stopPropagation(); setPop(bubble.hidden); });
    a.addEventListener('click', (e) => { if (!bubble.hidden && e.target !== btn) setPop(false); });
    a.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !bubble.hidden) { setPop(false); btn.focus(); } });
    // 모달(차단)
    $(b, '.' + p + 'modal-btn').addEventListener('click', () => {
      openLayer(p, b, $(b, '.' + p + 'body'), {
        label: '이용약관',
        html: `<h5 class="${p}dt">이용약관</h5><p class="${p}dm">닫기 전에는 뒤 화면을 누를 수 없고, Tab 은 이 창 안에서만 돕니다.</p><div class="${p}acts"><button type="button" class="dm-btn primary" data-v="ok" data-autofocus>닫기</button></div>`,
      });
    });
  }, {
    html: `<button id="help" aria-expanded="false">도움말 ?</button>
<div id="bubble" role="tooltip" hidden>배송비는 3만 원 이상 구매하면 무료입니다.</div>

<button id="terms">약관 열기</button>
<dialog id="modal">
  <p>닫기 전에는 뒤 화면을 누를 수 없습니다.</p>
  <button id="close">닫기</button>
</dialog>`,
    css: `#bubble { display: inline-block; margin-left: 8px; padding: 8px 12px; border-radius: 10px;
  background: #18202e; color: #fff; font-size: 13px; }
#bubble[hidden] { display: none; }
dialog { border: 1px solid #ccc; border-radius: 14px; padding: 20px; }
dialog::backdrop { background: rgba(24, 32, 46, .45); }`,
    js: `// 팝업: 뒤 화면은 그대로, Esc 나 바깥 클릭으로 닫힙니다
const help = document.getElementById('help');
const bubble = document.getElementById('bubble');
function setPop(on) { bubble.hidden = !on; help.setAttribute('aria-expanded', on); }
help.onclick = (e) => { e.stopPropagation(); setPop(bubble.hidden); };
document.addEventListener('click', () => setPop(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setPop(false); });

// 모달: showModal() 이 배경 차단과 포커스 가둠을 해 줍니다
const modal = document.getElementById('modal');
document.getElementById('terms').onclick = () => modal.showModal();
document.getElementById('close').onclick = () => modal.close();`,
  });

  /* ───────── 모달 등장 ───────── */
  reg('modal-enter', (stage, p) => {
    const kinds = [
      { k: 'fade', name: '페이드', note: '투명도만 · 가장 조용함' },
      { k: 'scale', name: '스케일', note: '살짝 커지며 · 집중시킴' },
      { k: 'rise', name: '아래서 위로', note: '아래에서 올라옴 · 모바일 느낌' },
    ];
    let kind = 'fade';
    stage.innerHTML = `
<div class="${p}panel">
  <div class="${p}body">
    <h4 class="${p}label">등장 방식 고르기</h4>
    <div class="${p}seg" role="radiogroup" aria-label="등장 방식">${kinds
      .map((x, i) => `<button type="button" role="radio" aria-checked="${i === 0}" class="${p}segb ${i === 0 ? 'is-on' : ''}" data-k="${x.k}">${x.name}</button>`)
      .join('')}</div>
    <p class="${p}sub ${p}note" role="status" aria-live="polite">${kinds[0].note}</p>
    <button type="button" class="dm-btn primary ${p}open">모달 열기</button>
  </div>
</div>`;
    const host = $(stage, '.' + p + 'panel');
    const note = $(stage, '.' + p + 'note');
    const segs = $$(stage, '.' + p + 'segb');
    segs.forEach((s) =>
      s.addEventListener('click', () => {
        kind = s.dataset.k;
        segs.forEach((x) => {
          x.classList.toggle('is-on', x === s);
          x.setAttribute('aria-checked', String(x === s));
        });
        note.textContent = kinds.find((x) => x.k === kind).note;
      })
    );
    $(stage, '.' + p + 'open').addEventListener('click', () => {
      openLayer(p, host, $(stage, '.' + p + 'body'), {
        cls: 'is-' + kind,
        label: '모달 예시',
        html: `<h5 class="${p}dt">이렇게 나타났어요</h5><p class="${p}dm">${kinds.find((x) => x.k === kind).name} 방식 · 닫을 때는 반대로 사라집니다.</p><div class="${p}acts"><button type="button" class="dm-btn primary" data-v="ok" data-autofocus>닫기</button></div>`,
      });
    });
  }, {
    html: `<button id="open">모달 열기</button>
<div id="scrim" aria-hidden="true">
  <div id="modal" role="dialog" aria-modal="true" aria-label="예시">
    <p>이렇게 나타났어요</p>
    <button id="close">닫기</button>
  </div>
</div>`,
    css: `#scrim { position: fixed; inset: 0; display: grid; place-items: center;
  background: rgba(24, 32, 46, .45); opacity: 0; visibility: hidden;
  transition: opacity .2s, visibility 0s .2s; }
#scrim.open { opacity: 1; visibility: visible; transition-delay: 0s; }
#modal { background: #fff; padding: 20px; border-radius: 14px;
  /* 셋 중 하나만 고르세요 */
  transform: scale(.94);                /* 스케일 */
  /* transform: translateY(40px); */    /* 아래서 위로 */
  /* transform: none; */                /* 페이드 */
  transition: transform .25s cubic-bezier(.16, 1, .3, 1); }
#scrim.open #modal { transform: none; }
@media (prefers-reduced-motion: reduce) { #scrim, #modal { transition: none; } }`,
    js: `const scrim = document.getElementById('scrim');
const open = document.getElementById('open');
function setOpen(on) {
  scrim.classList.toggle('open', on);
  scrim.setAttribute('aria-hidden', String(!on));
  (on ? document.getElementById('close') : open).focus();
}
open.onclick = () => setOpen(true);
document.getElementById('close').onclick = () => setOpen(false);
scrim.onclick = (e) => { if (e.target === scrim) setOpen(false); };
scrim.onkeydown = (e) => { if (e.key === 'Escape') setOpen(false); };`,
  });

  /* ───────── 바텀시트 vs 드로어 ───────── */
  reg('bottomsheet-vs-drawer', (stage, p) => {
    stage.innerHTML = `
<div class="${p}wrap">
  <section class="${p}panel">
    <div class="${p}body">
      <h4 class="${p}label">바텀시트 · 아래에서</h4>
      <p class="${p}sub">엄지가 닿는 선택·공유. 핸들을 끌어 내려 닫습니다.</p>
      <button type="button" class="dm-btn primary ${p}open-s">공유하기</button>
    </div>
  </section>
  <section class="${p}panel">
    <div class="${p}body">
      <h4 class="${p}label">드로어 · 옆에서</h4>
      <p class="${p}sub">메뉴·필터처럼 길고 반복되는 목록.</p>
      <button type="button" class="dm-btn primary ${p}open-d">메뉴 열기</button>
    </div>
  </section>
</div>`;
    const [a, b] = $$(stage, '.' + p + 'panel');
    $(a, '.' + p + 'open-s').addEventListener('click', () => {
      const L = openLayer(p, a, $(a, '.' + p + 'body'), {
        variant: 'bottom',
        label: '공유하기',
        html: `<div class="${p}handle" aria-hidden="true"></div><h5 class="${p}dt">공유하기</h5><div class="${p}chips"><button type="button" class="dm-btn" data-v="a" data-autofocus>링크 복사</button><button type="button" class="dm-btn" data-v="b">메시지</button><button type="button" class="dm-btn" data-v="c">닫기</button></div>`,
      });
      const h = $(L.dlg, '.' + p + 'handle');
      let y0 = null;
      h.addEventListener('pointerdown', (e) => { y0 = e.clientY; h.setPointerCapture(e.pointerId); L.dlg.style.transition = 'none'; });
      h.addEventListener('pointermove', (e) => {
        if (y0 === null) return;
        L.dlg.style.transform = 'translateY(' + Math.max(0, e.clientY - y0) + 'px)';
      });
      const end = (e) => {
        if (y0 === null) return;
        const dy = e.clientY - y0;
        y0 = null;
        L.dlg.style.transition = '';
        L.dlg.style.transform = '';
        if (dy > 60) L.close('drag');
      };
      h.addEventListener('pointerup', end);
      h.addEventListener('pointercancel', end);
    });
    $(b, '.' + p + 'open-d').addEventListener('click', () => {
      openLayer(p, b, $(b, '.' + p + 'body'), {
        variant: 'right',
        label: '메뉴',
        html: `<h5 class="${p}dt">메뉴</h5><ul class="${p}menu"><li><button type="button" class="${p}link" data-autofocus>홈</button></li><li><button type="button" class="${p}link">주문 내역</button></li><li><button type="button" class="${p}link">설정</button></li></ul><button type="button" class="dm-btn" data-v="x">닫기</button>`,
      });
    });
  }, {
    html: `<button id="open">공유하기</button>
<div id="scrim" hidden>
  <div id="sheet" role="dialog" aria-modal="true" aria-label="공유하기">
    <div id="handle"></div>
    <button>링크 복사</button> <button id="close">닫기</button>
  </div>
</div>`,
    css: `#scrim { position: fixed; inset: 0; background: rgba(24, 32, 46, .45); display: flex; align-items: flex-end; }
#scrim[hidden] { display: none; }
#sheet { width: 100%; background: #fff; border-radius: 20px 20px 0 0; padding: 12px 20px 24px;
  animation: up .3s cubic-bezier(.16, 1, .3, 1); }
#handle { width: 40px; height: 4px; border-radius: 4px; background: #ccc; margin: 0 auto 14px; touch-action: none; }
@keyframes up { from { transform: translateY(100%); } }
/* 드로어는 align-items 대신 justify-content: flex-end 와 translateX(100%) 로 바꾸면 됩니다 */`,
    js: `const scrim = document.getElementById('scrim');
const sheet = document.getElementById('sheet');
const open = document.getElementById('open');
const close = () => { scrim.hidden = true; open.focus(); };
open.onclick = () => { scrim.hidden = false; document.getElementById('close').focus(); };
document.getElementById('close').onclick = close;
scrim.onclick = (e) => { if (e.target === scrim) close(); };
scrim.onkeydown = (e) => { if (e.key === 'Escape') close(); };

// 핸들을 아래로 끌어 닫기
let y0 = null;
const handle = document.getElementById('handle');
handle.onpointerdown = (e) => { y0 = e.clientY; handle.setPointerCapture(e.pointerId); };
handle.onpointermove = (e) => { if (y0 !== null) sheet.style.transform = 'translateY(' + Math.max(0, e.clientY - y0) + 'px)'; };
handle.onpointerup = (e) => {
  const dy = e.clientY - y0; y0 = null; sheet.style.transform = '';
  if (dy > 60) close();
};`,
  });

  /* ───────── 드로어 ───────── */
  reg('drawer', (stage, p) => {
    let side = 'left';
    stage.innerHTML = `
<div class="${p}panel">
  <div class="${p}body">
    <h4 class="${p}label">드로어 · 어느 쪽에서?</h4>
    <div class="${p}seg" role="radiogroup" aria-label="열리는 쪽">
      <button type="button" role="radio" aria-checked="true" class="${p}segb is-on" data-s="left">왼쪽</button>
      <button type="button" role="radio" aria-checked="false" class="${p}segb" data-s="right">오른쪽</button>
    </div>
    <p class="${p}sub">열린 뒤 Esc 나 바깥 영역 클릭으로 닫아 보세요.</p>
    <button type="button" class="dm-btn primary ${p}open" aria-haspopup="dialog">드로어 열기</button>
    <p class="${p}out" role="status" aria-live="polite">닫힘</p>
  </div>
</div>`;
    const host = $(stage, '.' + p + 'panel');
    const out = $(stage, '.' + p + 'out');
    const segs = $$(stage, '.' + p + 'segb');
    segs.forEach((s) =>
      s.addEventListener('click', () => {
        side = s.dataset.s;
        segs.forEach((x) => {
          x.classList.toggle('is-on', x === s);
          x.setAttribute('aria-checked', String(x === s));
        });
      })
    );
    const reasons = { esc: 'Esc 로 닫음', scrim: '바깥 클릭으로 닫음', x: '닫기 버튼으로 닫음', go: '메뉴를 골라서 닫음' };
    $(stage, '.' + p + 'open').addEventListener('click', () => {
      out.textContent = '열림';
      openLayer(p, host, $(stage, '.' + p + 'body'), {
        variant: side,
        label: '메뉴',
        html: `<div class="${p}dhead"><h5 class="${p}dt">메뉴</h5><button type="button" class="${p}x" data-v="x" aria-label="닫기">×</button></div><ul class="${p}menu"><li><button type="button" class="${p}link" data-v="go" data-autofocus>홈</button></li><li><button type="button" class="${p}link" data-v="go">주문 내역</button></li><li><button type="button" class="${p}link" data-v="go">설정</button></li></ul>`,
        onClose: (v) => { out.textContent = reasons[v] || '닫힘'; flash(out); },
      });
    });
  }, {
    html: `<button id="open" aria-haspopup="dialog">메뉴 열기</button>
<div id="scrim" hidden>
  <nav id="drawer" role="dialog" aria-modal="true" aria-label="메뉴">
    <button id="close" aria-label="닫기">×</button>
    <a href="#">홈</a> <a href="#">주문 내역</a> <a href="#">설정</a>
  </nav>
</div>`,
    css: `#scrim { position: fixed; inset: 0; background: rgba(24, 32, 46, .45); display: flex; }
#scrim[hidden] { display: none; }
#drawer { width: min(280px, 80%); height: 100%; background: #fff; padding: 20px;
  display: flex; flex-direction: column; gap: 10px;
  animation: in .3s cubic-bezier(.16, 1, .3, 1); }
@keyframes in { from { transform: translateX(-100%); } }
/* 오른쪽 드로어: #scrim 에 justify-content: flex-end, 애니메이션을 translateX(100%) 로 */`,
    js: `const scrim = document.getElementById('scrim');
const open = document.getElementById('open');
const close = () => { scrim.hidden = true; open.focus(); };

open.onclick = () => { scrim.hidden = false; document.getElementById('close').focus(); };
document.getElementById('close').onclick = close;
scrim.onclick = (e) => { if (e.target === scrim) close(); };   // 바깥 클릭
scrim.onkeydown = (e) => {
  if (e.key === 'Escape') close();                              // ESC
  if (e.key === 'Tab') {                                        // 포커스 가두기
    const f = [...scrim.querySelectorAll('button, a')];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
};`,
  });

  /* ───────── 푸시 ───────── */
  reg('push', (stage, p) => {
    const msgs = [
      ['주문 알림', '주문하신 상품이 출발했어요'],
      ['댓글 알림', '새 댓글이 달렸어요'],
      ['마감 알림', '오늘 18시에 마감돼요'],
    ];
    let perm = 'default';
    let unread = 0;
    let mi = 0;
    let timer = null;
    stage.innerHTML = `
<div class="${p}wrap">
  <div class="${p}ctrl">
    <h4 class="${p}label">푸시 흉내 (실제 알림 아님)</h4>
    <p class="${p}sub">권한 요청 → 알림 도착 순서로 눌러 보세요.</p>
    <button type="button" class="dm-btn ${p}ask">1. 알림 켜기 (권한 요청)</button>
    <button type="button" class="dm-btn primary ${p}send">2. 알림 도착시키기</button>
    <button type="button" class="dm-btn ${p}reset">처음으로</button>
    <p class="${p}out" role="status" aria-live="polite">권한: 아직 묻지 않음</p>
  </div>
  <div class="${p}phone">
    <div class="${p}screen">
      <div class="${p}time" aria-hidden="true">9:41</div>
      <div class="${p}app"><span class="${p}icon" aria-hidden="true">J<b class="${p}badge" hidden>0</b></span><span class="${p}appn">주간앱</span></div>
      <p class="${p}opened" aria-live="polite"></p>
      <div class="${p}banner-slot" role="status" aria-live="polite"></div>
    </div>
  </div>
</div>`;
    const screen = $(stage, '.' + p + 'screen');
    const phone = $(stage, '.' + p + 'phone');
    const slot = $(stage, '.' + p + 'banner-slot');
    const badge = $(stage, '.' + p + 'badge');
    const out = $(stage, '.' + p + 'out');
    const opened = $(stage, '.' + p + 'opened');
    const send = $(stage, '.' + p + 'send');
    const setBadge = () => { badge.hidden = unread === 0; badge.textContent = unread; };
    const hideBanner = () => {
      const b = $(slot, '.' + p + 'banner');
      if (!b) return;
      b.classList.remove('is-in');
      setTimeout(() => b.remove(), reduced() ? 0 : 280);
    };
    function showBanner(title, body) {
      clearTimeout(timer);
      slot.textContent = '';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = p + 'banner';
      b.innerHTML = `<span class="${p}bi" aria-hidden="true">J</span><span class="${p}bt"><strong>${title}</strong><span>${body}</span></span><em>지금</em>`;
      slot.appendChild(b);
      void b.offsetWidth;
      b.classList.add('is-in');
      unread++;
      setBadge();
      b.addEventListener('click', () => {
        unread = Math.max(0, unread - 1);
        setBadge();
        opened.textContent = '앱 열림 · ' + title;
        flash(opened);
        hideBanner();
      });
      timer = setTimeout(() => { if (stage.isConnected) hideBanner(); }, 5000);
    }
    $(stage, '.' + p + 'ask').addEventListener('click', () => {
      if (perm !== 'default') { out.textContent = '이미 ' + (perm === 'granted' ? '허용' : '거부') + '됨 · 처음으로를 눌러 다시 해 보세요'; return; }
      openLayer(p, phone, screen, {
        role: 'alertdialog',
        label: '알림 권한',
        scrimClose: false,
        html: `<h5 class="${p}dt">'주간앱'에서 알림을 보내려고 합니다</h5><p class="${p}dm">시스템 권한 창 흉내입니다.</p><div class="${p}acts"><button type="button" class="dm-btn" data-v="deny" data-autofocus>허용 안 함</button><button type="button" class="dm-btn primary" data-v="allow">허용</button></div>`,
        onClose: (v) => {
          perm = v === 'allow' ? 'granted' : 'denied';
          out.textContent = perm === 'granted' ? '권한: 허용됨 · 이제 알림이 도착합니다' : '권한: 거부됨 · 알림이 오지 않습니다 (설정에서 다시 켤 수 있어요)';
          flash(out);
        },
      });
    });
    send.addEventListener('click', () => {
      if (perm === 'default') { out.textContent = '먼저 1번으로 권한을 물어야 합니다'; flash(out); return; }
      if (perm === 'denied') { out.textContent = '거부 상태라 알림이 도착하지 않습니다'; flash(out); return; }
      const m = msgs[mi++ % msgs.length];
      showBanner(m[0], m[1]);
      out.textContent = '알림 도착 · 누르면 앱이 열립니다 · 5초 뒤 사라집니다';
    });
    $(stage, '.' + p + 'reset').addEventListener('click', () => {
      clearTimeout(timer);
      perm = 'default';
      unread = 0;
      mi = 0;
      slot.textContent = '';
      opened.textContent = '';
      setBadge();
      out.textContent = '권한: 아직 묻지 않음';
      flash(out);
    });
  }, {
    html: `<button id="ask">알림 켜기</button>
<button id="send">테스트 알림</button>`,
    css: `/* 브라우저가 알림을 그리므로 CSS 는 필요 없습니다 */`,
    js: `// 권한은 버튼을 누른 뒤에 묻습니다 (페이지 열자마자 묻지 마세요)
document.getElementById('ask').onclick = async () => {
  if (!('Notification' in window)) return alert('이 브라우저는 알림을 지원하지 않습니다');
  const result = await Notification.requestPermission(); // granted | denied | default
  console.log('권한:', result);
};
document.getElementById('send').onclick = () => {
  if (Notification.permission !== 'granted') return;     // 거부되면 아무것도 못 보냄
  const n = new Notification('주문 알림', { body: '주문하신 상품이 출발했어요' });
  n.onclick = () => { window.focus(); n.close(); };      // 누르면 앱으로 돌아옴
};
// 실제 서비스의 서버 푸시는 Service Worker 의 push 이벤트와 Push API 가 필요합니다.`,
  });
})();

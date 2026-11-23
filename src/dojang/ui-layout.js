/* UI 도감 - 화면 구성 (ui-layout) */
(function () {
  'use strict';
  window.JL_DEMOS = window.JL_DEMOS || {};

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function setAttrs(e, o) {
    Object.keys(o).forEach(function (k) { e.setAttribute(k, o[k]); });
    return e;
  }
  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ---------- 1. hero ---------- */
  window.JL_DEMOS['hero'] = {
    mount: function (stage) {
      stage.textContent = '';
      var P = 'dm-hero';
      var wrap = el('div', P + '-wrap');
      var seg = el('div', P + '-seg');
      setAttrs(seg, { role: 'radiogroup', 'aria-label': '히어로 레이아웃' });
      var layouts = [['left', '왼쪽 정렬'], ['center', '가운데'], ['split', '분할']];
      var box = el('section', P + '-box');
      box.setAttribute('aria-label', '히어로 미리보기');
      var copy = el('div', P + '-copy');
      copy.appendChild(el('span', P + '-eyebrow', 'NEW · 주간 실험'));
      copy.appendChild(el('h3', P + '-title', '하루 할 일을 한 화면에 정리하세요'));
      copy.appendChild(el('p', P + '-sub', '복잡한 설정 없이 바로 쓰는 가벼운 할 일 도구입니다.'));
      var cta = el('div', P + '-cta');
      var go = el('button', P + '-go', '무료로 시작');
      go.type = 'button';
      var more = el('button', P + '-more', '둘러보기');
      more.type = 'button';
      cta.appendChild(go); cta.appendChild(more);
      copy.appendChild(cta);
      var art = el('div', P + '-art');
      art.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < 3; i++) art.appendChild(el('span', P + '-card'));
      box.appendChild(copy); box.appendChild(art);

      var btns = layouts.map(function (l, i) {
        var b = el('button', P + '-opt', l[1]);
        setAttrs(b, { type: 'button', role: 'radio', 'aria-checked': 'false', tabindex: '-1' });
        b.addEventListener('click', function () { pick(i, false); });
        b.addEventListener('keydown', function (e) {
          var n = layouts.length, to = -1;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (i + 1) % n;
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (i - 1 + n) % n;
          if (to >= 0) { e.preventDefault(); pick(to, true); }
        });
        seg.appendChild(b);
        return b;
      });
      function pick(i, focus) {
        btns.forEach(function (b, j) {
          b.setAttribute('aria-checked', String(j === i));
          b.tabIndex = j === i ? 0 : -1;
        });
        box.setAttribute('data-layout', layouts[i][0]);
        box.classList.remove('is-in'); void box.offsetWidth; box.classList.add('is-in');
        if (focus) btns[i].focus();
      }
      wrap.appendChild(seg); wrap.appendChild(box);
      stage.appendChild(wrap);
      pick(0, false);
    },
    code: {
      html: '<section class="hero" data-layout="left">\n  <div class="copy">\n    <span class="eyebrow">NEW · 주간 실험</span>\n    <h1>하루 할 일을 한 화면에 정리하세요</h1>\n    <p>복잡한 설정 없이 바로 쓰는 가벼운 할 일 도구입니다.</p>\n    <a class="cta" href="#start">무료로 시작</a>\n    <a class="link" href="#tour">둘러보기</a>\n  </div>\n  <div class="art" aria-hidden="true"></div>\n</section>',
      css: '.hero { display: grid; gap: 20px; padding: 40px 24px; background: #f6f3ec; border-radius: 16px; }\n.hero h1 { margin: 8px 0; font-size: clamp(1.6rem, 5vw, 2.6rem); line-height: 1.2; }\n.eyebrow { font-size: .8rem; color: #e8572a; font-weight: 600; }\n.cta { display: inline-block; padding: 12px 22px; background: #18202e; color: #fff; border-radius: 999px; text-decoration: none; }\n.link { margin-left: 12px; }\n.art { min-height: 120px; background: #e8572a22; border-radius: 12px; }\n/* 레이아웃 3가지 */\n.hero[data-layout="center"] { text-align: center; justify-items: center; }\n.hero[data-layout="center"] .art { display: none; }\n.hero[data-layout="split"] { grid-template-columns: 1.2fr 1fr; align-items: center; }\n.hero[data-layout="left"] .art { display: none; }',
      js: '// 레이아웃은 data-layout 값만 바꾸면 됩니다.\ndocument.querySelector(".hero").dataset.layout = "split"; // left | center | split'
    }
  };

  /* ---------- 2. splash ---------- */
  window.JL_DEMOS['splash'] = {
    mount: function (stage) {
      stage.textContent = '';
      var P = 'dm-splash';
      var wrap = el('div', P + '-wrap');
      var phone = el('div', P + '-phone');
      var home = el('div', P + '-home');
      var hbar = el('header', P + '-hbar');
      hbar.appendChild(el('strong', P + '-hlogo', 'juganlab'));
      home.appendChild(hbar);
      var hbody = el('div', P + '-hbody');
      hbody.appendChild(el('h4', P + '-hh', '안녕하세요'));
      [90, 66, 78].forEach(function (w) {
        var l = el('span', P + '-skel'); l.style.width = w + '%'; hbody.appendChild(l);
      });
      home.appendChild(hbody);

      var splash = el('button', P + '-splash');
      setAttrs(splash, { type: 'button', 'aria-label': '시작 화면. 누르면 건너뜁니다' });
      splash.innerHTML = '<svg class="' + P + '-mark" viewBox="0 0 64 64" aria-hidden="true">' +
        '<circle class="' + P + '-ring" cx="32" cy="32" r="26" pathLength="100"></circle>' +
        '<circle class="' + P + '-dot" cx="32" cy="32" r="9"></circle></svg>' +
        '<span class="' + P + '-name">juganlab</span>' +
        '<span class="' + P + '-bar" aria-hidden="true"><i></i></span>';
      phone.appendChild(home); phone.appendChild(splash);

      var replay = el('button', 'dm-btn ' + P + '-replay', '스플래시 다시 보기');
      replay.type = 'button';
      var status = el('div', P + '-status', '');
      setAttrs(status, { role: 'status', 'aria-live': 'polite' });
      wrap.appendChild(phone); wrap.appendChild(replay); wrap.appendChild(status);
      stage.appendChild(wrap);

      var timer = 0;
      function finish() {
        clearTimeout(timer);
        phone.classList.add('is-done');
        splash.tabIndex = -1;
        splash.setAttribute('aria-hidden', 'true');
        status.textContent = '본 화면이 열렸습니다.';
      }
      function play() {
        clearTimeout(timer);
        phone.classList.remove('is-run', 'is-done');
        splash.tabIndex = 0;
        splash.removeAttribute('aria-hidden');
        status.textContent = '';
        void phone.offsetWidth;
        phone.classList.add('is-run');
        timer = setTimeout(function () { if (stage.isConnected) finish(); }, reduced() ? 600 : 2700);
      }
      splash.addEventListener('click', finish);
      replay.addEventListener('click', function () { play(); });
      play();
    },
    code: {
      html: '<div id="splash">\n  <svg viewBox="0 0 64 64" aria-hidden="true">\n    <circle class="ring" cx="32" cy="32" r="26" pathLength="100"></circle>\n    <circle class="dot" cx="32" cy="32" r="9"></circle>\n  </svg>\n  <span class="name">juganlab</span>\n</div>\n<main id="app">본 화면</main>',
      css: '#splash { position: fixed; inset: 0; display: grid; place-content: center; justify-items: center; gap: 14px;\n  background: #18202e; color: #fff; transition: transform .6s cubic-bezier(.16, 1, .3, 1), opacity .4s; }\n#splash.done { transform: translateY(-100%); opacity: 0; pointer-events: none; }\n#splash svg { width: 72px; }\n.ring { fill: none; stroke: #e8572a; stroke-width: 3; stroke-linecap: round; stroke-dasharray: 100;\n  stroke-dashoffset: 100; animation: draw 1s .2s forwards; transform: rotate(-90deg); transform-origin: center; }\n.dot { fill: #e8572a; transform-origin: center; animation: pop .5s .9s backwards; }\n.name { animation: rise .5s 1.1s backwards; letter-spacing: .08em; }\n@keyframes draw { to { stroke-dashoffset: 0; } }\n@keyframes pop { from { transform: scale(0); } }\n@keyframes rise { from { opacity: 0; transform: translateY(8px); } }\n@media (prefers-reduced-motion: reduce) { #splash * { animation: none !important; stroke-dashoffset: 0 !important; } }',
      js: 'var splash = document.getElementById("splash");\n// 보통은 앱 준비가 끝났을 때 + 최소 노출 시간(약 2초)을 채운 뒤 닫습니다.\nsetTimeout(function () { splash.classList.add("done"); }, 2200);\nsplash.addEventListener("click", function () { splash.classList.add("done"); });'
    }
  };

  /* ---------- 3. onboarding ---------- */
  window.JL_DEMOS['onboarding'] = {
    mount: function (stage) {
      stage.textContent = '';
      var P = 'dm-onboarding';
      var slides = [
        { t: '할 일을 한곳에', d: '흩어진 메모와 할 일을 한 화면에 모아 둡니다.', art: '<rect x="14" y="18" width="52" height="14" rx="4"/><rect x="14" y="38" width="52" height="14" rx="4"/><rect x="14" y="58" width="34" height="14" rx="4"/>' },
        { t: '제때 알려 드려요', d: '중요한 일만 골라 알림으로 알려 줍니다.', art: '<path d="M40 14c-12 0-18 9-18 20v12l-6 8h48l-6-8V34c0-11-6-20-18-20z"/><circle cx="40" cy="66" r="6"/>' },
        { t: '바로 시작해요', d: '가입 없이 첫 할 일을 적어 보세요.', art: '<circle cx="40" cy="40" r="26"/><path d="M28 41l9 9 16-18" class="tick"/>' }
      ];
      var wrap = el('div', P + '-wrap');
      var phone = el('div', P + '-phone');
      var top = el('div', P + '-top');
      var skip = el('button', P + '-skip', '건너뛰기');
      skip.type = 'button';
      top.appendChild(skip);
      var view = el('div', P + '-view');
      setAttrs(view, { role: 'group', 'aria-roledescription': 'carousel', 'aria-label': '온보딩 안내', tabindex: '0' });
      var track = el('div', P + '-track');
      slides.forEach(function (s, i) {
        var sl = el('div', P + '-slide');
        setAttrs(sl, { role: 'group', 'aria-roledescription': 'slide', 'aria-label': (i + 1) + ' / ' + slides.length });
        sl.innerHTML = '<svg class="' + P + '-art" viewBox="0 0 80 80" aria-hidden="true">' + s.art + '</svg>';
        sl.appendChild(el('h4', P + '-h', s.t));
        sl.appendChild(el('p', P + '-p', s.d));
        track.appendChild(sl);
      });
      view.appendChild(track);
      var foot = el('div', P + '-foot');
      var dots = el('div', P + '-dots');
      var dotBtns = slides.map(function (s, i) {
        var d = el('button', P + '-dot');
        setAttrs(d, { type: 'button', 'aria-label': (i + 1) + '번째 안내로 이동' });
        d.addEventListener('click', function () { go(i); });
        dots.appendChild(d);
        return d;
      });
      var next = el('button', P + '-next', '다음');
      next.type = 'button';
      foot.appendChild(dots); foot.appendChild(next);
      var done = el('div', P + '-done');
      done.hidden = true;
      done.appendChild(el('strong', P + '-dh', '환영합니다'));
      done.appendChild(el('span', P + '-dp', '이제 본 화면으로 들어갑니다.'));
      var again = el('button', P + '-again', '온보딩 다시 보기');
      again.type = 'button';
      done.appendChild(again);
      var live = el('div', P + '-live', '');
      setAttrs(live, { role: 'status', 'aria-live': 'polite' });
      live.className = P + '-sr';
      phone.appendChild(top); phone.appendChild(view); phone.appendChild(foot); phone.appendChild(done);
      wrap.appendChild(phone); wrap.appendChild(live);
      stage.appendChild(wrap);

      var cur = 0;
      function go(i) {
        cur = Math.max(0, Math.min(slides.length - 1, i));
        track.style.transform = 'translateX(' + (-cur * 100 / slides.length) + '%)';
        dotBtns.forEach(function (d, j) {
          if (j === cur) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
        });
        track.children[cur].classList.remove('is-in'); void track.children[cur].offsetWidth; track.children[cur].classList.add('is-in');
        Array.prototype.forEach.call(track.children, function (s, j) { s.setAttribute('aria-hidden', String(j !== cur)); });
        var last = cur === slides.length - 1;
        next.textContent = last ? '시작하기' : '다음';
        skip.style.visibility = last ? 'hidden' : 'visible';
        live.textContent = (cur + 1) + ' / ' + slides.length + ' ' + slides[cur].t;
      }
      function finish() {
        done.hidden = false;
        phone.classList.add('is-done');
        again.focus();
      }
      next.addEventListener('click', function () { if (cur === slides.length - 1) finish(); else go(cur + 1); });
      skip.addEventListener('click', finish);
      again.addEventListener('click', function () {
        done.hidden = true; phone.classList.remove('is-done'); go(0); next.focus();
      });
      view.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
      });
      var sx = null;
      view.addEventListener('pointerdown', function (e) { sx = e.clientX; });
      view.addEventListener('pointerup', function (e) {
        if (sx == null) return;
        var dx = e.clientX - sx; sx = null;
        if (dx < -40) go(cur + 1); else if (dx > 40) go(cur - 1);
      });
      view.addEventListener('pointercancel', function () { sx = null; });
      go(0);
    },
    code: {
      html: '<div class="ob">\n  <button class="skip">건너뛰기</button>\n  <div class="view" tabindex="0" aria-label="온보딩 안내">\n    <div class="track">\n      <section class="slide"><h2>할 일을 한곳에</h2><p>메모를 모아 둡니다.</p></section>\n      <section class="slide"><h2>제때 알려 드려요</h2><p>중요한 일만 알립니다.</p></section>\n      <section class="slide"><h2>바로 시작해요</h2><p>가입 없이 써 보세요.</p></section>\n    </div>\n  </div>\n  <div class="dots"></div>\n  <button class="next">다음</button>\n</div>',
      css: '.ob { max-width: 300px; margin: auto; }\n.view { overflow: hidden; }\n.track { display: flex; width: 300%; transition: transform .45s cubic-bezier(.16, 1, .3, 1); }\n.slide { width: calc(100% / 3); padding: 24px; text-align: center; }\n.dots { display: flex; gap: 6px; justify-content: center; margin: 12px 0; }\n.dots button { width: 8px; height: 8px; padding: 0; border: 0; border-radius: 4px; background: #0003; cursor: pointer;\n  transition: width .3s, background .3s; }\n.dots button[aria-current] { width: 22px; background: #e8572a; }',
      js: 'var track = document.querySelector(".track");\nvar dotsBox = document.querySelector(".dots");\nvar next = document.querySelector(".next");\nvar N = track.children.length, cur = 0;\nfor (var i = 0; i < N; i++) {\n  var d = document.createElement("button");\n  d.setAttribute("aria-label", (i + 1) + "번째로 이동");\n  d.onclick = (function (n) { return function () { go(n); }; })(i);\n  dotsBox.appendChild(d);\n}\nfunction go(i) {\n  cur = Math.max(0, Math.min(N - 1, i));\n  track.style.transform = "translateX(" + (-cur * 100 / N) + "%)";\n  Array.prototype.forEach.call(dotsBox.children, function (d, j) {\n    if (j === cur) d.setAttribute("aria-current", "step"); else d.removeAttribute("aria-current");\n  });\n  next.textContent = cur === N - 1 ? "시작하기" : "다음";\n}\nnext.onclick = function () { cur === N - 1 ? finish() : go(cur + 1); };\ndocument.querySelector(".skip").onclick = finish;\nfunction finish() { document.querySelector(".ob").innerHTML = "<p>환영합니다</p>"; }\ndocument.querySelector(".view").addEventListener("keydown", function (e) {\n  if (e.key === "ArrowRight") go(cur + 1);\n  if (e.key === "ArrowLeft") go(cur - 1);\n});\ngo(0);'
    }
  };

  /* ---------- 4. placeholder ---------- */
  window.JL_DEMOS['placeholder'] = {
    mount: function (stage) {
      stage.textContent = '';
      var P = 'dm-placeholder';
      var wrap = el('div', P + '-wrap');

      /* 왼쪽: 입력 힌트 */
      var A = el('section', P + '-col');
      A.appendChild(el('h4', P + '-cap', '입력 힌트'));
      var card = el('div', P + '-card');
      var f1 = el('div', P + '-field');
      var i1 = el('input', P + '-input');
      setAttrs(i1, { type: 'text', placeholder: '이메일', 'aria-label': '이메일 (힌트만 있는 칸)', id: P + '-a' });
      f1.appendChild(i1);
      f1.appendChild(el('p', P + '-note is-bad', '입력을 시작하면 힌트가 사라집니다. 무슨 칸이었는지 잊게 됩니다.'));
      var f2 = el('div', P + '-field');
      var l2 = el('label', P + '-label', '이메일');
      l2.setAttribute('for', P + '-b');
      var i2 = el('input', P + '-input');
      setAttrs(i2, { type: 'email', placeholder: '예) name@example.com', id: P + '-b' });
      f2.appendChild(l2); f2.appendChild(i2);
      f2.appendChild(el('p', P + '-note is-good', '라벨은 남고, 힌트는 예시만 보여 줍니다.'));
      card.appendChild(f1); card.appendChild(f2);
      A.appendChild(card);

      /* 오른쪽: 스켈레톤 */
      var B = el('section', P + '-col');
      B.appendChild(el('h4', P + '-cap', '스켈레톤'));
      var sk = el('div', P + '-card');
      var live = el('div', P + '-live');
      var head = el('div', P + '-profile');
      var av = el('span', P + '-avatar');
      var lines = el('div', P + '-lines');
      var ln1 = el('span', P + '-ln1'), ln2 = el('span', P + '-ln2');
      lines.appendChild(ln1); lines.appendChild(ln2);
      head.appendChild(av); head.appendChild(lines);
      var body1 = el('span', P + '-body'), body2 = el('span', P + '-body is-short');
      live.appendChild(head); live.appendChild(body1); live.appendChild(body2);
      sk.appendChild(live);
      var reload = el('button', 'dm-btn ' + P + '-reload', '다시 불러오기');
      reload.type = 'button';
      sk.appendChild(reload);
      B.appendChild(sk);
      var status = el('div', P + '-status', '');
      setAttrs(status, { role: 'status', 'aria-live': 'polite' });
      B.appendChild(status);

      wrap.appendChild(A); wrap.appendChild(B);
      stage.appendChild(wrap);

      var timer = 0;
      function load() {
        clearTimeout(timer);
        live.classList.add('is-loading');
        live.setAttribute('aria-busy', 'true');
        av.textContent = ''; ln1.textContent = ''; ln2.textContent = ''; body1.textContent = ''; body2.textContent = '';
        reload.disabled = true;
        status.textContent = '불러오는 중입니다.';
        timer = setTimeout(function () {
          if (!stage.isConnected) return;
          av.textContent = '주'; ln1.textContent = '주간실험실'; ln2.textContent = '방금 전';
          body1.textContent = '작은 실험을 매주 하나씩 만들어 올립니다.';
          body2.textContent = '이번 주는 메뉴 패턴입니다.';
          live.classList.remove('is-loading');
          live.removeAttribute('aria-busy');
          reload.disabled = false;
          status.textContent = '불러오기 완료.';
        }, reduced() ? 300 : 1800);
      }
      reload.addEventListener('click', load);
      load();
    },
    code: {
      html: '<!-- 입력 힌트: 라벨은 남기고 placeholder 는 예시만 -->\n<label for="email">이메일</label>\n<input id="email" type="email" placeholder="예) name@example.com">\n\n<!-- 스켈레톤: 로딩 중 자리표시자 -->\n<div id="card" class="loading" aria-busy="true">\n  <span class="avatar"></span>\n  <span class="line"></span>\n  <span class="line short"></span>\n</div>',
      css: 'input { padding: 10px 12px; border: 1px solid #0003; border-radius: 8px; }\ninput::placeholder { color: #8a92a0; }\n.loading span { display: block; border-radius: 6px; margin: 8px 0; color: transparent;\n  background: linear-gradient(90deg, #0001 25%, #0002 50%, #0001 75%) 0 0 / 200% 100%;\n  animation: shimmer 1.4s linear infinite; }\n.avatar { width: 44px; height: 44px; border-radius: 50% !important; }\n.line { height: 12px; } .short { width: 60%; }\n@keyframes shimmer { to { background-position: -200% 0; } }\n@media (prefers-reduced-motion: reduce) { .loading span { animation: none; } }',
      js: 'var card = document.getElementById("card");\n// 데이터가 도착하면 스켈레톤을 실제 내용으로 바꿉니다.\nsetTimeout(function () {\n  card.classList.remove("loading");\n  card.removeAttribute("aria-busy");\n  card.innerHTML = "<strong>주간실험실</strong><p>방금 전</p>";\n}, 1800); // 실제로는 fetch 가 끝났을 때'
    }
  };
})();

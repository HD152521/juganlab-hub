(function () {
  'use strict';
  var D = (window.JL_DEMOS = window.JL_DEMOS || {});

  var EASES = [
    ['cubic-bezier(0.16, 1, 0.3, 1)', '부드럽게 멈춤'],
    ['ease', 'ease'],
    ['linear', 'linear'],
    ['cubic-bezier(0.34, 1.56, 0.64, 1)', '튕김'],
    ['ease-in-out', 'ease-in-out']
  ];

  function reduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function h(tag, cls, text, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // stage 를 비우고 [view | 조절 줄] 뼈대를 만든다
  function frame(stage, id) {
    stage.textContent = '';
    var root = h('div', 'dm-' + id + '-root');
    var view = h('div', 'dm-' + id + '-view');
    var bar = h('div', 'dm-' + id + '-bar');
    root.append(view, bar);
    stage.append(root);
    return { view: view, bar: bar };
  }

  function slider(bar, id, label, min, max, val, step, fmt, on) {
    var w = h('label', 'dm-' + id + '-ctl');
    var i = h('input', null, null, { type: 'range', min: min, max: max, step: step, value: val });
    var o = h('output', 'dm-' + id + '-out', fmt(val));
    i.addEventListener('input', function () {
      o.textContent = fmt(+i.value);
      if (on) on(+i.value);
    });
    w.append(h('span', null, label), i, o);
    bar.append(w);
    return i;
  }

  function select(bar, id, label, opts, on) {
    var w = h('label', 'dm-' + id + '-ctl');
    var s = h('select');
    opts.forEach(function (o) {
      s.append(h('option', null, o[1], { value: o[0] }));
    });
    s.addEventListener('change', function () { on(s.value); });
    w.append(h('span', null, label), s);
    bar.append(w);
    return s;
  }

  function replayBtn(bar, fn) {
    var b = h('button', 'dm-btn primary', '다시 재생', { type: 'button' });
    b.addEventListener('click', fn);
    bar.append(b);
    return b;
  }

  // FLIP: el 의 현재(최종) 자리 기준으로 from 사각형에서 출발하는 애니메이션
  function flip(el, from, dur, ease, back) {
    var to = el.getBoundingClientRect();
    var a = 'translate(' + (from.left - to.left) + 'px,' + (from.top - to.top) + 'px) scale(' +
      from.width / to.width + ',' + from.height / to.height + ')';
    var kf = [{ transform: a }, { transform: 'none' }];
    if (back) kf.reverse();
    return el.animate(kf, { duration: dur, easing: ease, fill: back ? 'forwards' : 'none' });
  }

  /* ---------- 1. fade-up ---------- */
  D['fade-up'] = {
    mount: function (stage) {
      var f = frame(stage, 'fade-up');
      var dur = 700, dist = 24, ease = EASES[0][0];
      var card = h('div', 'dm-fade-up-card');
      card.append(
        h('span', 'dm-fade-up-tag', 'NEW'),
        h('h3', 'dm-fade-up-title', '천천히 올라오는 카드'),
        h('p', 'dm-fade-up-text', '투명도와 위치를 함께 바꾸면 요소가 자리를 잡으며 나타납니다.')
      );
      f.view.append(card);

      function play() {
        card.style.transition = 'none';
        card.style.opacity = '0';
        card.style.transform = 'translateY(' + dist + 'px)';
        if (reduced()) {
          card.style.opacity = '1';
          card.style.transform = 'none';
          return;
        }
        void card.offsetWidth;
        card.style.transition = 'opacity ' + dur + 'ms ' + ease + ', transform ' + dur + 'ms ' + ease;
        card.style.opacity = '1';
        card.style.transform = 'none';
      }

      slider(f.bar, 'fade-up', '거리', 0, 80, dist, 4, function (v) { return v + 'px'; }, function (v) { dist = v; play(); });
      slider(f.bar, 'fade-up', '시간', 150, 1600, dur, 50, function (v) { return v + 'ms'; }, function (v) { dur = v; play(); });
      select(f.bar, 'fade-up', '이징', EASES, function (v) { ease = v; play(); });
      replayBtn(f.bar, play);
      play();
    },
    code: {
      html: '<div class="fade-up">안녕하세요</div>',
      css: '.fade-up {\n  opacity: 0;\n  transform: translateY(24px);\n  transition: opacity .6s ease-out, transform .6s ease-out;\n}\n.fade-up.is-in {\n  opacity: 1;\n  transform: none;\n}\n@media (prefers-reduced-motion: reduce) {\n  .fade-up { transition: none; opacity: 1; transform: none; }\n}',
      js: 'const io = new IntersectionObserver((entries) => {\n  entries.forEach((e) => {\n    if (e.isIntersecting) {\n      e.target.classList.add(\'is-in\');\n      io.unobserve(e.target);\n    }\n  });\n});\ndocument.querySelectorAll(\'.fade-up\').forEach((el) => io.observe(el));'
    }
  };

  /* ---------- 2. stagger ---------- */
  D['stagger'] = {
    mount: function (stage) {
      var f = frame(stage, 'stagger');
      var gap = 80, dur = 520, ease = EASES[0][0], order = 'start';
      var grid = h('div', 'dm-stagger-grid', null, { role: 'list', 'aria-label': '계단식 등장 예시' });
      var tiles = [];
      for (var i = 0; i < 8; i++) {
        var t = h('div', 'dm-stagger-tile' + (i === 0 ? ' is-first' : ''), String(i + 1), { role: 'listitem' });
        tiles.push(t);
        grid.append(t);
      }
      f.view.append(grid);

      function rank(i) {
        if (order === 'end') return tiles.length - 1 - i;
        if (order === 'center') return Math.round(Math.abs(i - (tiles.length - 1) / 2) * 2) / 2;
        return i;
      }

      function play() {
        var rm = reduced();
        tiles.forEach(function (t) {
          t.style.transition = 'none';
          t.style.opacity = rm ? '1' : '0';
          t.style.transform = rm ? 'none' : 'translateY(18px) scale(0.9)';
        });
        if (rm) return;
        void grid.offsetWidth;
        tiles.forEach(function (t, i) {
          var d = rank(i) * gap;
          t.style.transition = 'opacity ' + dur + 'ms ' + ease + ' ' + d + 'ms, transform ' + dur + 'ms ' + ease + ' ' + d + 'ms';
          t.style.opacity = '1';
          t.style.transform = 'none';
        });
      }

      slider(f.bar, 'stagger', '간격', 0, 250, gap, 10, function (v) { return v + 'ms'; }, function (v) { gap = v; play(); });
      select(f.bar, 'stagger', '순서', [['start', '앞에서부터'], ['end', '뒤에서부터'], ['center', '가운데서부터']], function (v) { order = v; play(); });
      select(f.bar, 'stagger', '이징', EASES, function (v) { ease = v; play(); });
      replayBtn(f.bar, play);
      play();
    },
    code: {
      html: '<ul class="list">\n  <li>하나</li><li>둘</li><li>셋</li><li>넷</li>\n</ul>',
      css: '.list li {\n  opacity: 0;\n  transform: translateY(18px);\n  transition: opacity .5s ease-out, transform .5s ease-out;\n}\n.list.is-in li {\n  opacity: 1;\n  transform: none;\n}\n@media (prefers-reduced-motion: reduce) {\n  .list li { transition: none; opacity: 1; transform: none; }\n}',
      js: 'const list = document.querySelector(\'.list\');\nconst GAP = 80; // ms\nlist.querySelectorAll(\'li\').forEach((li, i) => {\n  li.style.transitionDelay = i * GAP + \'ms\';\n});\nrequestAnimationFrame(() => list.classList.add(\'is-in\'));'
    }
  };

  /* ---------- 3. spring ---------- */
  D['spring'] = {
    mount: function (stage) {
      var f = frame(stage, 'spring');
      var R = 18;
      var k = 170, c = 14;
      var area = h('div', 'dm-spring-area', null, {
        tabindex: '0',
        role: 'group',
        'aria-label': '스프링 놀이판. 빈 곳을 누르면 목표가 옮겨지고, 공을 끌어 놓으면 목표로 돌아갑니다. 화살표 키로도 목표를 옮길 수 있습니다.'
      });
      var mark = h('div', 'dm-spring-target', null, { 'aria-hidden': 'true' });
      var ball = h('div', 'dm-spring-ball', null, { 'aria-hidden': 'true' });
      var hint = h('div', 'dm-spring-hint', '빈 곳 클릭 = 목표 이동 · 공 드래그 · 방향키', { 'aria-hidden': 'true' });
      var zeta = h('div', 'dm-spring-zeta');
      area.append(mark, ball, hint);
      f.view.append(area, zeta);

      var p = { x: 0, y: 0 }, v = { x: 0, y: 0 }, tg = { x: 0, y: 0 };
      var drag = false, raf = 0, last = 0, grab = { x: 0, y: 0 }, prevPt = null;

      function size() { return { w: area.clientWidth || 280, h: area.clientHeight || 190 }; }
      function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
      function draw() {
        ball.style.transform = 'translate(' + (p.x - R) + 'px,' + (p.y - R) + 'px)';
        mark.style.transform = 'translate(' + (tg.x - 7) + 'px,' + (tg.y - 7) + 'px)';
      }
      function info() {
        var z = c / (2 * Math.sqrt(k));
        zeta.textContent = '감쇠비 ' + z.toFixed(2) + ' — ' + (z < 0.95 ? '목표를 지나쳤다 돌아옴' : z < 1.05 ? '딱 맞게 멈춤' : '느리게 다가감');
      }
      function energy() {
        return Math.abs(p.x - tg.x) + Math.abs(p.y - tg.y) + Math.abs(v.x) + Math.abs(v.y);
      }
      function tick(t) {
        raf = 0;
        if (!stage.isConnected) return;
        var dt = Math.min(0.032, (t - last) / 1000 || 0.016);
        last = t;
        if (!drag) {
          var steps = 4, s = dt / steps;
          for (var i = 0; i < steps; i++) {
            v.x += (-k * (p.x - tg.x) - c * v.x) * s;
            v.y += (-k * (p.y - tg.y) - c * v.y) * s;
            p.x += v.x * s;
            p.y += v.y * s;
          }
        }
        draw();
        if (drag || energy() > 0.4) {
          raf = requestAnimationFrame(tick);
        } else {
          p.x = tg.x; p.y = tg.y; v.x = 0; v.y = 0;
          draw();
        }
      }
      function kick() {
        if (reduced()) { p.x = tg.x; p.y = tg.y; v.x = 0; v.y = 0; draw(); return; }
        if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
      }
      function local(e) {
        var r = area.getBoundingClientRect();
        var s = size();
        return { x: clamp(e.clientX - r.left, R, s.w - R), y: clamp(e.clientY - r.top, R, s.h - R) };
      }

      area.addEventListener('pointerdown', function (e) {
        var pt = local(e);
        if (e.target === ball) {
          drag = true;
          grab = { x: pt.x - p.x, y: pt.y - p.y };
          prevPt = { x: pt.x, y: pt.y, t: performance.now() };
          v.x = 0; v.y = 0;
          area.setPointerCapture(e.pointerId);
          ball.classList.add('is-grab');
          kick();
        } else {
          tg = pt;
          draw();
          kick();
        }
      });
      area.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var pt = local(e);
        var now = performance.now();
        var dt = Math.max(0.008, (now - prevPt.t) / 1000);
        v.x = clamp((pt.x - prevPt.x) / dt, -900, 900);
        v.y = clamp((pt.y - prevPt.y) / dt, -900, 900);
        prevPt = { x: pt.x, y: pt.y, t: now };
        p.x = clamp(pt.x - grab.x, R, size().w - R);
        p.y = clamp(pt.y - grab.y, R, size().h - R);
        draw();
      });
      function release() {
        if (!drag) return;
        drag = false;
        ball.classList.remove('is-grab');
        kick();
      }
      area.addEventListener('pointerup', release);
      area.addEventListener('pointercancel', release);
      area.addEventListener('keydown', function (e) {
        var d = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] }[e.key];
        if (!d) return;
        e.preventDefault();
        var s = size();
        tg = { x: clamp(tg.x + d[0], R, s.w - R), y: clamp(tg.y + d[1], R, s.h - R) };
        draw();
        kick();
      });

      function replay() {
        var s = size();
        tg = { x: s.w / 2, y: s.h / 2 };
        p = { x: R + 6, y: R + 6 };
        v = { x: 0, y: 0 };
        draw();
        kick();
      }

      slider(f.bar, 'spring', '강성', 20, 600, k, 10, function (x) { return String(x); }, function (x) { k = x; info(); });
      slider(f.bar, 'spring', '감쇠', 1, 40, c, 1, function (x) { return String(x); }, function (x) { c = x; info(); });
      replayBtn(f.bar, replay);
      info();
      replay();
    },
    code: {
      html: '<div id="area" style="position:relative;height:200px">\n  <div id="ball" style="position:absolute;width:36px;height:36px;border-radius:50%;background:#e8572a"></div>\n</div>',
      js: 'const area = document.getElementById(\'area\');\nconst ball = document.getElementById(\'ball\');\nlet k = 170, c = 14;           // 강성, 감쇠\nlet p = { x: 20, y: 20 }, v = { x: 0, y: 0 };\nlet target = { x: 150, y: 100 }, last = 0, raf = 0;\n\nfunction tick(t) {\n  const dt = Math.min(0.032, (t - last) / 1000 || 0.016);\n  last = t;\n  for (const a of [\'x\', \'y\']) {\n    v[a] += (-k * (p[a] - target[a]) - c * v[a]) * dt;\n    p[a] += v[a] * dt;\n  }\n  ball.style.transform = \'translate(\' + (p.x - 18) + \'px,\' + (p.y - 18) + \'px)\';\n  const moving = Math.abs(p.x - target.x) + Math.abs(v.x) + Math.abs(p.y - target.y) + Math.abs(v.y) > 0.4;\n  raf = moving ? requestAnimationFrame(tick) : 0;\n}\narea.addEventListener(\'click\', (e) => {\n  const r = area.getBoundingClientRect();\n  target = { x: e.clientX - r.left, y: e.clientY - r.top };\n  if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }\n});\nlast = performance.now();\nraf = requestAnimationFrame(tick);'
    }
  };

  /* ---------- 4. count-up ---------- */
  var COUNT_EASE = {
    'linear': function (t) { return t; },
    'ease-out': function (t) { return 1 - Math.pow(1 - t, 3); },
    'ease-in-out': function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    'expo': function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    'back': function (t) { return 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2); }
  };
  D['count-up'] = {
    mount: function (stage) {
      var f = frame(stage, 'count-up');
      var dur = 1600, ease = 'expo', raf = 0;
      var stats = [
        { label: '이번 달 방문', to: 12840, dec: 0, unit: '명' },
        { label: '만족도', to: 98.6, dec: 1, unit: '%' },
        { label: '누적 후기', to: 2431, dec: 0, unit: '개' }
      ];
      var row = h('div', 'dm-count-up-row');
      var nums = stats.map(function (s) {
        var cell = h('div', 'dm-count-up-cell', null, {
          role: 'img',
          'aria-label': s.label + ' ' + fmt(s.to, s.dec) + s.unit
        });
        var n = h('span', 'dm-count-up-num', fmt(s.to, s.dec), { 'aria-hidden': 'true' });
        cell.append(h('span', 'dm-count-up-label', s.label, { 'aria-hidden': 'true' }), n, h('span', 'dm-count-up-unit', s.unit, { 'aria-hidden': 'true' }));
        row.append(cell);
        return n;
      });
      f.view.append(row);

      function fmt(n, dec) {
        return n.toLocaleString('ko-KR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      }
      function play() {
        cancelAnimationFrame(raf);
        if (reduced()) {
          nums.forEach(function (n, i) { n.textContent = fmt(stats[i].to, stats[i].dec); });
          return;
        }
        var start = performance.now();
        function frame1(now) {
          if (!stage.isConnected) return;
          var t = Math.min(1, (now - start) / dur);
          var e = COUNT_EASE[ease](t);
          nums.forEach(function (n, i) { n.textContent = fmt(stats[i].to * e, stats[i].dec); });
          if (t < 1) raf = requestAnimationFrame(frame1);
          else nums.forEach(function (n, i) { n.textContent = fmt(stats[i].to, stats[i].dec); });
        }
        raf = requestAnimationFrame(frame1);
      }

      slider(f.bar, 'count-up', '시간', 400, 4000, dur, 100, function (v) { return v + 'ms'; }, function (v) { dur = v; play(); });
      select(f.bar, 'count-up', '이징', [['expo', '끝에서 천천히'], ['ease-out', 'ease-out'], ['ease-in-out', 'ease-in-out'], ['linear', 'linear'], ['back', '목표 넘었다 돌아옴']], function (v) { ease = v; play(); });
      replayBtn(f.bar, play);
      play();
    },
    code: {
      html: '<p>방문자 <strong id="num" aria-label="12,840명">12,840</strong>명</p>',
      js: 'const el = document.getElementById(\'num\');\nconst TO = 12840, DURATION = 1600;\nconst easeOut = (t) => 1 - Math.pow(1 - t, 3);\n\nif (matchMedia(\'(prefers-reduced-motion: reduce)\').matches) {\n  el.textContent = TO.toLocaleString();\n} else {\n  const start = performance.now();\n  const step = (now) => {\n    const t = Math.min(1, (now - start) / DURATION);\n    el.textContent = Math.round(TO * easeOut(t)).toLocaleString();\n    if (t < 1) requestAnimationFrame(step);\n  };\n  requestAnimationFrame(step);\n}'
    }
  };

  /* ---------- 5. typing ---------- */
  D['typing'] = {
    mount: function (stage) {
      var f = frame(stage, 'typing');
      var cps = 12, gen = 0;
      var lines = ['안녕하세요, 주간실험실입니다.', '움직임은 작게, 의미는 크게.', '글자가 한 자씩 찍힙니다.'];
      var box = h('div', 'dm-typing-box', null, { role: 'img', 'aria-label': lines.join(' / ') });
      var out = h('span', 'dm-typing-text', '', { 'aria-hidden': 'true' });
      var caret = h('span', 'dm-typing-caret', null, { 'aria-hidden': 'true' });
      box.append(out, caret);
      f.view.append(box);

      function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
      async function run() {
        var my = ++gen;
        var alive = function () { return my === gen && stage.isConnected; };
        var i = 0;
        if (reduced()) {
          while (alive()) {
            out.textContent = lines[i++ % lines.length];
            await wait(2600);
          }
          return;
        }
        while (alive()) {
          var s = lines[i++ % lines.length];
          for (var c = 1; c <= s.length && alive(); c++) {
            out.textContent = s.slice(0, c);
            await wait((1000 / cps) * (0.6 + Math.random() * 0.8));
          }
          await wait(1300);
          for (var d = s.length - 1; d >= 0 && alive(); d--) {
            out.textContent = s.slice(0, d);
            await wait(1000 / (cps * 2.4));
          }
          await wait(350);
        }
      }

      slider(f.bar, 'typing', '속도', 3, 30, cps, 1, function (v) { return v + '자/초'; }, function (v) { cps = v; });
      replayBtn(f.bar, function () { out.textContent = ''; run(); });
      run();
    },
    code: {
      html: '<p><span id="typed"></span><span class="caret"></span></p>',
      css: '.caret {\n  display: inline-block;\n  width: 2px;\n  height: 1.1em;\n  margin-left: 2px;\n  vertical-align: text-bottom;\n  background: currentColor;\n  animation: blink 1s steps(1) infinite;\n}\n@keyframes blink { 50% { opacity: 0; } }\n@media (prefers-reduced-motion: reduce) { .caret { animation: none; } }',
      js: 'const el = document.getElementById(\'typed\');\nconst lines = [\'안녕하세요.\', \'글자가 한 자씩 찍힙니다.\'];\nconst wait = (ms) => new Promise((r) => setTimeout(r, ms));\n\n(async function loop() {\n  for (let i = 0; ; i = (i + 1) % lines.length) {\n    const s = lines[i];\n    for (let c = 1; c <= s.length; c++) {\n      el.textContent = s.slice(0, c);\n      await wait(80);\n    }\n    await wait(1300);\n    for (let c = s.length - 1; c >= 0; c--) {\n      el.textContent = s.slice(0, c);\n      await wait(35);\n    }\n    await wait(350);\n  }\n})();'
    }
  };

  /* ---------- 6. scramble ---------- */
  D['scramble'] = {
    mount: function (stage) {
      var f = frame(stage, 'scramble');
      var phrases = ['움직임에도 문법이 있습니다', 'DECODE: 글자가 풀립니다', '다시 읽히는 순간'];
      var cur = phrases[0], per = 60, raf = 0;
      var out = h('div', 'dm-scramble-text', cur, { 'aria-hidden': 'true' });
      var wrap = h('div', 'dm-scramble-wrap', null, { role: 'img', 'aria-label': cur });
      wrap.append(out);
      f.view.append(wrap);

      var HANGUL = '가나다라마바사아자차카타파하';
      var OTHER = '!<>-_/[]{}=+*^?#';
      function rnd(ch) {
        var pool = /[가-힣]/.test(ch) ? HANGUL : OTHER;
        return pool[Math.floor(Math.random() * pool.length)];
      }
      function play() {
        cancelAnimationFrame(raf);
        wrap.setAttribute('aria-label', cur);
        if (reduced()) { out.textContent = cur; return; }
        var start = performance.now(), lastSwap = 0, buf = [];
        function step(now) {
          if (!stage.isConnected) return;
          var t = now - start, done = true, s = '';
          var swap = now - lastSwap > 50;
          if (swap) lastSwap = now;
          for (var i = 0; i < cur.length; i++) {
            var ch = cur[i];
            if (ch === ' ') { s += ' '; continue; }
            if (t >= i * per + 350) { s += ch; continue; }
            done = false;
            if (swap || !buf[i]) buf[i] = rnd(ch);
            s += buf[i];
          }
          out.textContent = s;
          if (!done) raf = requestAnimationFrame(step);
        }
        raf = requestAnimationFrame(step);
      }

      slider(f.bar, 'scramble', '풀리는 간격', 15, 160, per, 5, function (v) { return v + 'ms'; }, function (v) { per = v; play(); });
      select(f.bar, 'scramble', '문구', phrases.map(function (s) { return [s, s.length > 12 ? s.slice(0, 11) + '…' : s]; }), function (v) { cur = v; play(); });
      replayBtn(f.bar, play);
      play();
    },
    code: {
      html: '<h2 id="title" aria-label="글자가 풀립니다">글자가 풀립니다</h2>',
      js: 'const el = document.getElementById(\'title\');\nconst text = el.textContent;\nconst POOL = \'!<>-_/[]{}=+*^?#\';\n\nfunction scramble() {\n  const start = performance.now();\n  (function step(now) {\n    const t = now - start;\n    let out = \'\', done = true;\n    for (let i = 0; i < text.length; i++) {\n      if (text[i] === \' \' || t >= i * 60 + 350) out += text[i];\n      else { done = false; out += POOL[Math.floor(Math.random() * POOL.length)]; }\n    }\n    el.textContent = out;\n    if (!done) requestAnimationFrame(step);\n  })(start);\n}\nif (!matchMedia(\'(prefers-reduced-motion: reduce)\').matches) scramble();'
    }
  };

  /* ---------- 7. mask-reveal ---------- */
  var MASKS = {
    left: ['inset(0 100% 0 0)', 'inset(0 0 0 0)'],
    right: ['inset(0 0 0 100%)', 'inset(0 0 0 0)'],
    down: ['inset(0 0 100% 0)', 'inset(0 0 0 0)'],
    up: ['inset(100% 0 0 0)', 'inset(0 0 0 0)'],
    center: ['inset(0 50% 0 50%)', 'inset(0 0 0 0)'],
    circle: ['circle(0% at 50% 50%)', 'circle(80% at 50% 50%)']
  };
  D['mask-reveal'] = {
    mount: function (stage) {
      var f = frame(stage, 'mask-reveal');
      var dir = 'left', dur = 900, ease = EASES[0][0];
      var box = h('div', 'dm-mask-reveal-box');
      var title = h('h3', 'dm-mask-reveal-title', '가려졌다가 드러납니다');
      var sub = h('p', 'dm-mask-reveal-sub', 'clip-path 영역을 넓혀 보여 줍니다.');
      var shape = h('div', 'dm-mask-reveal-shape', null, { 'aria-hidden': 'true' });
      var els = [title, sub, shape];
      box.append(title, sub, shape);
      f.view.append(box);

      function play() {
        var m = MASKS[dir], rm = reduced();
        els.forEach(function (e, i) {
          e.style.transition = 'none';
          e.style.clipPath = rm ? m[1] : m[0];
          if (rm) return;
          void e.offsetWidth;
          var d = i * 140;
          e.style.transition = 'clip-path ' + dur + 'ms ' + ease + ' ' + d + 'ms';
          e.style.clipPath = m[1];
        });
      }

      slider(f.bar, 'mask-reveal', '시간', 200, 2000, dur, 50, function (v) { return v + 'ms'; }, function (v) { dur = v; play(); });
      select(f.bar, 'mask-reveal', '모양', [['left', '왼쪽에서'], ['right', '오른쪽에서'], ['down', '위에서'], ['up', '아래에서'], ['center', '가운데서 양옆으로'], ['circle', '원으로']], function (v) { dir = v; play(); });
      select(f.bar, 'mask-reveal', '이징', EASES, function (v) { ease = v; play(); });
      replayBtn(f.bar, play);
      play();
    },
    code: {
      html: '<h2 class="reveal">가려졌다가 드러납니다</h2>',
      css: '.reveal {\n  clip-path: inset(0 100% 0 0);\n  transition: clip-path .9s cubic-bezier(.16, 1, .3, 1);\n}\n.reveal.is-in {\n  clip-path: inset(0 0 0 0);\n}\n@media (prefers-reduced-motion: reduce) {\n  .reveal { transition: none; clip-path: inset(0 0 0 0); }\n}',
      js: 'const el = document.querySelector(\'.reveal\');\nrequestAnimationFrame(() => {\n  requestAnimationFrame(() => el.classList.add(\'is-in\'));\n});'
    }
  };

  /* ---------- 8. zoom-transition ---------- */
  var TILE_TEXT = [
    ['새벽 시장', '아직 불이 켜지지 않은 골목에서 가장 먼저 열리는 가게들을 담았습니다.'],
    ['오래된 책방', '책장 사이로 들어오는 오후 햇빛이 한 칸씩 자리를 옮깁니다.'],
    ['빗소리 정류장', '버스를 기다리는 몇 분 동안 우산 위로 떨어지는 소리를 모았습니다.'],
    ['옥상 화분', '좁은 옥상에서도 자라는 허브와 고추 이야기입니다.'],
    ['야간 열차', '창밖 불빛이 지나가는 속도를 기억해 두었습니다.'],
    ['작은 부두', '해가 질 무렵 배가 돌아오는 방향을 따라가 봅니다.']
  ];
  D['zoom-transition'] = {
    mount: function (stage) {
      var f = frame(stage, 'zoom-transition');
      var dur = 520, ease = EASES[0][0], openIdx = -1, busy = false;
      var grid = h('div', 'dm-zoom-transition-grid');
      var thumbs = TILE_TEXT.map(function (t, i) {
        var b = h('button', 'dm-zoom-transition-thumb dm-zoom-transition-tone' + i, t[0], { type: 'button', 'aria-label': t[0] + ' 크게 보기' });
        b.addEventListener('click', function () { open(i); });
        grid.append(b);
        return b;
      });
      var scrim = h('div', 'dm-zoom-transition-scrim');
      var card = h('div', 'dm-zoom-transition-card', null, { role: 'dialog', 'aria-modal': 'false', 'aria-label': '상세 보기' });
      var body = h('div', 'dm-zoom-transition-body');
      var ttl = h('h3', 'dm-zoom-transition-title');
      var txt = h('p', 'dm-zoom-transition-text');
      var close = h('button', 'dm-btn dm-zoom-transition-close', '닫기 (Esc)', { type: 'button' });
      body.append(ttl, txt, close);
      card.append(body);
      scrim.append(card);
      scrim.hidden = true;
      f.view.append(grid, scrim);
      close.addEventListener('click', function () { shut(); });
      stage.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openIdx >= 0) shut(); });

      function open(i) {
        if (busy || openIdx >= 0) return;
        openIdx = i;
        ttl.textContent = TILE_TEXT[i][0];
        txt.textContent = TILE_TEXT[i][1];
        card.className = 'dm-zoom-transition-card dm-zoom-transition-tone' + i;
        scrim.hidden = false;
        if (reduced()) { close.focus(); return; }
        busy = true;
        var from = thumbs[i].getBoundingClientRect();
        flip(card, from, dur, ease, false).onfinish = function () { busy = false; };
        body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.5, delay: dur * 0.45, easing: 'ease-out', fill: 'backwards' });
        scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.6, easing: 'ease-out' });
        close.focus();
      }
      function shut() {
        if (busy || openIdx < 0) return;
        var i = openIdx;
        function done() {
          scrim.hidden = true;
          openIdx = -1;
          busy = false;
          card.getAnimations().forEach(function (a) { a.cancel(); });
          thumbs[i].focus();
        }
        if (reduced()) { done(); return; }
        busy = true;
        var a = flip(card, thumbs[i].getBoundingClientRect(), dur, ease, true);
        body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur * 0.3, fill: 'forwards' });
        scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur * 0.8, fill: 'forwards' });
        a.onfinish = done;
      }

      slider(f.bar, 'zoom-transition', '시간', 150, 1500, dur, 50, function (v) { return v + 'ms'; }, function (v) { dur = v; });
      select(f.bar, 'zoom-transition', '이징', EASES, function (v) { ease = v; });
      replayBtn(f.bar, function () {
        if (busy) return;
        if (openIdx >= 0) { scrim.hidden = true; card.getAnimations().forEach(function (a) { a.cancel(); }); openIdx = -1; }
        open(0);
      });
    },
    code: {
      html: '<button id="thumb">썸네일</button>\n<div id="detail" hidden style="position:fixed;inset:10%;transform-origin:0 0">상세 내용</div>',
      js: 'const thumb = document.getElementById(\'thumb\');\nconst detail = document.getElementById(\'detail\');\n\nthumb.addEventListener(\'click\', () => {\n  const first = thumb.getBoundingClientRect();   // F: 처음 자리\n  detail.hidden = false;\n  const last = detail.getBoundingClientRect();   // L: 나중 자리\n  const dx = first.left - last.left, dy = first.top - last.top;\n  const sx = first.width / last.width, sy = first.height / last.height;\n  if (matchMedia(\'(prefers-reduced-motion: reduce)\').matches) return;\n  detail.animate( // I, P: 뒤집어 출발해서 재생\n    [{ transform: \'translate(\' + dx + \'px,\' + dy + \'px) scale(\' + sx + \',\' + sy + \')\' }, { transform: \'none\' }],\n    { duration: 500, easing: \'cubic-bezier(.16,1,.3,1)\' }\n  );\n});\ndocument.addEventListener(\'keydown\', (e) => { if (e.key === \'Escape\') detail.hidden = true; });'
    }
  };

  /* ---------- 9. shared-element ---------- */
  var ROWS = [
    ['제주 올레 7코스', '바다를 옆에 두고 걷는 4시간 코스입니다.'],
    ['부산 감천마을', '골목마다 색이 다른 계단식 마을입니다.'],
    ['전주 한옥마을', '낮은 지붕 사이로 길이 이어집니다.']
  ];
  D['shared-element'] = {
    mount: function (stage) {
      var f = frame(stage, 'shared-element');
      var dur = 560, ease = EASES[0][0], openIdx = -1, busy = false;
      var list = h('div', 'dm-shared-element-list', null, { role: 'list' });
      var rows = ROWS.map(function (r, i) {
        var li = h('div', null, null, { role: 'listitem' });
        var b = h('button', 'dm-shared-element-row', null, { type: 'button', 'aria-label': r[0] + ' 상세 보기' });
        var img = h('span', 'dm-shared-element-img dm-shared-element-tone' + i, null, { 'aria-hidden': 'true' });
        var tt = h('span', 'dm-shared-element-rt', null);
        var title = h('span', 'dm-shared-element-title', r[0]);
        tt.append(title, h('span', 'dm-shared-element-sub', r[1]));
        b.append(img, tt);
        b.addEventListener('click', function () { open(i); });
        li.append(b);
        list.append(li);
        return { b: b, img: img, title: title };
      });
      var detail = h('div', 'dm-shared-element-detail', null, { role: 'region', 'aria-label': '상세 화면' });
      var dImg = h('div', 'dm-shared-element-himg', null, { 'aria-hidden': 'true' });
      var dTitle = h('h3', 'dm-shared-element-htitle');
      var dText = h('p', 'dm-shared-element-htext');
      var back = h('button', 'dm-btn dm-shared-element-back', '← 목록', { type: 'button' });
      detail.append(dImg, dTitle, dText, back);
      detail.hidden = true;
      f.view.append(list, detail);
      back.addEventListener('click', function () { shut(); });
      stage.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openIdx >= 0) shut(); });

      function open(i) {
        if (busy || openIdx >= 0) return;
        openIdx = i;
        dImg.className = 'dm-shared-element-himg dm-shared-element-tone' + i;
        dTitle.textContent = ROWS[i][0];
        dText.textContent = ROWS[i][1] + ' 목록의 이미지와 제목이 이 화면으로 그대로 이어집니다.';
        var fi = rows[i].img.getBoundingClientRect(), ft = rows[i].title.getBoundingClientRect();
        detail.hidden = false;
        if (reduced()) { back.focus(); return; }
        busy = true;
        flip(dImg, fi, dur, ease, false).onfinish = function () { busy = false; };
        flip(dTitle, ft, dur, ease, false);
        detail.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.4, easing: 'ease-out' });
        dText.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: dur * 0.6, delay: dur * 0.4, easing: 'ease-out', fill: 'backwards' });
        list.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur * 0.5, fill: 'forwards' });
        back.focus();
      }
      function shut() {
        if (busy || openIdx < 0) return;
        var i = openIdx;
        function done() {
          detail.hidden = true;
          openIdx = -1;
          busy = false;
          [list, dImg, dTitle, dText, detail].forEach(function (e) { e.getAnimations().forEach(function (a) { a.cancel(); }); });
          rows[i].b.focus();
        }
        if (reduced()) { done(); return; }
        busy = true;
        var a = flip(dImg, rows[i].img.getBoundingClientRect(), dur, ease, true);
        flip(dTitle, rows[i].title.getBoundingClientRect(), dur, ease, true);
        dText.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur * 0.3, fill: 'forwards' });
        detail.animate([{ background: 'var(--card)' }, { background: 'transparent' }], { duration: dur, fill: 'forwards' });
        list.getAnimations().forEach(function (x) { x.cancel(); });
        list.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.6, delay: dur * 0.4, fill: 'both' });
        a.onfinish = done;
      }

      slider(f.bar, 'shared-element', '시간', 200, 1600, dur, 50, function (v) { return v + 'ms'; }, function (v) { dur = v; });
      select(f.bar, 'shared-element', '이징', EASES, function (v) { ease = v; });
      replayBtn(f.bar, function () {
        if (busy) return;
        if (openIdx >= 0) {
          detail.hidden = true;
          [list, dImg, dTitle, dText, detail].forEach(function (e) { e.getAnimations().forEach(function (a) { a.cancel(); }); });
          openIdx = -1;
        }
        open(0);
      });
    },
    code: {
      html: '<button id="row"><img id="thumb" src="a.jpg" width="48"> 제목</button>\n<section id="page" hidden><img id="hero" src="a.jpg" width="300"></section>',
      js: 'const thumb = document.getElementById(\'thumb\');\nconst hero = document.getElementById(\'hero\');\nconst page = document.getElementById(\'page\');\nhero.style.transformOrigin = \'0 0\';\n\ndocument.getElementById(\'row\').addEventListener(\'click\', () => {\n  const first = thumb.getBoundingClientRect();\n  page.hidden = false;\n  const last = hero.getBoundingClientRect();\n  if (matchMedia(\'(prefers-reduced-motion: reduce)\').matches) return;\n  hero.animate([\n    { transform: \'translate(\' + (first.left - last.left) + \'px,\' + (first.top - last.top) + \'px) scale(\' + first.width / last.width + \',\' + first.height / last.height + \')\' },\n    { transform: \'none\' }\n  ], { duration: 500, easing: \'cubic-bezier(.16,1,.3,1)\' });\n});'
    }
  };
})();

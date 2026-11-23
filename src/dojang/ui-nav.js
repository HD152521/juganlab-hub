/* UI 도감 - 메뉴·이동 (ui-nav) */
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
  function statusLine(cls, text) {
    var s = el('div', cls, text);
    setAttrs(s, { role: 'status', 'aria-live': 'polite' });
    return s;
  }

  /* ---------- 공통: 팝오버 메뉴 (케밥·미트볼) ---------- */
  var bound = typeof WeakSet === 'function' ? new WeakSet() : null;
  function resetMenus(stage) {
    stage._menus = [];
    if (bound && bound.has(stage)) return;
    if (bound) bound.add(stage);
    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('[role="menu"],[aria-haspopup]')) return;
      (stage._menus || []).forEach(function (m) { m.close(false); });
    });
  }
  function popMenu(stage, prefix, btn, host, items, onPick) {
    var id = prefix + '-m' + Math.random().toString(36).slice(2, 7);
    var menu = setAttrs(el('div', prefix + '-menu'), { role: 'menu', id: id });
    menu.hidden = true;
    var btns = items.map(function (it) {
      var b = el('button', prefix + '-item' + (it.danger ? ' is-danger' : ''), it.label);
      setAttrs(b, { type: 'button', role: 'menuitem', tabindex: '-1' });
      b.addEventListener('click', function () { api.close(true); onPick(it); });
      menu.appendChild(b);
      return b;
    });
    host.appendChild(menu);
    setAttrs(btn, { 'aria-haspopup': 'menu', 'aria-controls': id, 'aria-expanded': 'false' });
    var api = {
      close: function (refocus) {
        if (menu.hidden) return;
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        if (refocus) btn.focus();
      },
      open: function (focusFirst) {
        stage._menus.forEach(function (m) { if (m !== api) m.close(false); });
        menu.classList.remove('is-up');
        menu.hidden = false;
        var r = menu.getBoundingClientRect();
        var s = stage.getBoundingClientRect();
        if (r.bottom > s.bottom - 6 && btn.getBoundingClientRect().top - s.top > r.height + 8) menu.classList.add('is-up');
        btn.setAttribute('aria-expanded', 'true');
        if (focusFirst) btns[0].focus();
      }
    };
    stage._menus.push(api);
    btn.addEventListener('click', function (e) {
      if (menu.hidden) api.open(e.detail === 0); else api.close(false);
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); api.open(true); }
    });
    menu.addEventListener('keydown', function (e) {
      var i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); btns[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); btns[btns.length - 1].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); api.close(true); }
      else if (e.key === 'Tab') { api.close(false); }
    });
    return api;
  }

  /* ---------- 1. kebab ---------- */
  window.JL_DEMOS['kebab'] = {
    mount: function (stage) {
      stage.textContent = '';
      resetMenus(stage);
      var P = 'dm-kebab';
      var wrap = el('div', P + '-wrap');
      var list = el('ul', P + '-list');
      var status = statusLine(P + '-status', '파일 옆 ⋮ 를 눌러 보세요.');
      var rows = [
        ['분기 보고서.pdf', '2.4 MB'],
        ['회의록 1월.md', '12 KB'],
        ['로고 시안 최종.png', '860 KB']
      ];
      rows.forEach(function (r) {
        var li = el('li', P + '-row');
        li.appendChild(el('span', P + '-ico'));
        var txt = el('div', P + '-txt');
        txt.appendChild(el('strong', P + '-name', r[0]));
        txt.appendChild(el('span', P + '-meta', r[1]));
        li.appendChild(txt);
        var anchor = el('div', P + '-anchor');
        var btn = el('button', P + '-btn');
        setAttrs(btn, { type: 'button', 'aria-label': r[0] + ' 더보기' });
        btn.appendChild(el('span', P + '-dots'));
        anchor.appendChild(btn);
        popMenu(stage, P, btn, anchor, [
          { label: '이름 바꾸기' }, { label: '복사' }, { label: '삭제', danger: true }
        ], function (it) { status.textContent = r[0] + ' - ' + it.label + ' 를 골랐습니다.'; });
        li.appendChild(anchor);
        list.appendChild(li);
      });
      wrap.appendChild(list);
      wrap.appendChild(status);
      stage.appendChild(wrap);
    },
    code: {
      html: '<div class="more">\n  <button class="more-btn" aria-label="더보기" aria-haspopup="menu" aria-expanded="false">\n    <span class="dots"></span>\n  </button>\n  <div class="more-menu" role="menu" hidden>\n    <button role="menuitem">이름 바꾸기</button>\n    <button role="menuitem">복사</button>\n    <button role="menuitem">삭제</button>\n  </div>\n</div>',
      css: '.more { position: relative; display: inline-block; }\n.more-btn { width: 36px; height: 36px; border: 0; border-radius: 50%; background: none; cursor: pointer; }\n.more-btn:hover, .more-btn:focus-visible { background: #0001; }\n.dots { display: block; width: 4px; height: 4px; margin: auto; border-radius: 50%;\n  background: currentColor; box-shadow: 0 -7px 0 currentColor, 0 7px 0 currentColor; }\n.more-menu { position: absolute; right: 0; top: 100%; min-width: 140px; padding: 4px;\n  background: #fff; border: 1px solid #0002; border-radius: 10px; box-shadow: 0 8px 24px #0002; }\n.more-menu button { display: block; width: 100%; padding: 8px 10px; border: 0;\n  background: none; text-align: left; border-radius: 6px; cursor: pointer; }\n.more-menu button:hover, .more-menu button:focus-visible { background: #0001; }',
      js: 'var btn = document.querySelector(".more-btn");\nvar menu = document.querySelector(".more-menu");\nfunction toggle(open) {\n  menu.hidden = !open;\n  btn.setAttribute("aria-expanded", open);\n  if (open) menu.querySelector("button").focus();\n}\nbtn.addEventListener("click", function () { toggle(menu.hidden); });\ndocument.addEventListener("click", function (e) {\n  if (!btn.parentNode.contains(e.target)) toggle(false);\n});\ndocument.addEventListener("keydown", function (e) {\n  if (e.key === "Escape" && !menu.hidden) { toggle(false); btn.focus(); }\n});'
    }
  };

  /* ---------- 2. meatball ---------- */
  window.JL_DEMOS['meatball'] = {
    mount: function (stage) {
      stage.textContent = '';
      resetMenus(stage);
      var P = 'dm-meatball';
      var wrap = el('div', P + '-wrap');

      var crumb = el('nav', P + '-crumb');
      crumb.setAttribute('aria-label', '현재 위치');
      var ol = el('ol', P + '-crumbs');
      function crumbItem(t, current) {
        var li = el('li', P + '-crumbitem');
        var a = el(current ? 'span' : 'a', P + '-link', t);
        if (current) a.setAttribute('aria-current', 'page'); else a.href = '#';
        if (!current) a.addEventListener('click', function (e) { e.preventDefault(); });
        li.appendChild(a);
        return li;
      }
      var more = el('li', P + '-crumbitem');
      var moreBtn = el('button', P + '-btn is-small');
      setAttrs(moreBtn, { type: 'button', 'aria-label': '중간 경로 펼치기' });
      moreBtn.appendChild(el('span', P + '-dots'));
      more.appendChild(moreBtn);
      ol.appendChild(crumbItem('홈'));
      ol.appendChild(more);
      ol.appendChild(crumbItem('디자인'));
      ol.appendChild(crumbItem('메뉴 패턴', true));
      moreBtn.addEventListener('click', function () {
        var a = crumbItem('도감'), b = crumbItem('UI');
        a.classList.add('is-new'); b.classList.add('is-new');
        ol.insertBefore(a, more); ol.insertBefore(b, more);
        ol.removeChild(more);
        a.querySelector('a').focus();
      });
      crumb.appendChild(ol);
      wrap.appendChild(crumb);

      var card = el('article', P + '-card');
      var head = el('header', P + '-head');
      head.appendChild(el('span', P + '-avatar'));
      var who = el('div', P + '-who');
      who.appendChild(el('strong', P + '-name', '주간실험실'));
      who.appendChild(el('span', P + '-meta', '3시간 전'));
      head.appendChild(who);
      var anchor = el('div', P + '-anchor');
      var btn = el('button', P + '-btn');
      setAttrs(btn, { type: 'button', 'aria-label': '게시물 옵션' });
      btn.appendChild(el('span', P + '-dots'));
      anchor.appendChild(btn);
      head.appendChild(anchor);
      card.appendChild(head);
      card.appendChild(el('div', P + '-pic'));
      var status = statusLine(P + '-status', '카드 오른쪽 … 를 눌러 보세요.');
      popMenu(stage, P, btn, anchor, [
        { label: '저장하기' }, { label: '링크 복사' }, { label: '이 글 숨기기' }, { label: '신고하기', danger: true }
      ], function (it) { status.textContent = it.label + ' 를 골랐습니다.'; });
      wrap.appendChild(card);
      wrap.appendChild(status);
      stage.appendChild(wrap);
    },
    code: {
      html: '<button class="more-btn" aria-label="옵션" aria-haspopup="menu" aria-expanded="false">\n  <span class="dots"></span>\n</button>\n<div class="more-menu" role="menu" hidden>\n  <button role="menuitem">저장하기</button>\n  <button role="menuitem">링크 복사</button>\n  <button role="menuitem">신고하기</button>\n</div>\n\n<!-- 경로가 길 때: 중간을 … 로 접기 -->\n<nav aria-label="현재 위치">\n  <a href="/">홈</a> / <button id="expand" aria-label="중간 경로 펼치기">…</button> / <span aria-current="page">현재 글</span>\n</nav>',
      css: '.more-btn { width: 36px; height: 36px; border: 0; border-radius: 50%; background: none; cursor: pointer; }\n.more-btn:hover, .more-btn:focus-visible { background: #0001; }\n.dots { display: block; width: 4px; height: 4px; margin: auto; border-radius: 50%;\n  background: currentColor; box-shadow: -7px 0 0 currentColor, 7px 0 0 currentColor; }\n.more-menu { min-width: 140px; margin-top: 4px; padding: 4px; background: #fff;\n  border: 1px solid #0002; border-radius: 10px; box-shadow: 0 8px 24px #0002; }\n.more-menu button { display: block; width: 100%; padding: 8px 10px; border: 0; background: none;\n  text-align: left; border-radius: 6px; cursor: pointer; }\n.more-menu button:hover, .more-menu button:focus-visible { background: #0001; }',
      js: 'var btn = document.querySelector(".more-btn");\nvar menu = document.querySelector(".more-menu");\nbtn.addEventListener("click", function () {\n  menu.hidden = !menu.hidden;\n  btn.setAttribute("aria-expanded", String(!menu.hidden));\n});\ndocument.addEventListener("keydown", function (e) {\n  if (e.key === "Escape") { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); btn.focus(); }\n});\n\ndocument.getElementById("expand").addEventListener("click", function () {\n  this.outerHTML = "<a href=\'/ui\'>UI</a> / <a href=\'/ui/nav\'>메뉴</a>";\n});'
    }
  };

  /* ---------- 3. veggie-burger ---------- */
  window.JL_DEMOS['veggie-burger'] = {
    mount: function (stage) {
      stage.textContent = '';
      var P = 'dm-veggie-burger';
      var phone = el('div', P + '-phone');
      var bar = el('header', P + '-bar');
      bar.appendChild(el('strong', P + '-logo', 'juganlab'));
      var btn = el('button', P + '-btn');
      setAttrs(btn, { type: 'button', 'aria-label': '메뉴 열기', 'aria-expanded': 'false', 'aria-controls': P + '-panel' });
      for (var i = 0; i < 3; i++) btn.appendChild(el('span', P + '-line'));
      bar.appendChild(btn);
      phone.appendChild(bar);

      var body = el('div', P + '-body');
      body.appendChild(el('h4', P + '-h', '오늘의 실험'));
      [90, 70, 82, 55].forEach(function (w) {
        var l = el('span', P + '-skel'); l.style.width = w + '%'; body.appendChild(l);
      });
      phone.appendChild(body);

      var panel = el('nav', P + '-panel');
      panel.id = P + '-panel';
      panel.setAttribute('aria-label', '주 메뉴');
      var status = statusLine(P + '-status', '');
      ['홈', '실험 목록', '도감', '소개'].forEach(function (t, idx) {
        var a = el('a', P + '-link', t);
        a.href = '#';
        a.style.setProperty('--i', idx);
        a.addEventListener('click', function (e) {
          e.preventDefault();
          status.textContent = t + ' 로 이동합니다.';
          setOpen(false);
        });
        panel.appendChild(a);
      });
      phone.appendChild(panel);
      stage.appendChild(phone);
      stage.appendChild(status);

      function setOpen(open) {
        phone.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
        btn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
      }
      btn.addEventListener('click', function () { setOpen(!phone.classList.contains('is-open')); });
      phone.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && phone.classList.contains('is-open')) { setOpen(false); btn.focus(); }
      });
    },
    code: {
      html: '<header class="bar">\n  <strong>로고</strong>\n  <button class="burger" aria-label="메뉴 열기" aria-expanded="false" aria-controls="nav">\n    <span></span><span></span><span></span>\n  </button>\n</header>\n<nav id="nav" class="panel" aria-label="주 메뉴">\n  <a href="/">홈</a><a href="/list">목록</a><a href="/about">소개</a>\n</nav>',
      css: '.bar { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; position: relative; }\n.burger { width: 40px; height: 40px; border: 0; background: none; cursor: pointer; position: relative; }\n.burger span { position: absolute; left: 10px; right: 10px; height: 2px; background: currentColor;\n  border-radius: 2px; transition: transform .3s, opacity .2s; }\n.burger span:nth-child(1) { top: 13px; }\n.burger span:nth-child(2) { top: 19px; }\n.burger span:nth-child(3) { top: 25px; }\n.burger[aria-expanded="true"] span:nth-child(1) { transform: translateY(6px) rotate(45deg); }\n.burger[aria-expanded="true"] span:nth-child(2) { opacity: 0; transform: scaleX(0); }\n.burger[aria-expanded="true"] span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }\n.panel { display: grid; clip-path: inset(0 0 100% 0); visibility: hidden;\n  transition: clip-path .35s, visibility 0s .35s; background: #fff; }\n.panel.open { clip-path: inset(0); visibility: visible; transition: clip-path .35s; }\n.panel a { padding: 12px 16px; }',
      js: 'var btn = document.querySelector(".burger");\nvar nav = document.getElementById("nav");\nfunction setOpen(open) {\n  nav.classList.toggle("open", open);\n  btn.setAttribute("aria-expanded", open);\n  btn.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");\n}\nbtn.addEventListener("click", function () {\n  setOpen(btn.getAttribute("aria-expanded") !== "true");\n});\ndocument.addEventListener("keydown", function (e) {\n  if (e.key === "Escape") setOpen(false);\n});'
    }
  };

  /* ---------- 4. donut ---------- */
  window.JL_DEMOS['donut'] = {
    mount: function (stage) {
      stage.textContent = '';
      var P = 'dm-donut';
      var NS = 'http://www.w3.org/2000/svg';
      var data = [
        { n: '식비', v: 40 }, { n: '교통', v: 25 }, { n: '여가', v: 20 }, { n: '기타', v: 15 }
      ];
      var R = 42, C = 2 * Math.PI * R, GAP = 2.5;
      var wrap = el('div', P + '-wrap');
      var ring = el('div', P + '-ring');
      var svg = document.createElementNS(NS, 'svg');
      setAttrs(svg, { viewBox: '0 0 120 120', 'aria-hidden': 'true', class: P + '-svg' });
      var track = document.createElementNS(NS, 'circle');
      setAttrs(track, { cx: 60, cy: 60, r: R, class: P + '-track' });
      svg.appendChild(track);
      var arcs = [];
      var start = 0;
      data.forEach(function (d, i) {
        var len = d.v / 100 * C;
        var c = document.createElementNS(NS, 'circle');
        setAttrs(c, { cx: 60, cy: 60, r: R, transform: 'rotate(-90 60 60)', class: P + '-arc' });
        c.style.strokeDasharray = '0 ' + C;
        c.style.strokeDashoffset = String(-start);
        c.style.strokeOpacity = String(0.8 - i * 0.17);
        c._len = len;
        c.addEventListener('click', function () { select(i, false); });
        svg.appendChild(c);
        arcs.push(c);
        start += len;
      });
      ring.appendChild(svg);
      var center = el('div', P + '-center');
      center.setAttribute('aria-hidden', 'true');
      var num = el('strong', P + '-num', '');
      var lab = el('span', P + '-lab', '');
      center.appendChild(num); center.appendChild(lab);
      ring.appendChild(center);
      wrap.appendChild(ring);

      var legend = el('div', P + '-legend');
      setAttrs(legend, { role: 'radiogroup', 'aria-label': '지출 항목' });
      var items = data.map(function (d, i) {
        var b = el('button', P + '-item');
        setAttrs(b, { type: 'button', role: 'radio', 'aria-checked': 'false', tabindex: '-1' });
        b.appendChild(el('span', P + '-swatch'));
        b.appendChild(el('span', P + '-iname', d.n));
        b.appendChild(el('span', P + '-ival', d.v + '%'));
        b.addEventListener('click', function () { select(i, false); });
        b.addEventListener('keydown', function (e) {
          var k = e.key, n = data.length, to = -1;
          if (k === 'ArrowRight' || k === 'ArrowDown') to = (i + 1) % n;
          else if (k === 'ArrowLeft' || k === 'ArrowUp') to = (i - 1 + n) % n;
          if (to >= 0) { e.preventDefault(); select(to, true); }
        });
        legend.appendChild(b);
        return b;
      });
      wrap.appendChild(legend);
      stage.appendChild(wrap);

      var shown = 0, tick = 0;
      function countTo(target) {
        cancelAnimationFrame(tick);
        var from = shown, t0 = null;
        if (reduced()) { shown = target; num.textContent = target + '%'; return; }
        (function step(ts) {
          if (!stage.isConnected) return;
          if (t0 == null) t0 = ts;
          var p = Math.min(1, (ts - t0) / 450);
          shown = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
          num.textContent = shown + '%';
          if (p < 1) tick = requestAnimationFrame(step);
        })(performance.now());
      }
      function select(i, focus) {
        arcs.forEach(function (c, j) { c.classList.toggle('is-on', j === i); });
        items.forEach(function (b, j) {
          b.setAttribute('aria-checked', String(j === i));
          b.tabIndex = j === i ? 0 : -1;
        });
        lab.textContent = data[i].n;
        countTo(data[i].v);
        if (focus) items[i].focus();
      }
      select(0, false);
      requestAnimationFrame(function () {
        arcs.forEach(function (c) { c.style.strokeDasharray = (c._len - GAP) + ' ' + C; });
      });
    },
    code: {
      html: '<div class="donut">\n  <svg viewBox="0 0 120 120" aria-hidden="true">\n    <circle class="arc" cx="60" cy="60" r="42" transform="rotate(-90 60 60)"></circle>\n    <circle class="arc" cx="60" cy="60" r="42" transform="rotate(-90 60 60)"></circle>\n  </svg>\n  <p class="center"><strong id="val">40%</strong><span id="name">식비</span></p>\n</div>\n<div role="radiogroup" aria-label="항목">\n  <button role="radio" aria-checked="true" data-v="40" data-n="식비">식비</button>\n  <button role="radio" aria-checked="false" data-v="60" data-n="기타">기타</button>\n</div>',
      css: '.donut { position: relative; width: 140px; }\n.arc { fill: none; stroke: #18202e; stroke-width: 16; transition: stroke-width .25s, stroke .25s; }\n.arc.on { stroke: #e8572a; stroke-width: 20; }\n.center { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; margin: 0; }\n.center strong { font-size: 1.5rem; }',
      js: 'var C = 2 * Math.PI * 42;\nvar data = [40, 60]; // 합계 100\nvar arcs = document.querySelectorAll(".arc");\nvar start = 0;\narcs.forEach(function (arc, i) {\n  var len = data[i] / 100 * C;\n  arc.style.strokeDasharray = (len - 2) + " " + C;\n  arc.style.strokeDashoffset = -start;\n  start += len;\n});\ndocument.querySelectorAll("[role=radio]").forEach(function (b, i) {\n  b.addEventListener("click", function () {\n    arcs.forEach(function (a, j) { a.classList.toggle("on", j === i); });\n    document.querySelectorAll("[role=radio]").forEach(function (o) {\n      o.setAttribute("aria-checked", o === b);\n    });\n    document.getElementById("val").textContent = b.dataset.v + "%";\n    document.getElementById("name").textContent = b.dataset.n;\n  });\n});\narcs[0].classList.add("on");'
    }
  };

  /* ---------- 5. top-tabs ---------- */
  window.JL_DEMOS['top-tabs'] = {
    mount: function (stage) {
      stage.textContent = '';
      var P = 'dm-top-tabs';
      var tabsData = [
        ['개요', '탭은 같은 층위의 화면을 한 자리에서 바꿔 보여 줍니다. 페이지 이동이 아니라 내용 전환입니다.'],
        ['사용법', '좌우 화살표로 탭 사이를 옮기고, Home/End 로 처음·끝으로 갑니다. 선택된 탭만 Tab 순서에 들어갑니다.'],
        ['후기', '탭이 많아지면 가로 스크롤이 필요합니다. 4~5개를 넘기면 다른 구조를 고민해 보세요.']
      ];
      var box = el('div', P + '-box');
      var list = el('div', P + '-list');
      setAttrs(list, { role: 'tablist', 'aria-label': '탭 예시' });
      var ink = el('span', P + '-ink');
      ink.setAttribute('aria-hidden', 'true');
      var tabs = [], panels = [];
      tabsData.forEach(function (d, i) {
        var t = el('button', P + '-tab', d[0]);
        setAttrs(t, { type: 'button', role: 'tab', id: P + '-t' + i, 'aria-controls': P + '-p' + i });
        list.appendChild(t);
        var p = el('div', P + '-panel');
        setAttrs(p, { role: 'tabpanel', id: P + '-p' + i, 'aria-labelledby': P + '-t' + i, tabindex: '0' });
        p.appendChild(el('h4', P + '-h', d[0]));
        p.appendChild(el('p', P + '-p', d[1]));
        tabs.push(t); panels.push(p);
        t.addEventListener('click', function () { select(i, false); });
        t.addEventListener('keydown', function (e) {
          var n = tabs.length, to = -1;
          if (e.key === 'ArrowRight') to = (i + 1) % n;
          else if (e.key === 'ArrowLeft') to = (i - 1 + n) % n;
          else if (e.key === 'Home') to = 0;
          else if (e.key === 'End') to = n - 1;
          if (to >= 0) { e.preventDefault(); select(to, true); }
        });
      });
      list.appendChild(ink);
      box.appendChild(list);
      panels.forEach(function (p) { box.appendChild(p); });
      stage.appendChild(box);

      var current = 0;
      function moveInk() {
        var t = tabs[current];
        ink.style.transform = 'translateX(' + t.offsetLeft + 'px) scaleX(' + t.offsetWidth + ')';
      }
      function select(i, focus) {
        current = i;
        tabs.forEach(function (t, j) {
          var on = j === i;
          t.setAttribute('aria-selected', String(on));
          t.tabIndex = on ? 0 : -1;
          panels[j].hidden = !on;
        });
        panels[i].classList.remove('is-in');
        void panels[i].offsetWidth;
        panels[i].classList.add('is-in');
        moveInk();
        if (focus) tabs[i].focus();
      }
      select(0, false);
      if (typeof ResizeObserver === 'function') {
        var ro = new ResizeObserver(function () {
          if (!stage.isConnected) { ro.disconnect(); return; }
          moveInk();
        });
        ro.observe(list);
      }
    },
    code: {
      html: '<div class="tabs" role="tablist" aria-label="탭">\n  <button role="tab" id="t0" aria-controls="p0" aria-selected="true">개요</button>\n  <button role="tab" id="t1" aria-controls="p1" aria-selected="false" tabindex="-1">사용법</button>\n  <button role="tab" id="t2" aria-controls="p2" aria-selected="false" tabindex="-1">후기</button>\n  <span class="ink"></span>\n</div>\n<div role="tabpanel" id="p0" aria-labelledby="t0">개요 내용</div>\n<div role="tabpanel" id="p1" aria-labelledby="t1" hidden>사용법 내용</div>\n<div role="tabpanel" id="p2" aria-labelledby="t2" hidden>후기 내용</div>',
      css: '.tabs { position: relative; display: flex; gap: 4px; border-bottom: 1px solid #0002; }\n.tabs [role=tab] { padding: 10px 14px; border: 0; background: none; color: #667; cursor: pointer; }\n.tabs [aria-selected=true] { color: #111; font-weight: 600; }\n.ink { position: absolute; left: 0; bottom: -1px; width: 1px; height: 3px; background: #e8572a;\n  transform-origin: 0 0; transition: transform .35s cubic-bezier(.16, 1, .3, 1); }',
      js: 'var tabs = Array.prototype.slice.call(document.querySelectorAll("[role=tab]"));\nvar ink = document.querySelector(".ink");\nfunction select(i, focus) {\n  tabs.forEach(function (t, j) {\n    t.setAttribute("aria-selected", j === i);\n    t.tabIndex = j === i ? 0 : -1;\n    document.getElementById(t.getAttribute("aria-controls")).hidden = j !== i;\n  });\n  ink.style.transform = "translateX(" + tabs[i].offsetLeft + "px) scaleX(" + tabs[i].offsetWidth + ")";\n  if (focus) tabs[i].focus();\n}\ntabs.forEach(function (t, i) {\n  t.addEventListener("click", function () { select(i); });\n  t.addEventListener("keydown", function (e) {\n    var n = tabs.length;\n    if (e.key === "ArrowRight") select((i + 1) % n, true);\n    if (e.key === "ArrowLeft") select((i - 1 + n) % n, true);\n  });\n});\nselect(0);'
    }
  };

  /* ---------- 6. pagination ---------- */
  function pageList(cur, total) {
    var s = {};
    [1, total, cur - 1, cur, cur + 1].forEach(function (n) { if (n >= 1 && n <= total) s[n] = true; });
    if (cur <= 2 && total >= 3) s[3] = true;
    if (cur >= total - 1 && total >= 3) s[total - 2] = true;
    var nums = Object.keys(s).map(Number).sort(function (a, b) { return a - b; });
    var out = [];
    nums.forEach(function (n, i) {
      if (i) {
        var gap = n - nums[i - 1];
        if (gap === 2) out.push(n - 1);
        else if (gap > 2) out.push('…');
      }
      out.push(n);
    });
    return out;
  }

  window.JL_DEMOS['pagination'] = {
    mount: function (stage) {
      stage.textContent = '';
      var P = 'dm-pagination';
      var TOTAL_ITEMS = 47, SIZE = 5, pages = Math.ceil(TOTAL_ITEMS / SIZE), cur = 1;
      var wrap = el('div', P + '-wrap');
      var info = statusLine(P + '-info', '');
      var list = el('ol', P + '-list');
      var nav = el('nav', P + '-nav');
      nav.setAttribute('aria-label', '페이지 이동');
      wrap.appendChild(info); wrap.appendChild(list); wrap.appendChild(nav);
      stage.appendChild(wrap);

      function btn(label, aria, onClick, cls) {
        var b = el('button', P + '-btn' + (cls ? ' ' + cls : ''), label);
        setAttrs(b, { type: 'button', 'aria-label': aria });
        b.addEventListener('click', onClick);
        return b;
      }
      function go(n, keepFocus) {
        cur = Math.min(pages, Math.max(1, n));
        render(keepFocus);
      }
      function render(keepFocus) {
        list.textContent = '';
        var from = (cur - 1) * SIZE + 1, to = Math.min(TOTAL_ITEMS, cur * SIZE);
        for (var i = from; i <= to; i++) {
          var li = el('li', P + '-row');
          li.style.setProperty('--i', i - from);
          li.appendChild(el('span', P + '-no', String(i)));
          li.appendChild(el('span', P + '-title', '문서 제목 ' + i));
          list.appendChild(li);
        }
        info.textContent = TOTAL_ITEMS + '개 중 ' + from + '-' + to + ' (' + cur + '/' + pages + ' 페이지)';
        nav.textContent = '';
        var prev = btn('‹', '이전 페이지', function () { go(cur - 1, true); }, 'is-arrow');
        prev.disabled = cur === 1;
        nav.appendChild(prev);
        pageList(cur, pages).forEach(function (n) {
          if (n === '…') {
            var d = el('span', P + '-gap', '…'); d.setAttribute('aria-hidden', 'true'); nav.appendChild(d);
            return;
          }
          var b = btn(String(n), n + ' 페이지', function () { go(n, true); });
          if (n === cur) { b.setAttribute('aria-current', 'page'); b.classList.add('is-cur'); }
          nav.appendChild(b);
        });
        var next = btn('›', '다음 페이지', function () { go(cur + 1, true); }, 'is-arrow');
        next.disabled = cur === pages;
        nav.appendChild(next);
        if (keepFocus) {
          var f = nav.querySelector('[aria-current]');
          if (f) f.focus();
        }
      }
      render(false);
    },
    code: {
      html: '<ol id="list"></ol>\n<nav id="pager" aria-label="페이지 이동"></nav>',
      css: '#pager { display: flex; gap: 2px; justify-content: center; }\n#pager button { min-width: 32px; height: 32px; border: 1px solid #0002; border-radius: 8px;\n  background: #fff; cursor: pointer; }\n#pager button:disabled { opacity: .4; cursor: default; }\n#pager [aria-current=page] { background: #18202e; color: #fff; border-color: #18202e; }\n#pager span { align-self: center; padding: 0 4px; }',
      js: 'var items = Array.from({ length: 47 }, function (_, i) { return "문서 " + (i + 1); });\nvar SIZE = 5, pages = Math.ceil(items.length / SIZE), cur = 1;\nvar list = document.getElementById("list"), pager = document.getElementById("pager");\nfunction numbers() {\n  var set = {};\n  [1, pages, cur - 1, cur, cur + 1].forEach(function (n) { if (n >= 1 && n <= pages) set[n] = 1; });\n  var nums = Object.keys(set).map(Number).sort(function (a, b) { return a - b; }), out = [];\n  nums.forEach(function (n, i) {\n    if (i && n - nums[i - 1] > 1) out.push(n - nums[i - 1] === 2 ? n - 1 : "…");\n    out.push(n);\n  });\n  return out;\n}\nfunction render() {\n  list.innerHTML = items.slice((cur - 1) * SIZE, cur * SIZE).map(function (t) { return "<li>" + t + "</li>"; }).join("");\n  pager.innerHTML = "<button data-p=\'" + (cur - 1) + "\' aria-label=\'이전\'" + (cur === 1 ? " disabled" : "") + ">‹</button>" +\n    numbers().map(function (n) {\n      return n === "…" ? "<span>…</span>"\n        : "<button data-p=\'" + n + "\'" + (n === cur ? " aria-current=\'page\'" : "") + ">" + n + "</button>";\n    }).join("") +\n    "<button data-p=\'" + (cur + 1) + "\' aria-label=\'다음\'" + (cur === pages ? " disabled" : "") + ">›</button>";\n}\npager.addEventListener("click", function (e) {\n  var b = e.target.closest("button");\n  if (!b || b.disabled) return;\n  cur = +b.dataset.p; render();\n  pager.querySelector("[aria-current]").focus();\n});\nrender();'
    }
  };

  /* ---------- 7. paging-vs-infinite ---------- */
  window.JL_DEMOS['paging-vs-infinite'] = {
    mount: function (stage) {
      stage.textContent = '';
      var P = 'dm-paging-vs-infinite';
      var wrap = el('div', P + '-wrap');
      function side(title) {
        var s = el('section', P + '-side');
        s.appendChild(el('h4', P + '-cap', title));
        var frame = el('div', P + '-frame');
        s.appendChild(frame);
        var foot = statusLine(P + '-foot', '');
        s.appendChild(foot);
        wrap.appendChild(s);
        return { frame: frame, foot: foot };
      }
      function row(n) {
        var li = el('li', P + '-row');
        li.appendChild(el('span', P + '-no', String(n)));
        li.appendChild(el('span', P + '-t', '글 제목 ' + n));
        return li;
      }

      /* 왼쪽: 페이징 */
      var A = side('페이징');
      var PER = 5, ALL = 24, pages = Math.ceil(ALL / PER), page = 1;
      var aList = el('ol', P + '-list');
      var aNav = el('div', P + '-pager');
      var prev = el('button', P + '-pbtn', '‹');
      var next = el('button', P + '-pbtn', '›');
      var pos = el('span', P + '-pos', '');
      setAttrs(prev, { type: 'button', 'aria-label': '이전 페이지' });
      setAttrs(next, { type: 'button', 'aria-label': '다음 페이지' });
      aNav.appendChild(prev); aNav.appendChild(pos); aNav.appendChild(next);
      A.frame.appendChild(aList); A.frame.appendChild(aNav);
      function renderA() {
        aList.textContent = '';
        for (var i = (page - 1) * PER + 1; i <= Math.min(ALL, page * PER); i++) aList.appendChild(row(i));
        aList.classList.remove('is-in'); void aList.offsetWidth; aList.classList.add('is-in');
        prev.disabled = page === 1; next.disabled = page === pages;
        pos.textContent = page + ' / ' + pages;
        A.foot.textContent = '화면에 ' + aList.children.length + '개, 위치를 압니다';
      }
      prev.addEventListener('click', function () { page--; renderA(); });
      next.addEventListener('click', function () { page++; renderA(); });
      renderA();

      /* 오른쪽: 무한 스크롤 */
      var B = side('무한 스크롤');
      var scroller = el('div', P + '-scroll');
      scroller.tabIndex = 0;
      setAttrs(scroller, { role: 'region', 'aria-label': '무한 스크롤 목록' });
      var bList = el('ol', P + '-list');
      var spin = el('div', P + '-spin', '불러오는 중…');
      spin.hidden = true;
      var end = el('div', P + '-end', '마지막 글입니다');
      end.hidden = true;
      scroller.appendChild(bList); scroller.appendChild(spin); scroller.appendChild(end);
      B.frame.appendChild(scroller);
      var MAX = 36, STEP = 6, count = 0, loading = false;
      function addRows(n) {
        for (var i = 0; i < n && count < MAX; i++) bList.appendChild(row(++count));
        B.foot.textContent = '불러온 글 ' + count + '개';
        if (count >= MAX) end.hidden = false;
      }
      addRows(8);
      scroller.addEventListener('scroll', function () {
        if (loading || count >= MAX) return;
        if (scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 24) return;
        loading = true; spin.hidden = false;
        scroller.scrollTop = scroller.scrollHeight;
        setTimeout(function () {
          if (!stage.isConnected) return;
          spin.hidden = true; addRows(STEP); loading = false;
        }, reduced() ? 0 : 650);
      });
      stage.appendChild(wrap);
    },
    code: {
      html: '<!-- 페이징: 번호가 있는 목록 + 이전/다음 -->\n<ol id="paged"></ol>\n<button id="prev">이전</button> <span id="pos"></span> <button id="next">다음</button>\n\n<!-- 무한 스크롤: 끝에 닿으면 이어 붙이기 -->\n<div id="feed" tabindex="0" style="height:200px;overflow:auto"><ol id="items"></ol></div>',
      css: '#feed { border: 1px solid #0002; border-radius: 10px; }\n#feed li, #paged li { padding: 10px 12px; border-bottom: 1px solid #0001; }',
      js: 'var ALL = 24, PER = 5, page = 1;\nfunction li(n) { return "<li>글 제목 " + n + "</li>"; }\nfunction renderPage() {\n  var html = "";\n  for (var i = (page - 1) * PER + 1; i <= Math.min(ALL, page * PER); i++) html += li(i);\n  document.getElementById("paged").innerHTML = html;\n  document.getElementById("pos").textContent = page + " / " + Math.ceil(ALL / PER);\n  document.getElementById("prev").disabled = page === 1;\n  document.getElementById("next").disabled = page === Math.ceil(ALL / PER);\n}\ndocument.getElementById("prev").onclick = function () { page--; renderPage(); };\ndocument.getElementById("next").onclick = function () { page++; renderPage(); };\nrenderPage();\n\nvar feed = document.getElementById("feed"), items = document.getElementById("items");\nvar n = 0, loading = false;\nfunction more(k) { for (var i = 0; i < k; i++) items.insertAdjacentHTML("beforeend", li(++n)); }\nmore(10);\nfeed.addEventListener("scroll", function () {\n  if (loading || feed.scrollTop + feed.clientHeight < feed.scrollHeight - 24) return;\n  loading = true;\n  setTimeout(function () { more(6); loading = false; }, 600); // 실제로는 서버 요청\n});'
    }
  };

  /* ---------- 8. fab ---------- */
  window.JL_DEMOS['fab'] = {
    mount: function (stage) {
      stage.textContent = '';
      var P = 'dm-fab';
      var screen = el('div', P + '-screen');
      var body = el('div', P + '-body');
      body.appendChild(el('h4', P + '-h', '타임라인'));
      [88, 64, 78, 50, 72].forEach(function (w) {
        var l = el('span', P + '-skel'); l.style.width = w + '%'; body.appendChild(l);
      });
      screen.appendChild(body);
      var scrim = el('div', P + '-scrim');
      scrim.setAttribute('aria-hidden', 'true');
      screen.appendChild(scrim);
      var cluster = el('div', P + '-cluster');
      var actions = el('div', P + '-actions');
      actions.id = P + '-actions';
      var status = statusLine(P + '-status', '+ 버튼을 눌러 보세요.');
      var main = el('button', P + '-main');
      setAttrs(main, { type: 'button', 'aria-label': '작성 메뉴 열기', 'aria-expanded': 'false', 'aria-controls': actions.id });
      main.appendChild(el('span', P + '-plus'));
      var btns = ['글쓰기', '사진', '일정'].map(function (t, i) {
        var b = el('button', P + '-mini', t);
        setAttrs(b, { type: 'button', tabindex: '-1' });
        b.style.setProperty('--i', 2 - i);
        b.addEventListener('click', function () {
          status.textContent = t + ' 를 골랐습니다.';
          setOpen(false); main.focus();
        });
        actions.appendChild(b);
        return b;
      });
      cluster.appendChild(actions); cluster.appendChild(main);
      screen.appendChild(cluster);
      stage.appendChild(screen); stage.appendChild(status);

      function setOpen(open) {
        screen.classList.toggle('is-open', open);
        main.setAttribute('aria-expanded', String(open));
        main.setAttribute('aria-label', open ? '작성 메뉴 닫기' : '작성 메뉴 열기');
        btns.forEach(function (b) { b.tabIndex = open ? 0 : -1; });
      }
      main.addEventListener('click', function () { setOpen(!screen.classList.contains('is-open')); });
      scrim.addEventListener('click', function () { setOpen(false); });
      screen.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && screen.classList.contains('is-open')) { setOpen(false); main.focus(); }
      });
    },
    code: {
      html: '<div class="fab">\n  <div class="actions" id="actions">\n    <button tabindex="-1">글쓰기</button>\n    <button tabindex="-1">사진</button>\n    <button tabindex="-1">일정</button>\n  </div>\n  <button class="main" aria-label="작성 메뉴 열기" aria-expanded="false" aria-controls="actions">+</button>\n</div>',
      css: '.fab { position: fixed; right: 20px; bottom: 20px; display: grid; justify-items: end; gap: 10px; }\n.main { width: 56px; height: 56px; border: 0; border-radius: 50%; background: #e8572a; color: #fff;\n  font-size: 28px; cursor: pointer; box-shadow: 0 6px 16px #0004; transition: transform .3s; }\n.main:active { transform: scale(.92); }\n.main[aria-expanded=true] { transform: rotate(45deg); }\n.actions { display: grid; gap: 8px; justify-items: end; }\n.actions button { padding: 10px 16px; border: 0; border-radius: 999px; background: #fff;\n  box-shadow: 0 4px 12px #0003; cursor: pointer; opacity: 0; transform: translateY(12px) scale(.9);\n  visibility: hidden; transition: opacity .2s, transform .25s, visibility 0s .25s; }\n.main[aria-expanded=true] ~ .actions button, .fab.open .actions button {\n  opacity: 1; transform: none; visibility: visible; transition: opacity .2s, transform .25s; }',
      js: 'var fab = document.querySelector(".fab");\nvar main = fab.querySelector(".main");\nvar minis = fab.querySelectorAll(".actions button");\nfunction setOpen(open) {\n  fab.classList.toggle("open", open);\n  main.setAttribute("aria-expanded", open);\n  minis.forEach(function (b) { b.tabIndex = open ? 0 : -1; });\n}\nmain.addEventListener("click", function () { setOpen(!fab.classList.contains("open")); });\ndocument.addEventListener("keydown", function (e) {\n  if (e.key === "Escape") { setOpen(false); main.focus(); }\n});'
    }
  };

  /* ---------- 9. floating-vs-bottom-fixed ---------- */
  window.JL_DEMOS['floating-vs-bottom-fixed'] = {
    mount: function (stage) {
      stage.textContent = '';
      var P = 'dm-floating-vs-bottom-fixed';
      var wrap = el('div', P + '-wrap');
      function phone(title) {
        var s = el('section', P + '-side');
        s.appendChild(el('h4', P + '-cap', title));
        var f = el('div', P + '-frame');
        var scroll = el('div', P + '-scroll');
        scroll.tabIndex = 0;
        setAttrs(scroll, { role: 'region', 'aria-label': title + ' 화면 내용' });
        for (var i = 1; i <= 9; i++) {
          var r = el('div', P + '-item');
          r.appendChild(el('strong', P + '-it', '항목 ' + i));
          var l = el('span', P + '-skel'); l.style.width = (50 + (i * 17) % 45) + '%';
          r.appendChild(l);
          scroll.appendChild(r);
        }
        f.appendChild(scroll);
        var toast = el('div', P + '-toast', '');
        setAttrs(toast, { role: 'status', 'aria-live': 'polite' });
        f.appendChild(toast);
        s.appendChild(f);
        wrap.appendChild(s);
        return { frame: f, scroll: scroll, toast: toast };
      }
      var timer = 0;
      function flash(p, msg) {
        p.toast.textContent = msg;
        p.toast.classList.add('is-on');
        clearTimeout(timer);
        timer = setTimeout(function () { if (stage.isConnected) p.toast.classList.remove('is-on'); }, 1100);
      }

      var A = phone('플로팅');
      var fab = el('button', P + '-fab');
      fab.type = 'button';
      fab.appendChild(el('span', P + '-fabi', '+'));
      fab.appendChild(el('span', P + '-fabl', '글쓰기'));
      A.frame.appendChild(fab);
      A.scroll.addEventListener('scroll', function () {
        fab.classList.toggle('is-compact', A.scroll.scrollTop > 16);
      });
      fab.addEventListener('click', function () { flash(A, '글쓰기를 눌렀습니다'); });

      var B = phone('하단 고정');
      B.scroll.classList.add('has-bar');
      var bar = el('div', P + '-bar');
      bar.appendChild(el('span', P + '-price', '12,900원'));
      var cta = el('button', P + '-cta', '구매하기');
      cta.type = 'button';
      bar.appendChild(cta);
      B.frame.appendChild(bar);
      cta.addEventListener('click', function () { flash(B, '구매하기를 눌렀습니다'); });

      stage.appendChild(wrap);
    },
    code: {
      html: '<!-- 플로팅: 내용 위에 떠 있음 -->\n<button class="fab">+ 글쓰기</button>\n\n<!-- 하단 고정: 화면 아래 한 줄을 차지함 -->\n<main class="page"> … 내용 … </main>\n<div class="bar"><span>12,900원</span><button>구매하기</button></div>',
      css: '.fab { position: fixed; right: 16px; bottom: 16px; padding: 14px 20px; border: 0; border-radius: 999px;\n  background: #e8572a; color: #fff; box-shadow: 0 6px 16px #0004; cursor: pointer; transition: transform .2s; }\n.fab:active { transform: scale(.94); }\n.page { padding-bottom: 76px; } /* 고정 바에 가리지 않도록 여백 */\n.bar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center;\n  justify-content: space-between; padding: 12px 16px; background: #fff; border-top: 1px solid #0002; }\n.bar button { padding: 12px 28px; border: 0; border-radius: 10px; background: #18202e; color: #fff; cursor: pointer; }\n.bar button:active { transform: scale(.96); }',
      js: '// 스크롤하면 플로팅 버튼을 아이콘만 남기고 줄이는 예\nvar fab = document.querySelector(".fab");\nwindow.addEventListener("scroll", function () {\n  fab.textContent = window.scrollY > 16 ? "+" : "+ 글쓰기";\n});'
    }
  };
})();

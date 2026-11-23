(function () {
  'use strict';
  var D = (window.JL_DEMOS = window.JL_DEMOS || {});
  var SVGNS = 'http://www.w3.org/2000/svg';

  function h(tag, cls, text, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function s(tag, attrs, text) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function won(n) { return n.toLocaleString('ko-KR') + '원'; }

  function slider(parent, id, label, min, max, val, step, fmt, on) {
    var w = h('label', 'dm-' + id + '-ctl');
    var i = h('input', null, null, { type: 'range', min: min, max: max, step: step, value: val });
    var o = h('output', 'dm-' + id + '-out', fmt(val));
    i.addEventListener('input', function () {
      o.textContent = fmt(+i.value);
      on(+i.value);
    });
    w.append(h('span', null, label), i, o);
    parent.append(w);
    return i;
  }

  /* ---------- anchoring ---------- */
  D['anchoring'] = {
    mount: function (stage) {
      stage.textContent = '';
      var anchor = 129000, price = 49000, picked = false;
      var root = h('div', 'dm-anchoring-root');
      var cards = h('div', 'dm-anchoring-cards');

      function card(title, withAnchor) {
        var c = h('div', 'dm-anchoring-card' + (withAnchor ? ' is-anchor' : ''));
        var orig = h('s', 'dm-anchoring-orig');
        var badge = h('span', 'dm-anchoring-badge');
        var now = h('div', 'dm-anchoring-price');
        c.append(h('div', 'dm-anchoring-tag', title));
        if (withAnchor) {
          var top = h('div', 'dm-anchoring-top');
          top.append(orig, badge);
          c.append(top);
        } else {
          c.append(h('div', 'dm-anchoring-top dm-anchoring-top-empty', '정가 표시 없음'));
        }
        c.append(now, h('div', 'dm-anchoring-plan', '월 구독 · 1개월'));
        cards.append(c);
        return { orig: orig, badge: badge, now: now };
      }
      var A = card('앵커 있음', true);
      var B = card('앵커 없음', false);

      var ctl = h('div', 'dm-anchoring-bar');
      var aSl = slider(ctl, 'anchoring', '앵커(정가)', 49000, 199000, anchor, 10000, won, function (v) { anchor = v; render(); });
      slider(ctl, 'anchoring', '판매가', 19000, 99000, price, 5000, won, function (v) {
        price = v;
        if (anchor < price) { anchor = price; aSl.value = String(anchor); aSl.nextSibling.textContent = won(anchor); }
        aSl.min = String(price);
        render();
      });

      var ask = h('div', 'dm-anchoring-ask');
      var q = h('span', 'dm-anchoring-q', '어느 쪽이 더 싸 보이나요?');
      var bL = h('button', 'dm-btn', '왼쪽', { type: 'button' });
      var bR = h('button', 'dm-btn', '오른쪽', { type: 'button' });
      var reset = h('button', 'dm-btn', '다시 고르기', { type: 'button' });
      reset.hidden = true;
      ask.append(q, bL, bR, reset);
      var msg = h('p', 'dm-anchoring-msg', '', { role: 'status', 'aria-live': 'polite' });

      function render() {
        var rate = Math.round((1 - price / anchor) * 100);
        A.orig.textContent = won(anchor);
        A.badge.textContent = rate > 0 ? rate + '% 할인' : '할인 없음';
        A.badge.classList.toggle('is-none', rate <= 0);
        A.badge.classList.remove('pop');
        void A.badge.offsetWidth;
        A.badge.classList.add('pop');
        A.now.textContent = won(price);
        B.now.textContent = won(price);
        if (picked) say();
      }
      function say() {
        var rate = Math.round((1 - price / anchor) * 100);
        msg.textContent = '두 카드의 가격은 똑같이 ' + won(price) + '입니다. 높은 정가가 먼저 보이면 그 가격이 기준점이 되어 더 싸게 느껴지는 경향이 있습니다(' +
          (rate > 0 ? '여기서는 ' + rate + '% 할인으로 표시됨' : '지금은 앵커가 판매가와 같아 차이가 없음') + ', 체감은 사람마다 다릅니다). 실제로 판매한 적 없는 정가를 쓰면 신뢰를 잃습니다.';
      }
      function pick() {
        picked = true;
        say();
        reset.hidden = false;
      }
      bL.addEventListener('click', pick);
      bR.addEventListener('click', pick);
      reset.addEventListener('click', function () { picked = false; msg.textContent = ''; reset.hidden = true; });

      root.append(cards, ctl, ask, msg);
      stage.append(root);
      render();
    },
    code: {
      html: '<div class="price">\n  <s id="orig">129,000원</s> <b id="rate">62% 할인</b>\n  <div id="now">49,000원</div>\n</div>\n<input id="anchor" type="range" min="49000" max="199000" step="10000" value="129000">',
      css: '.price s { color: #8a92a0; }\n.price b { color: #fff; background: #e8572a; padding: 2px 8px; border-radius: 99px; font-size: 13px; }\n#now { font-size: 28px; font-weight: 700; }',
      js: 'const PRICE = 49000;\nconst anchor = document.getElementById(\'anchor\');\nfunction render() {\n  const a = +anchor.value;\n  document.getElementById(\'orig\').textContent = a.toLocaleString() + \'원\';\n  document.getElementById(\'rate\').textContent = Math.round((1 - PRICE / a) * 100) + \'% 할인\';\n  document.getElementById(\'now\').textContent = PRICE.toLocaleString() + \'원\';\n}\nanchor.addEventListener(\'input\', render);\nrender();'
    }
  };

  /* ---------- peak-end ---------- */
  var A_BASE = [6, 7, 8, 9, 8, 7, 4];
  var B_DATA = [5, 5, 6, 6, 5, 6, 7, 8];
  function avg(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
  function peakEnd(a) { return (Math.max.apply(null, a) + a[a.length - 1]) / 2; }

  D['peak-end'] = {
    mount: function (stage) {
      stage.textContent = '';
      var endA = 2, picked = null, revealed = false;
      var root = h('div', 'dm-peak-end-root');
      root.append(h('p', 'dm-peak-end-lead', '두 경험의 시간별 만족도입니다(설명용 가상 값). 어느 쪽이 더 좋게 기억될 것 같은지 골라 보세요.'));
      var charts = h('div', 'dm-peak-end-charts');
      var holders = { A: h('div', 'dm-peak-end-chart'), B: h('div', 'dm-peak-end-chart') };
      charts.append(holders.A, holders.B);

      var ask = h('div', 'dm-peak-end-ask');
      var bA = h('button', 'dm-btn', 'A 가 더 좋게 남는다', { type: 'button', 'aria-pressed': 'false' });
      var bB = h('button', 'dm-btn', 'B 가 더 좋게 남는다', { type: 'button', 'aria-pressed': 'false' });
      var reset = h('button', 'dm-btn', '다시 고르기', { type: 'button' });
      reset.hidden = true;
      ask.append(bA, bB, reset);

      var endCtl = h('div', 'dm-peak-end-bar');
      slider(endCtl, 'peak-end', 'A 의 마지막 순간', 0, 10, endA, 1, function (v) { return v + '점'; }, function (v) { endA = v; render(); });
      var result = h('div', 'dm-peak-end-result', null, { role: 'status', 'aria-live': 'polite' });

      function aData() { return A_BASE.concat([endA]); }

      function chart(data, name) {
        var W = 300, H = 150, pl = 26, pr = 12, pt = 28, pb = 22;
        var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'dm-peak-end-svg', role: 'img',
          'aria-label': '경험 ' + name + ' 만족도 곡선. 시작 ' + data[0] + '점, 최고 ' + Math.max.apply(null, data) + '점, 마지막 ' + data[data.length - 1] + '점' });
        var X = function (i) { return pl + i * (W - pl - pr) / (data.length - 1); };
        var Y = function (v) { return H - pb - v / 10 * (H - pt - pb); };
        [0, 5, 10].forEach(function (g) {
          svg.append(s('line', { x1: pl, x2: W - pr, y1: Y(g), y2: Y(g), class: 'dm-peak-end-grid' }));
          svg.append(s('text', { x: pl - 6, y: Y(g) + 3, class: 'dm-peak-end-axis', 'text-anchor': 'end' }, String(g)));
        });
        svg.append(s('text', { x: pl, y: H - 6, class: 'dm-peak-end-axis' }, '시작'));
        svg.append(s('text', { x: W - pr, y: H - 6, class: 'dm-peak-end-axis', 'text-anchor': 'end' }, '끝'));
        svg.append(s('text', { x: W / 2, y: 10, class: 'dm-peak-end-name', 'text-anchor': 'middle' }, '경험 ' + name));

        if (revealed) {
          var m = avg(data);
          svg.append(s('line', { x1: pl, x2: W - pr, y1: Y(m), y2: Y(m), class: 'dm-peak-end-avg' }));
          svg.append(s('text', { x: W - pr, y: Y(m) - 3, class: 'dm-peak-end-axis', 'text-anchor': 'end' }, '평균 ' + m.toFixed(1)));
        }
        svg.append(s('polyline', { points: data.map(function (v, i) { return X(i) + ',' + Y(v); }).join(' '), class: 'dm-peak-end-line' }));
        data.forEach(function (v, i) { svg.append(s('circle', { cx: X(i), cy: Y(v), r: 2.5, class: 'dm-peak-end-dot' })); });
        if (revealed) {
          var pi = data.indexOf(Math.max.apply(null, data));
          var li = data.length - 1;
          if (pi === li) {
            svg.append(s('circle', { cx: X(li), cy: Y(data[li]), r: 6, class: 'dm-peak-end-peak' }));
            svg.append(s('text', { x: X(li) - 8, y: Y(data[li]) - 9, class: 'dm-peak-end-tag', 'text-anchor': 'end' }, '최고 = 마지막'));
          } else {
            svg.append(s('circle', { cx: X(pi), cy: Y(data[pi]), r: 6, class: 'dm-peak-end-peak' }));
            svg.append(s('text', { x: X(pi), y: Y(data[pi]) - 10, class: 'dm-peak-end-tag', 'text-anchor': 'middle' }, '최고'));
            svg.append(s('circle', { cx: X(li), cy: Y(data[li]), r: 6, class: 'dm-peak-end-last' }));
            svg.append(s('text', { x: X(li) - 8, y: Y(data[li]) + (data[li] > 5 ? -9 : 16), class: 'dm-peak-end-tag is-last', 'text-anchor': 'end' }, '마지막'));
          }
        }
        return svg;
      }

      function bars(name, data) {
        var row = h('div', 'dm-peak-end-row');
        var a = avg(data), pe = peakEnd(data);
        row.append(h('span', 'dm-peak-end-rn', name));
        var col = h('div', 'dm-peak-end-cols');
        [['평균', a, 'avg'], ['최고·마지막', pe, 'pe']].forEach(function (x) {
          var line = h('div', 'dm-peak-end-bl');
          var track = h('span', 'dm-peak-end-track');
          var fill = h('span', 'dm-peak-end-fill is-' + x[2]);
          fill.style.transform = 'scaleX(' + x[1] / 10 + ')';
          track.append(fill);
          line.append(h('span', 'dm-peak-end-bn', x[0]), track, h('span', 'dm-peak-end-bv', x[1].toFixed(1)));
          col.append(line);
        });
        row.append(col);
        return row;
      }

      function render() {
        var a = aData();
        holders.A.textContent = '';
        holders.B.textContent = '';
        holders.A.append(chart(a, 'A'));
        holders.B.append(chart(B_DATA, 'B'));
        result.textContent = '';
        if (!revealed) return;
        result.append(bars('A', a), bars('B', B_DATA));
        var pa = peakEnd(a), pb = peakEnd(B_DATA), ma = avg(a), mb = avg(B_DATA);
        var memo = pa === pb ? '둘이 비슷하게' : (pa > pb ? 'A' : 'B') + ' 가 더 좋게';
        var mean = ma === mb ? '둘이 같습니다' : (ma > mb ? 'A' : 'B') + ' 가 높습니다';
        result.append(h('p', 'dm-peak-end-note',
          '평균은 ' + mean + '. 하지만 가장 좋았던 순간과 마지막 순간으로 보면 ' + memo + ' 남을 수 있습니다. ' +
          '사람은 평균보다 이런 지점으로 경험을 기억하는 경향이 있다고 알려져 있습니다(경향일 뿐, 모두에게 같지는 않습니다). ' +
          (picked ? '고른 답: ' + picked + '.' : '') + ' 슬라이더로 A 의 마지막 점수를 바꿔 보세요.'));
      }
      function choose(who) {
        picked = who;
        revealed = true;
        bA.setAttribute('aria-pressed', String(who === 'A'));
        bB.setAttribute('aria-pressed', String(who === 'B'));
        bA.classList.toggle('is-on', who === 'A');
        bB.classList.toggle('is-on', who === 'B');
        reset.hidden = false;
        render();
      }
      bA.addEventListener('click', function () { choose('A'); });
      bB.addEventListener('click', function () { choose('B'); });
      reset.addEventListener('click', function () {
        picked = null; revealed = false; reset.hidden = true;
        [bA, bB].forEach(function (b) { b.classList.remove('is-on'); b.setAttribute('aria-pressed', 'false'); });
        render();
      });

      root.append(charts, ask, endCtl, result);
      stage.append(root);
      render();
    },
    code: {
      js: '// 경험을 시간순 점수 배열로 두고 "평균" 과 "최고·마지막" 을 비교합니다.\nconst average = (a) => a.reduce((x, y) => x + y, 0) / a.length;\nconst peakEnd = (a) => (Math.max(...a) + a[a.length - 1]) / 2;\n\nconst A = [6, 7, 8, 9, 8, 7, 4, 2]; // 평균은 높지만 끝이 나쁨\nconst B = [5, 5, 6, 6, 5, 6, 7, 8]; // 평균은 낮지만 끝이 좋음\n\nconsole.log(average(A), average(B)); // 6.375  6\nconsole.log(peakEnd(A), peakEnd(B));  // 5.5    8'
    }
  };
})();

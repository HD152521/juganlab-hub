// 주간실험실 허브 인터랙션. 라이브러리 없이 동작하고, 스크립트가 없어도 페이지는 그대로 읽힌다.
(() => {
  'use strict';

  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── 테마: 사용자가 콘솔에서 고른 값만 기억한다(없으면 OS 설정을 따른다) ──
  const THEME_KEY = 'jl-theme';
  const readTheme = () => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  };
  const applyTheme = (theme) => {
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
    else delete root.dataset.theme;
  };
  applyTheme(readTheme());

  const currentTheme = () =>
    root.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  const toggleTheme = () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* 저장이 막힌 브라우저에서는 이번 방문에만 적용된다 */
    }
    return next;
  };

  // ── 모눈 조명 + 좌표 표시: 마우스가 있는 기기에서만 켠다 ──
  const setupGridLight = () => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const cx = document.getElementById('cx');
    const cy = document.getElementById('cy');
    const GRID = 28; // styles.css 의 background-size 와 같은 값
    let frame = 0;
    let last = null;

    const paint = () => {
      frame = 0;
      if (!last) return;
      // 조명은 모눈 칸에 맞춰 스냅해서 "칸이 켜지는" 느낌을 준다.
      const snapX = Math.floor(last.clientX / GRID) * GRID + GRID / 2;
      const snapY = Math.floor((last.clientY + window.scrollY) / GRID) * GRID + GRID / 2 - window.scrollY;
      root.style.setProperty('--mx', `${snapX}px`);
      root.style.setProperty('--my', `${snapY}px`);
      cx.textContent = String(Math.round(last.clientX)).padStart(4, '0');
      cy.textContent = String(Math.round(last.clientY + window.scrollY)).padStart(4, '0');
    };

    window.addEventListener(
      'pointermove',
      (event) => {
        last = event;
        root.classList.add('pointer-active');
        if (!frame) frame = requestAnimationFrame(paint);
      },
      { passive: true },
    );
    document.addEventListener('pointerleave', () => root.classList.remove('pointer-active'));
  };

  // ── 숫자 올라가기: 카드가 화면에 들어올 때 한 번 ──
  const setupCounters = () => {
    const nodes = document.querySelectorAll('[data-count]');
    if (reducedMotion || !('IntersectionObserver' in window)) return;
    const format = (n) => n.toLocaleString('ko-KR');
    const DURATION = 1100;

    const run = (node) => {
      const target = Number(node.dataset.count);
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / DURATION);
        const eased = 1 - Math.pow(1 - t, 3);
        node.textContent = format(Math.round(target * eased));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          run(entry.target);
        }
      },
      { threshold: 0.6 },
    );
    // 미리 0으로 바꾸지 않는다. 화면에 들어오기 전까지는 HTML의 실제 숫자가 그대로 보여야
    // 검색 로봇이나 스크롤 없이 찍은 미리보기에서도 0이 아닌 값이 나온다.
    nodes.forEach((node) => observer.observe(node));
  };

  // ── 응답 속도: 운영 중 표시등에 실제로 잰 왕복 시간을 붙인다 ──
  // no-cors 요청이라 내용은 못 읽지만 응답이 돌아온 시간은 잴 수 있다. 첫 요청은 연결 준비 시간이
  // 섞이므로 두 번째 요청을 표시한다.
  const measure = async (url) => {
    const once = async () => {
      const start = performance.now();
      await fetch(url, { mode: 'no-cors', cache: 'no-store' });
      return Math.round(performance.now() - start);
    };
    await once();
    return once();
  };

  const setupPing = () => {
    document.querySelectorAll('[data-ping]').forEach(async (badge) => {
      const label = badge.textContent.trim();
      try {
        const ms = await measure(badge.dataset.ping);
        badge.textContent = `${label} · ${ms}ms`;
        badge.title = '지금 이 브라우저에서 잰 응답 시간';
      } catch {
        badge.textContent = `${label} · 측정 실패`;
      }
    });
  };

  // ── 실험 일지: 서비스별 필터 + 처음엔 최근 몇 개만 ──
  // 스크립트가 없으면 전부 보인다. 숨김은 여기서만 건다.
  const LOG_PREVIEW = 6;

  const setupLog = () => {
    const entries = [...document.querySelectorAll('#timeline .entry')];
    const more = document.getElementById('log-more');
    const chips = [...document.querySelectorAll('.filter-chip')];
    let filter = 'all';
    let expanded = false;

    const render = () => {
      const matching = entries.filter((e) => filter === 'all' || e.dataset.service === filter);
      entries.forEach((e) => {
        e.hidden = !matching.includes(e) || (!expanded && matching.indexOf(e) >= LOG_PREVIEW);
      });
      const hiddenCount = expanded ? 0 : Math.max(0, matching.length - LOG_PREVIEW);
      more.hidden = hiddenCount === 0;
      more.textContent = `이전 기록 ${hiddenCount}개 더 보기`;
    };

    chips.forEach((chip) =>
      chip.addEventListener('click', () => {
        filter = chip.dataset.filter;
        expanded = false;
        chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        render();
      }),
    );
    more?.addEventListener('click', () => {
      expanded = true;
      render();
    });
    if (more) render();
  };

  // ── 명령 팔레트 ──
  const readServices = () => {
    try {
      const data = JSON.parse(document.getElementById('lab-data')?.textContent || '[]');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };
  const services = readServices();

  const setupPalette = () => {
    const dialog = document.getElementById('palette');
    const out = document.getElementById('palette-out');
    const form = document.getElementById('palette-form');
    const input = document.getElementById('palette-input');
    const hints = document.getElementById('palette-hints');
    const opener = document.getElementById('open-palette');
    if (!dialog || typeof dialog.showModal !== 'function') {
      opener?.remove();
      return;
    }

    const history = [];
    let historyIndex = -1;

    const print = (text, kind = 'out') => {
      const line = document.createElement('div');
      line.className = `line ${kind}`;
      line.textContent = text;
      out.append(line);
      out.scrollTop = out.scrollHeight;
    };

    const go = (target) => {
      dialog.close();
      if (target.startsWith('#')) {
        document.querySelector(target)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
      } else {
        window.location.href = target;
      }
    };

    const COMMANDS = {
      help: {
        desc: '쓸 수 있는 명령 보기',
        run: () => {
          for (const [name, cmd] of Object.entries(COMMANDS)) {
            if (!cmd.hidden) print(`  ${name.padEnd(14)} ${cmd.desc}`);
          }
          print('  (숨은 명령도 몇 개 있습니다)', 'dim');
        },
      },
      ls: {
        desc: '서비스 목록',
        run: () => {
          const width = Math.max(8, ...services.map((s) => s.id.length));
          for (const s of services) {
            const host = s.url ? new URL(s.url).host : '-';
            print(`  ${s.code}  ${s.id.padEnd(width)}  ${s.status.padEnd(5)}  ${host}`, s.url ? 'out' : 'dim');
          }
          print(`  EXP-${String(services.length + 1).padStart(2, '0')}  ${'???'.padEnd(width)}  준비 중  *.juganlab.com`, 'dim');
        },
      },
      ...Object.fromEntries(
        services
          .filter((s) => s.url)
          .map((s) => [`open ${s.id}`, { desc: `${s.name} 로 이동`, run: () => go(s.url) }]),
      ),
      log: { desc: '실험 일지로 이동', run: () => go('#log') },
      about: { desc: '소개로 이동', run: () => go('#about') },
      contact: { desc: '메일 보내기', run: () => go('mailto:wkdrndydtlr@gmail.com') },
      theme: {
        desc: '밝은/어두운 화면 바꾸기',
        run: () => print(`  테마를 ${toggleTheme() === 'dark' ? '어둡게' : '밝게'} 바꿨습니다.`),
      },
      clear: { desc: '화면 지우기', run: () => out.replaceChildren() },
      whoami: {
        hidden: true,
        desc: '',
        run: () => print('  방문자 · 실험실에 오신 걸 환영합니다 👋'),
      },
      'sudo hire': {
        hidden: true,
        desc: '',
        run: () => {
          print('  [sudo] 권한 확인 중... 승인됨.', 'dim');
          print('  협업 제안은 언제나 환영입니다. contact 를 입력하세요 ✉️');
        },
      },
      coffee: {
        hidden: true,
        desc: '',
        run: () => print('  ☕ 커피 충전 완료. 다음 실험 속도 +10%'),
      },
    };
    const NAMES = Object.keys(COMMANDS);
    const visibleNames = NAMES.filter((name) => !COMMANDS[name].hidden);

    const renderHints = (prefix = '') => {
      const matches = visibleNames.filter((name) => name.startsWith(prefix.trim().toLowerCase()));
      hints.replaceChildren(
        ...matches.map((name) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'hint-chip mono';
          button.textContent = name;
          button.addEventListener('click', () => execute(name));
          return button;
        }),
      );
    };

    const execute = (raw) => {
      const command = raw.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!command) return;
      print(`$ ${command}`, 'cmd');
      history.unshift(command);
      historyIndex = -1;
      const entry = COMMANDS[command];
      if (entry) entry.run();
      else if (command.startsWith('sudo')) print('  권한이 없습니다. 이 일은 기록됩니다. (농담입니다)', 'err');
      else print(`  명령을 찾을 수 없습니다: ${command} — help 를 입력해 보세요`, 'err');
      input.value = '';
      renderHints();
    };

    const open = () => {
      if (dialog.open) return;
      dialog.showModal();
      if (!out.childElementCount) print('jugan-lab 콘솔에 접속했습니다. help 로 시작하세요.', 'dim');
      renderHints();
      input.focus();
    };

    opener?.addEventListener('click', open);
    if (/Mac|iPhone|iPad/.test(navigator.platform)) {
      const key = opener?.querySelector('kbd');
      if (key) key.textContent = '⌘ K';
    }

    document.addEventListener('keydown', (event) => {
      // 닫힌 팔레트의 입력칸에 포커스가 남아 있는 경우는 입력 중으로 보지 않는다.
      const typing =
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, [contenteditable]') &&
        !event.target.closest('dialog:not([open])');
      const isShortcut = (event.key === 'k' || event.key === 'K') && (event.ctrlKey || event.metaKey);
      if (isShortcut || (event.key === '/' && !typing && !dialog.open)) {
        event.preventDefault();
        open();
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      execute(input.value);
    });

    input.addEventListener('input', () => renderHints(input.value));

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        const prefix = input.value.trim().toLowerCase();
        const match = prefix && visibleNames.find((name) => name.startsWith(prefix));
        if (match) {
          event.preventDefault();
          input.value = match;
          renderHints(match);
        }
      } else if (event.key === 'ArrowUp' && history.length) {
        event.preventDefault();
        historyIndex = Math.min(historyIndex + 1, history.length - 1);
        input.value = history[historyIndex];
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        historyIndex = Math.max(historyIndex - 1, -1);
        input.value = historyIndex === -1 ? '' : history[historyIndex];
      }
    });

    // 바깥(배경)을 누르면 닫는다.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  };

  setupGridLight();
  setupCounters();
  setupPing();
  setupLog();
  setupPalette();
})();

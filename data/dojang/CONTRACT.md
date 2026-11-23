# UI 도감 데모 계약 (에이전트 공통)

프로젝트: C:\Users\yongsik\Desktop\juganlab-hub (정적 사이트, 빌드 없는 순수 JS/CSS, 라이브러리·CDN 금지)
다른 파일(build.mjs, styles.css, app.js 등)은 건드리지 말 것. 커밋 금지. 자기 묶음 파일만 만든다.

## 묶음마다 만드는 파일 3개 (<g> = ui-input | ui-overlay | ui-nav | ui-layout | ui-motion | ui-psych)
1. data/dojang/<g>.json  — { "group": "묶음 이름", "items": [ { "id", "title", "summary", "when": [2~3개], "avoid": [2~3개], "tip": "선택, 한 줄" } ] }
   - 한국어, 존댓말(합니다체), 짧고 구체적으로. summary 는 1~2문장(무엇이고 왜 헷갈리는지). 지어낸 통계·출처 금지.
   - "A vs B" 항목은 title 에 그대로 쓰고 when/avoid 는 "A 를 쓸 때 / B 를 쓸 때" 가 드러나게.
2. src/dojang/<g>.js — IIFE. 각 항목을 다음 형태로 등록:
   window.JL_DEMOS = window.JL_DEMOS || {};
   window.JL_DEMOS['<id>'] = { mount(stage) { ... }, code: { html: `...`, css: `...`, js: `...` } };
   - mount(stage): stage 는 빈 <div class="dm-stage"> (position:relative; min-height:260px; overflow:hidden; 배경 var(--paper-deep)). 그 안에만 DOM 을 만든다. 전체 화면 오버레이 금지(모달·바텀시트·드로어·토스트·푸시는 stage 안에서 position:absolute 로 흉내).
   - 페이지가 "다시 재생" 때 stage 를 비우고 mount 를 다시 부른다 → 여러 번 호출돼도 안전해야 한다. document/window 리스너 금지(필요하면 stage 에 건다). 타이머는 stage 가 DOM 에서 떨어지면(!stage.isConnected) 스스로 멈추게.
   - 모든 데모는 키보드로 조작 가능(버튼은 <button>, 포커스 표시), 적절한 aria(role, aria-live, aria-expanded 등), prefers-reduced-motion 이면 움직임을 줄이거나 즉시 전환.
   - 실제 Notification 권한 요청·alert()·confirm()·location 이동·외부 요청 금지(푸시 등은 stage 안에서 흉내).
   - code: 사용자가 자기 사이트에 복사해 붙일 "최소 동작 코드". html/css/js 중 필요한 것만(없는 키는 생략). 데모 코드와 동일 동작이어야 하고(복붙하면 돌아가야 함) 군더더기 없이 짧게(각 40줄 이내 권장). 데모 전용 래퍼 클래스(dm-)는 코드 예시에서 쓰지 않는다.
3. src/dojang/<g>.css — 모든 클래스는 `dm-<id>-…` 접두어(충돌 방지). 색·간격은 사이트 토큰 사용: --paper --paper-deep --ink --ink-soft --ink-faint --line --signal --signal-soft --live --card --radius --ease --font-mono --font-sans (다크 테마 자동 대응). 하드코딩 색은 피한다. 애니메이션은 transform/opacity 위주. 아래 공통 클래스는 페이지가 제공하니 다시 정의하지 말 것: .dm-stage, .dm-btn(기본 버튼), .dm-btn.primary.
   모바일 폭(320px)에서도 넘치지 않게.

## 검증 (필수)
- `node --check src/dojang/<g>.js`, JSON 유효성.
- 임시 하네스 HTML 을 스크래치패드(C:\Users\yongsik\AppData\Local\Temp\claude\24462cd165a47e74\1d1aa31c-2f52-497d-abfb-5fc2f0935ba4\scratchpad\<g>\)에 만들어 ../styles.css 대신 절대경로 file:///C:/Users/yongsik/Desktop/juganlab-hub/src/styles.css + 자기 css/js 를 로드하고, 모든 id 를 각자 .dm-stage 에 mount 해서 Playwright 로 스크린샷을 찍어 눈으로 확인(레이아웃 깨짐·넘침·빈 화면 점검), 대표 상호작용(클릭)도 몇 개 실행해 pageerror 0 확인.
  Playwright 실행법: C:\Users\yongsik\payment-tracker 에 임시 .mjs 를 두고 `cd` 후 `CH="C:\Users\yongsik\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe" node 파일.mjs` (import { chromium } from 'playwright'; chromium.launch({executablePath: process.env.CH})). 끝나면 임시 파일 삭제.
- 하네스에는 .dm-stage 공통 스타일(위 설명)을 직접 넣어 확인: .dm-stage{position:relative;min-height:260px;overflow:hidden;background:var(--paper-deep);border-radius:12px;padding:20px} .dm-btn{padding:8px 16px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--ink);font:inherit;cursor:pointer} .dm-btn.primary{background:var(--ink);color:var(--paper);border-color:var(--ink)}

## 보고
끝나면 만든 파일 목록, 항목 id 수, 알려진 한계만 5줄 이내로 보고.

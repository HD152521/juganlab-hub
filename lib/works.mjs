// 작품 목록 전용 페이지(/works). 홈은 소개와 최신 작품 몇 개만 보여 주고, 전체 목록·검색·필터는 여기서 한다.
// 카드·필터 막대는 lib/market.mjs 가 만든 조각을 그대로 받는다(홈·영어와 같은 규격).
import { footer, head, topbar } from './pages.mjs';

export function renderWorks({ barHtml, cardsHtml, moreHtml, total, adHead }) {
  const description = `주간실험실에 올라온 웹·앱·확장 프로그램 ${total}개를 종류와 분야별로 둘러보고 검색합니다. 올라온 작품은 자동 검사를 거치지만 안전을 보장하지는 않습니다.`;
  return `${head({
    title: '작품 둘러보기 | 주간실험실',
    description,
    path: '/works',
    extraHead: '  <script src="/market.js" defer></script>\n',
    adHead,
    alt: { ko: '/works', en: '/en/works' },
  })}
<body>
${topbar('works')}

  <main class="wrap works">
    <div class="works-head">
      <p class="mono doc-label"><a href="/">홈</a> / 작품</p>
      <h1>올라온 작품</h1>
      <p class="doc-lede">처음 만든 웹·앱·확장 프로그램을 둘러보세요. 종류와 분야로 거르고, 이름·만든 사람·태그로 찾을 수 있습니다.</p>
    </div>

${barHtml}
      <div class="experiments" id="market-grid">
${cardsHtml}
      </div>
${moreHtml}
    <p class="works-note">올라온 작품은 만든 사람이 올린 것입니다. 자동 검사는 위험 신호를 걸러 내는 것이며 안전을 보장하지 않습니다. 내 작품을 올리려면 <a href="/submit">올리는 방법</a>을 보세요.</p>
  </main>

${footer}`;
}

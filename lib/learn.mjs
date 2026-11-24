// 배우기(/learn): 초보 개발자용 입구. 도감·개발기를 순서대로 안내한다.
// 올리기(/submit): 다른 사람도 자기 프로젝트를 마켓에 올릴 수 있게 방법을 알려 주는 페이지.
import { escapeHtml } from './markdown.mjs';
import { footer, head, topbar } from './pages.mjs';

const countRef = (ref) => ref.sections.reduce((n, s) => n + s.items.length, 0);
const countUi = (ui) => ui.reduce((n, g) => n + g.items.length, 0);
const dotted = (isoDate) => isoDate.replaceAll('-', '.');

// 홈의 도구함 카드와 같은 모양(.tool)을 쓴다.
const tile = ({ n, href, title, desc, meta }) => `      <a class="tool" href="${href}">
        <span class="tool-n mono">${n}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(desc)}</p>
        <span class="tool-meta mono">${escapeHtml(meta)} <span aria-hidden="true">→</span></span>
      </a>`;

export function renderLearn({ ui, refs }, posts, adHead) {
  const tiles = [
    tile({ n: '01', href: '/dojang/ui', title: 'UI 도감', desc: '토글·모달·탭·애니메이션을 실제로 눌러 보고, 코드를 복사해 갑니다.', meta: `데모 ${countUi(ui)}개` }),
    ...refs.map((r, i) =>
      tile({ n: String(i + 2).padStart(2, '0'), href: `/dojang/${r.slug}`, title: r.title.replace(/ 도감$/, ''), desc: r.description, meta: `항목 ${countRef(r)}개` }),
    ),
  ].join('\n');
  const rows = [...posts]
    .reverse()
    .slice(0, 6)
    .map((p) => `        <li><time class="mono" datetime="${p.date}">${dotted(p.date)}</time><a href="/log/${p.slug}">${escapeHtml(p.title)}</a></li>`)
    .join('\n');
  const description = '처음 개발을 배우는 분을 위한 자료입니다. 직접 눌러 보는 UI 도감, Git·HTTP·정규식 참고, 실제로 겪은 문제를 적은 개발기.';
  return `${head({ title: '개발 참고 | 주간실험실', description, path: '/learn', adHead })}
<body>
${topbar('learn')}

  <main class="doc doc-wide wrap learn">
    <p class="mono doc-label">Learn</p>
    <h1>개발 참고</h1>
    <p class="doc-lede">막힐 때 펼쳐 보는 자료입니다. 눈으로 보고, 눌러 보고, 필요할 때 찾아봅니다.</p>

    <div class="toolbox lp-tiles">
${tiles}
    </div>

    <h2 class="lp-h">실제로 겪은 문제 <a class="mono" href="/log">전체 보기 →</a></h2>
    <ul class="lp-posts">
${rows}
    </ul>
  </main>

${footer}`;
}

const TEMPLATE = `{
  "id": "my-project",
  "name": "내 프로젝트 이름",
  "name_en": "My Project",
  "author": "만든 사람",
  "type": "web",
  "status": "live",
  "url": "https://example.com",
  "summary": "한 문장으로 무엇을 하는 프로젝트인지.",
  "summary_en": "One sentence about what it does.",
  "since": "2026-11-25",
  "tags": ["태그1", "태그2"],
  "features": [{ "title": "주요 기능", "desc": "한 줄 설명" }],
  "howto": ["첫 번째 사용 단계", "두 번째 사용 단계"],
  "links": [{ "label": "소스 보기 (GitHub)", "url": "https://github.com/내아이디/내저장소" }]
}`;

const LOG_TEMPLATE = `{
  "date": "2026-11-25",
  "service": "my-project",
  "kind": "삽질",
  "title": "배포했더니 화면이 하얗게 나온 날",
  "body": "원인은 환경변수 하나였습니다. 어디서 막혔고 어떻게 찾았는지 두세 문장으로."
}`;

export function renderSubmit(adHead) {
  const description = '내가 만든 웹 서비스·앱·확장 프로그램을 개발일지와 함께 주간실험실에 올리는 방법과, 올라온 작품에 적용되는 자동 검사 안내입니다.';
  const steps = [
    '저장소(HD152521/juganlab-hub)를 포크합니다.',
    'data/services.json 배열 끝에 아래 형식의 작품 항목을 추가합니다.',
    '만들면서 겪은 일은 data/log.json 에 일지 항목으로 추가합니다(선택, 쓸수록 작품 페이지가 풍성해집니다).',
    '터미널에서 node build.mjs 를 실행해 오류 없이 빌드되는지 확인합니다.',
    '풀 리퀘스트를 보내면 자동 검사가 돌고, 통과하면 운영자가 내용을 확인한 뒤 반영합니다.',
  ];
  return `${head({ title: '내 작품 올리기 | 주간실험실', description, path: '/submit', adHead, alt: { ko: '/submit', en: '/en/submit' } })}
<body>
${topbar('submit')}

  <main class="doc wrap">
    <p class="mono doc-label"><a href="/">홈</a> / 올리기</p>
    <h1>내 작품 올리기</h1>
    <p class="doc-lede">웹 서비스, 앱, 확장 프로그램 무엇이든 좋습니다. 처음 만든 것도, 아직 부족한 것도 괜찮습니다. 작품 페이지가 생기고, 만들면서 겪은 일은 개발일지로 쌓입니다.</p>

    <h2>올리는 순서</h2>
    <ol>
${steps.map((s) => `      <li>${escapeHtml(s)}</li>`).join('\n')}
    </ol>

    <h2>작품 항목 형식</h2>
    <pre class="submit-code"><code>${escapeHtml(TEMPLATE)}</code></pre>
    <ul>
      <li><code>type</code> 은 web(웹) / app(앱) / extension(확장 프로그램) 중 하나입니다.</li>
      <li><code>status</code> 가 live 이면 <code>url</code> 은 https:// 로 시작해야 합니다. 스토어에 올린 앱·확장은 스토어 주소를 적어 주세요.</li>
      <li><code>name_en</code>, <code>summary_en</code> 은 영어 소개입니다. 지금은 선택이지만, 해외 방문자용 페이지를 열 때 사용합니다.</li>
      <li><code>features</code>, <code>howto</code> 는 작품 페이지에 그대로 나오므로 방문자가 따라 할 수 있게 적어 주세요.</li>
    </ul>

    <h2>개발일지 항목 형식</h2>
    <pre class="submit-code"><code>${escapeHtml(LOG_TEMPLATE)}</code></pre>
    <p><code>service</code> 에 작품의 <code>id</code> 를 적으면 그 작품 페이지에 일지가 붙습니다. 잘된 이야기보다 막히고 헤맨 이야기가 더 도움이 됩니다.</p>

    <h2>자동 검사</h2>
    <p>올라온 작품은 아래 항목을 자동으로 확인합니다. 결과는 카드와 작품 페이지에 "자동 검사 통과 날짜"로 표시되고, 무엇을 봤는지도 같이 적힙니다.</p>
    <ul>
      <li><strong>주소 형식</strong>: https 만 허용하고, 단축 주소·IP 직접 주소·실행 파일을 바로 내려받는 주소는 받지 않습니다.</li>
      <li><strong>접속 확인</strong>: 실제로 열리는지, 열었을 때 파일이 내려받아지지 않는지 봅니다.</li>
      <li><strong>위험 사이트 목록</strong>: Google Safe Browsing 과 VirusTotal 에서 악성·피싱으로 표시된 주소가 아닌지 확인합니다.</li>
      <li><strong>확장 프로그램</strong>: 소스가 있는 GitHub 저장소 주소를 <code>links</code> 에 넣어야 합니다. manifest 의 권한을 읽어 넓은 권한(모든 사이트 접근, 쿠키, 방문 기록 등)을 화면에 알리고, <code>eval</code> 이나 외부 스크립트 불러오기 같은 위험 패턴을 찾습니다.</li>
    </ul>
    <p><strong>이 검사는 위험 신호를 걸러 내는 것이지 안전을 보장하지 않습니다.</strong> 그래서 화면에는 "안전함" 대신 검사한 내용과 날짜만 적습니다. 주소가 바뀌거나 7일이 지나면 다시 검사하고, 문제가 나오면 작품을 내릴 수 있습니다.</p>

    <h2>이런 항목은 받지 않습니다</h2>
    <ul>
      <li>접속이 안 되거나 설명이 실제와 다른 프로젝트</li>
      <li>개인정보를 수집하면서 안내가 없는 서비스, 악성·불법 목적의 도구</li>
      <li>소스를 확인할 수 없는 확장 프로그램</li>
      <li>다른 사람의 작품을 허락 없이 자기 것처럼 올린 항목</li>
    </ul>
    <p>궁금한 점이나 신고는 <a href="mailto:wkdrndydtlr@gmail.com">wkdrndydtlr@gmail.com</a> 으로 보내 주세요.</p>
  </main>

${footer}`;
}

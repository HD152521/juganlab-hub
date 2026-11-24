// 홈 화면 조각: 첫 화면 숫자, 메이커 도구함, 사이트 전체 검색 색인.
import { escapeHtml } from './markdown.mjs';
import { TYPE_LABEL, typeOf } from './projects.mjs';

const countRef = (ref) => ref.sections.reduce((n, s) => n + s.items.length, 0);
const countUi = (ui) => ui.reduce((n, g) => n + g.items.length, 0);

// 첫 화면 숫자. 데이터에서 세어 홈과 실제 내용이 어긋나지 않게 한다.
export function renderHeroMeta(services, posts, { ui, refs }, aiGuides) {
  const tools = countUi(ui) + refs.reduce((n, r) => n + countRef(r), 0) + aiGuides.reduce((n, g) => n + countRef(g), 0);
  return [
    `        <span>올라온 작품 <strong>${services.length}</strong></span>`,
    `        <span>도구함 자료 <strong>${tools}</strong></span>`,
  ].join('\n');
}

// 메이커 도구함: 만드는 사람에게 도움이 되는 자료를 같은 크기 카드 넷으로
export function renderToolbox({ ui, refs }, aiGuides, trending) {
  const refCount = refs.reduce((n, r) => n + countRef(r), 0);
  const aiCount = aiGuides.reduce((n, g) => n + countRef(g), 0);
  const top = trending.weekly.items[0];
  const tile = (n, href, title, desc, meta) => `      <a class="tool" href="${href}">
        <span class="tool-n mono">${n}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(desc)}</p>
        <span class="tool-meta mono">${escapeHtml(meta)} <span aria-hidden="true">→</span></span>
      </a>`;
  return [
    tile('01', '/dojang/ui', 'UI 도감', '토글·모달·페이지네이션 같은 화면 요소를 직접 눌러 보고 언제 쓰는지 익힙니다.', `데모 ${countUi(ui)}개`),
    tile('02', '/learn', '개발 참고', 'Git·HTTP·정규식처럼 자주 막히는 개발 지식을 상황별로 찾습니다.', `항목 ${refCount}개`),
    tile('03', '/ai', 'AI 활용', '개발을 몰라도 바로 복사해 쓰는 프롬프트와 AI 가 하는 말 확인법.', `항목 ${aiCount}개`),
    tile('04', '/trending', 'AI 스킬 어워즈', top ? `이번 주 1위: ${top.name}. GitHub 에서 뜨는 AI 스킬을 매일 갱신합니다.` : 'GitHub 에서 뜨는 AI 스킬을 매일 갱신합니다.', '시상식 보기'),
  ].join('\n');
}

// 홈 검색용 색인. 제목·요약·종류·주소만 담는다(본문은 넣지 않는다).
export function buildSearchIndex({ ui, refs }, aiGuides, services) {
  const entries = [];
  for (const g of ui) for (const i of g.items) entries.push({ t: i.title, s: i.summary, u: `/dojang/ui#${i.id}`, k: 'UI 도감' });
  for (const r of refs) for (const sec of r.sections) for (const i of sec.items) entries.push({ t: i.term, s: i.short, u: `/dojang/${r.slug}`, k: r.title });
  for (const g of aiGuides) for (const sec of g.sections) for (const i of sec.items) entries.push({ t: i.term, s: i.short, u: `/ai/${g.slug}`, k: `AI · ${g.title}` });
  for (const s of services) entries.push({ t: s.name, s: s.summary, u: `/p/${s.id}`, k: `작품 · ${TYPE_LABEL[typeOf(s)]}` });
  return entries;
}

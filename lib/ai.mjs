// AI 활용 섹션: /ai (첫 화면), /ai/<slug> (가이드). 데이터는 data/ai/guide-*.json (참고 도감과 같은 스키마).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { escapeHtml } from './markdown.mjs';
import { footer, head, topbar } from './pages.mjs';

const ID_RE = /^[a-z0-9-]+$/;

export function readAiGuides(dir) {
  if (!existsSync(dir)) return [];
  const errors = [];
  const guides = readdirSync(dir)
    .filter((f) => /^guide-.+\.json$/.test(f))
    .sort()
    .map((f) => ({ file: f, ...JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
  const slugs = new Set();
  for (const g of guides) {
    if (!ID_RE.test(g.slug ?? '')) errors.push(`${g.file}: slug 형식이 잘못됐습니다`);
    if (slugs.has(g.slug)) errors.push(`${g.file}: slug 가 중복됩니다`);
    slugs.add(g.slug);
    if (!g.title || !g.description || !g.intro) errors.push(`${g.file}: title·description·intro 가 필요합니다`);
    for (const s of g.sections ?? []) for (const i of s.items) if (!i.term || !i.short) errors.push(`${g.file}: term·short 가 필요합니다`);
  }
  if (errors.length) throw new Error(`AI 가이드 데이터 오류 ${errors.length}건\n- ${errors.join('\n- ')}`);
  return guides;
}

const count = (g) => g.sections.reduce((n, sec) => n + sec.items.length, 0);

// 읽는 순서. 목록에 없는 가이드는 뒤에 붙는다.
const ORDER = ['prompt-basics', 'prompt-examples', 'ai-mistakes', 'ai-terms'];
const STEP_LABEL = {
  'prompt-basics': '질문하는 법부터',
  'prompt-examples': '상황별로 복사해 쓰기',
  'ai-mistakes': 'AI 말을 믿어도 되는지 확인하기',
  'ai-terms': '낯선 용어 풀어 읽기',
};

// 상황별 예시 가이드에서 섹션마다 첫 번째 복사용 프롬프트를 뽑는다
function featuredPrompts(guides) {
  const g = guides.find((x) => x.slug === 'prompt-examples');
  if (!g) return [];
  return g.sections
    .flatMap((sec) => sec.items.filter((i) => i.example).slice(0, 1).map((i) => ({ ...i, group: sec.name })))
    .slice(0, 6);
}

const promptBubble = (p) => `      <figure class="ai-bubble">
        <figcaption><span class="mono">${escapeHtml(p.group)}</span> ${escapeHtml(p.term)}</figcaption>
        <div class="rf-code"><pre><code>${escapeHtml(p.example)}</code></pre><button type="button" class="dm-btn" data-copy>복사</button></div>
      </figure>`;

export function renderAiIndex(guides, adHead) {
  const ordered = [...guides].sort((a, b) => {
    const ia = ORDER.indexOf(a.slug);
    const ib = ORDER.indexOf(b.slug);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const steps = ordered
    .map(
      (g, n) => `      <li><a class="ai-step" href="/ai/${g.slug}">
        <span class="ai-step-n mono">${String(n + 1).padStart(2, '0')}</span>
        <span class="ai-step-t"><strong>${escapeHtml(STEP_LABEL[g.slug] ?? g.title)}</strong><span>${escapeHtml(g.description)}</span></span>
        <span class="ai-step-c mono">${count(g)}개 <span aria-hidden="true">→</span></span>
      </a></li>`,
    )
    .join('\n');
  const prompts = featuredPrompts(guides);
  const description = 'ChatGPT·Claude·Gemini 같은 AI 를 일에 쓰는 일반인을 위한 자료. 프롬프트 기본기, 상황별 복사용 프롬프트, AI 가 틀릴 때 확인하는 법, 용어 정리를 모았습니다.';
  const extraHead = `  <link rel="stylesheet" href="/dojang/dojang.css">\n  <script src="/dojang/dojang-ref.js" defer></script>\n`;
  return `${head({ title: 'AI 활용 | 주간실험실', description, path: '/ai', extraHead, adHead })}
<body>
${topbar('ai')}

  <main class="doc doc-wide wrap">
    <section class="ai-hero">
      <div>
        <p class="mono doc-label">AI · 활용</p>
        <h1><span class="nb">AI 에게,</span> <span class="nb">제대로 물어보는 법</span></h1>
        <p class="doc-lede">같은 AI 도 어떻게 묻느냐에 따라 답이 달라집니다. 개발을 몰라도 됩니다. 바로 붙여넣어 쓸 프롬프트와, AI 의 말을 어디까지 믿어도 되는지를 정리했습니다.</p>
        <p class="ai-cta"><a class="mail" href="#prompts">복사해 쓰는 프롬프트</a><a class="ghost-link" href="/ai/prompt-basics">기본기부터 읽기</a></p>
      </div>
      <div class="chat" role="img" aria-label="막연하게 묻는 것과 구체적으로 묻는 것을 비교한 대화 예시">
        <div class="chat-bar mono"><i></i><i></i><i></i><span>AI 챗봇 · 예시 화면</span></div>
        <div class="chat-body">
          <p class="chat-tag mono">막연하게 물으면</p>
          <div class="chat-me chat-dim">메일 써 줘</div>
          <div class="chat-ai">어떤 메일인가요? 받는 분과 목적, 분량을 알려 주시면 더 정확하게 쓸 수 있어요.</div>
          <p class="chat-tag mono chat-tag-on">구체적으로 물으면</p>
          <div class="chat-me">팀장님께 일정 지연을 사과하는 메일을 정중하게, 5문장 이내로 써 줘.</div>
          <div class="chat-ai chat-typing" aria-hidden="true"><i></i><i></i><i></i></div>
        </div>
      </div>
    </section>

    <h2 class="dm-section-title"><span class="mono">01</span> 이 순서로 읽어 보세요</h2>
    <ol class="ai-steps">
${steps}
    </ol>

    <h2 id="prompts" class="dm-section-title"><span class="mono">02</span> 바로 복사해 쓰는 프롬프트</h2>
    <p class="doc-lede">[대괄호] 부분만 내 상황에 맞게 바꾸세요. 더 많은 예시는 <a href="/ai/prompt-examples">상황별 프롬프트 예시</a>에 있습니다.</p>
    <div class="ai-prompts">
${prompts.map(promptBubble).join('\n')}
    </div>
    <div class="dm-toast" id="dm-toast" role="status" aria-live="polite"></div>
  </main>

${footer}`;
}

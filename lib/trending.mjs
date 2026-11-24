// /trending: GitHub 에서 요즘 뜨는 AI 스킬·에이전트 도구를 시상식으로 보여 준다.
// data/trending.json 은 scripts/fetch-trending.mjs 가 매일 갱신한다.
import { existsSync, readFileSync } from 'node:fs';
import { escapeHtml } from './markdown.mjs';
import { footer, head, topbar } from './pages.mjs';

export function readTrending(file, koFile) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const ko = existsSync(koFile) ? JSON.parse(readFileSync(koFile, 'utf8')) : {};
  for (const key of ['weekly', 'daily']) {
    if (!Array.isArray(data[key]?.items)) throw new Error(`trending.json: ${key}.items 가 없습니다`);
    for (const item of data[key].items) {
      if (!/^https:\/\/github\.com\//.test(item.url)) throw new Error(`trending.json: ${item.name} 의 url 이 GitHub 주소가 아닙니다`);
      item.ko = ko[item.name] ?? null;
    }
  }
  return data;
}

const dotted = (day) => day.replaceAll('-', '.');
const short = (day) => day.slice(5).replace('-', '/');
const stars = (n) => n.toLocaleString('ko-KR');

const MEDAL = { 1: ['GOLD', '금상', 'WINNER'], 2: ['SILVER', '은상', ''], 3: ['BRONZE', '동상', ''] };

const TROPHY = `<svg class="tr-trophy" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M14 6h20v10a10 10 0 0 1-20 0V6Z" fill="currentColor"/><path d="M14 9H7v3a7 7 0 0 0 7 7M34 9h7v3a7 7 0 0 1-7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M21 26h6v7h-6zM15 40h18v3H15z" fill="currentColor"/></svg>`;

// 영어 원문 설명은 보여 주지 않는다. 한국어 요약이 아직 없으면 그렇다고 알린다.
const summaryOf = (item) => (item.ko ? escapeHtml(item.ko.summary) : '한국어 요약을 준비하고 있습니다.');
const tagsOf = (item) =>
  item.ko?.tags?.length ? `<ul class="tags-ko" aria-label="태그">${item.ko.tags.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : '';

function podiumSlot(item, rank) {
  const [en, ko, ribbon] = MEDAL[rank];
  return `        <article class="tp-slot tp-${rank}">
          ${ribbon ? `<span class="tp-ribbon mono">${ribbon}</span>` : ''}
          ${TROPHY}
          <div class="tp-card">
            <p class="tp-prize mono">${en} · ${ko}</p>
            <h3><a href="${escapeHtml(item.url)}" rel="noopener noreferrer">${escapeHtml(item.name)}</a></h3>
            <p class="tp-desc">${summaryOf(item)}</p>
            ${tagsOf(item)}
            <p class="tp-meta mono"><span>★ ${stars(item.stars)}</span>${item.language ? `<span>${escapeHtml(item.language)}</span>` : ''}<span>${dotted(item.created)} 생성</span></p>
          </div>
          <div class="tp-step" aria-hidden="true"><span>${rank}</span></div>
        </article>`;
}

function nominee(item, rank) {
  return `        <li class="tn-item">
          <span class="tn-rank mono">${rank}</span>
          <div class="tn-body">
            <a href="${escapeHtml(item.url)}" rel="noopener noreferrer">${escapeHtml(item.name)}</a>
            <p>${summaryOf(item)}</p>
            ${tagsOf(item)}
          </div>
          <span class="tn-stars mono">★ ${stars(item.stars)}</span>
        </li>`;
}

// 1~3위는 시상대, 4위부터는 후보 목록
function renderStage(items) {
  const rest = items.slice(3);
  return `      <div class="tp">
${items.slice(0, 3).map((it, i) => podiumSlot(it, i + 1)).join('\n')}
      </div>
${rest.length ? `      <p class="tn-label mono">NOMINEES · 후보</p>
      <ol class="tn" start="4">
${rest.map((it, i) => nominee(it, i + 4)).join('\n')}
      </ol>` : ''}`;
}

// 날짜별 금상 기록
function renderHistory(history) {
  const cards = history
    .map((h, i) => {
      const win = h.items[0];
      if (!win) return '';
      return `        <li class="th-day${i === 0 ? ' th-today' : ''}">
          <span class="th-date mono">${short(h.date)}</span>
          <strong>${escapeHtml(win.name.split('/')[1] ?? win.name)}</strong>
          <span class="th-owner mono">${escapeHtml(win.name.split('/')[0])}</span>
          <span class="th-stars mono">★ ${stars(win.stars)}</span>
        </li>`;
    })
    .join('\n');
  return `    <section class="th" aria-labelledby="th-title">
      <h2 id="th-title" class="th-title">지난 수상 기록 <span class="mono">매일 금상</span></h2>
      <ol class="th-list">
${cards}
      </ol>
    </section>`;
}

const TAB_SCRIPT = `<script>
(function () {
  var main = document.querySelector('.tr');
  if (!main) return;
  var tabs = main.querySelectorAll('[role="tab"]');
  var panels = { week: main.querySelector('#panel-week'), day: main.querySelector('#panel-day') };
  function show(key) {
    tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === key)); });
    Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== key; });
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.tab); }); });
  main.classList.add('tr-js');
  show('week');
})();
</script>`;

export function renderTrending(data, adHead) {
  const description = 'GitHub 에서 요즘 뜨는 AI 스킬·에이전트·MCP 저장소를 시상식처럼 보여 줍니다. 이번 주 금·은·동상과 오늘의 수상작을 매일 갱신합니다.';
  return `${head({ title: 'AI 스킬 어워즈 | 주간실험실', description, path: '/trending', adHead })}
<body class="tr-page">
${topbar('trending')}

  <main class="tr">
    <header class="tr-hero">
      <div class="tr-beams" aria-hidden="true"></div>
      <p class="tr-kicker mono">GITHUB · AI SKILL AWARDS</p>
      <h1>AI 스킬 어워즈</h1>
      <p class="tr-lede">요즘 GitHub 에서 가장 많은 별을 받은 새 AI 스킬·에이전트·MCP 저장소. 주간 시상은 일요일에, 오늘의 수상작은 매일 새로 가립니다.</p>
      <div class="tr-tabs" role="tablist" aria-label="기간 선택">
        <button type="button" role="tab" data-tab="week" aria-selected="true" aria-controls="panel-week">이번 주 <span class="mono">${short(data.weekly.from)}–${short(data.weekly.date)}</span></button>
        <button type="button" role="tab" data-tab="day" aria-selected="false" aria-controls="panel-day">오늘 <span class="mono">${short(data.daily.date)}</span></button>
      </div>
    </header>

    <section class="tr-stage" id="panel-week" aria-label="이번 주 시상식">
${renderStage(data.weekly.items)}
    </section>

    <section class="tr-stage" id="panel-day" aria-label="오늘의 수상작">
      <h2 class="tr-sub mono">TODAY · ${dotted(data.daily.date)} · 오늘의 수상작</h2>
${renderStage(data.daily.items)}
    </section>

${renderHistory(data.history)}

    <p class="tr-fine">공식 트렌딩 API 가 없어서 <span class="mono">${escapeHtml(data.topics.join(', '))}</span> 토픽 중 기간 안에 새로 만들어진 저장소를 별 많은 순으로 뽑았습니다. 별 수만으로 고른 목록이라 안전하거나 품질이 좋다는 뜻이 아닙니다. <strong>코드를 직접 확인하기 전에는 설치·실행하지 마세요.</strong></p>
  </main>
  ${TAB_SCRIPT}

${footer}`;
}

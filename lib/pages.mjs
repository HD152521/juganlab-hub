// 글 목록(/log)과 글 페이지(/log/<slug>) HTML. 디자인은 src/styles.css 를 그대로 쓴다.
// 하위 경로(/log/…)에서도 깨지지 않게 이 페이지들의 링크·자원 주소는 모두 / 로 시작한다.
import { escapeHtml } from './markdown.mjs';

export const SITE = 'https://juganlab.com';
const FONT_URL =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans+KR:wght@400;600;700&display=swap';

const dotted = (isoDate) => isoDate.replaceAll('-', '.');
// </script> 가 JSON 안에 끼지 않게 한다.
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

function head({ title, description, path, type = 'website', extraHead = '', adHead }) {
  const url = `${SITE}${path}`;
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="주간실험실">
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="theme-color" content="#f6f3ec" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#12161e" media="(prefers-color-scheme: dark)">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${FONT_URL}" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <script>try{var t=localStorage.getItem("jl-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}</script>
${extraHead}${adHead}
</head>`;
}

const topbar = (current) => {
  const link = (href, label, key) =>
    `<a href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `  <header class="topbar">
    <div class="wrap">
      <a class="brand" href="/" aria-label="주간실험실 홈">
        <span class="brand-mark" aria-hidden="true">JL</span>
        주간실험실
      </a>
      <nav class="nav nav-sub" aria-label="주요 메뉴">
        ${link('/', '홈', 'home')}
        ${link('/log', '개발기', 'log')}
        ${link('/about', '소개', 'about')}
      </nav>
    </div>
  </header>`;
};

const footer = `  <footer class="footer">
    <div class="wrap">
      <span>© 2026 주간실험실 JUGAN LAB</span>
      <span class="footer-links"><a href="/log">개발기</a><a href="/about">소개</a><a href="/privacy">개인정보처리방침</a></span>
    </div>
  </footer>
</body>
</html>
`;

const tagOf = (post, nameOf) => [nameOf[post.service], post.kind].filter(Boolean).map(escapeHtml).join(' · ');

export function renderLogIndex(posts, nameOf, adHead) {
  const newest = [...posts].reverse();
  const items = newest
    .map(
      (p) => `        <li class="entry">
          <time class="mono" datetime="${p.date}">${dotted(p.date)}</time>
          <div>
            <span class="entry-tag mono">${tagOf(p, nameOf)}</span>
            <h2><a href="/log/${p.slug}">${escapeHtml(p.title)}</a></h2>
            <p>${escapeHtml(p.description)}</p>
          </div>
        </li>`,
    )
    .join('\n');
  const description =
    '주간실험실이 서비스를 만들며 겪은 문제와 고친 방법을 기록한 개발기입니다. CertNote 의 셸·SQL 실습장, 색인, 캐시, 문제 품질 이야기를 담았습니다.';
  const ld = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: '주간실험실 개발기',
    url: `${SITE}/log`,
    blogPost: newest.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/log/${p.slug}`, datePublished: p.date })),
  });
  return `${head({ title: '개발기 | 주간실험실', description, path: '/log', extraHead: `  ${ld}\n`, adHead })}
<body>
${topbar('log')}

  <main class="doc doc-wide wrap">
    <p class="mono doc-label">02 / Lab log</p>
    <h1>개발기</h1>
    <p class="doc-lede">서비스를 만들며 막혔던 곳과 고친 방법을 적어 둡니다. 모든 글은 저장소의 커밋 기록과 작업 문서에서 확인한 내용만으로 씁니다.</p>

    <ol class="timeline post-list">
${items}
    </ol>
  </main>

${footer}`;
}

// 소개 페이지. 수치는 data/ 에서 계산해 홈과 어긋나지 않게 한다.
export function renderAbout(services, posts, adHead) {
  const live = services.filter((s) => s.status !== 'building');
  const serviceItems = live
    .map((s) => {
      const stats = (s.stats ?? []).map((st) => `${escapeHtml(st.label)} ${st.value.toLocaleString('ko-KR')}`).join(' · ');
      return `      <li><a href="${escapeHtml(s.url)}">${escapeHtml(s.name)}</a> — ${escapeHtml(s.summary)}${stats ? ` (${stats})` : ''}</li>`;
    })
    .join('\n');
  const description = '주간실험실은 일상과 공부에서 불편했던 것을 작은 웹 서비스로 만들어 공개하는 1인 개발 연구소입니다. 운영 원칙과 서비스, 개발기를 소개합니다.';
  return `${head({ title: '소개 | 주간실험실', description, path: '/about', adHead })}
<body>
${topbar('about')}

  <main class="doc wrap">
    <p class="mono doc-label">About</p>
    <h1>주간실험실 소개</h1>
    <p class="doc-lede">주간실험실(JUGAN LAB)은 일상과 공부에서 불편했던 것을 작은 웹 서비스로 만들어 공개하는 1인 개발 연구소입니다. 만든 서비스는 각자의 주소에서 누구나 무료로 쓸 수 있습니다.</p>

    <h2>지금 운영 중인 서비스</h2>
    <ul>
${serviceItems}
    </ul>

    <h2>이 사이트에 있는 것</h2>
    <ul>
      <li><a href="/">홈</a>: 운영 중인 서비스 목록과 실험 일지(출시·개선 기록)를 한곳에 모았습니다.</li>
      <li><a href="/log">개발기</a>: 서비스를 만들며 막혔던 문제와 고친 방법을 적은 글 ${posts.length}편이 있습니다. 글은 저장소의 커밋 기록과 작업 문서에서 확인한 내용만으로 정리합니다.</li>
      <li><a href="/privacy">개인정보처리방침</a>: 이 사이트가 수집하는 정보와 광고·쿠키 안내입니다.</li>
    </ul>

    <h2>이렇게 만듭니다</h2>
    <ul>
      <li><strong>작게, 빨리 공개합니다.</strong> 완벽해질 때까지 붙잡고 있지 않고, 쓸 수 있는 상태가 되면 먼저 공개한 뒤 고쳐 나갑니다.</li>
      <li><strong>누구나 무료로 씁니다.</strong> 핵심 기능은 가입 없이도 쓸 수 있게 만들고, 운영비는 페이지에 실리는 광고로 충당합니다.</li>
      <li><strong>직접 확인한 내용만 씁니다.</strong> 학습 자료처럼 정확해야 하는 내용은 공식 문서를 기준으로 검토하고, 틀린 곳은 알려 주시면 고칩니다. CertNote 의 제작·검수 방식은 <a href="https://cert.juganlab.com/about/how-we-make">제작 방식 페이지</a>에 따로 공개해 두었습니다.</li>
    </ul>

    <h2>연락</h2>
    <p>서비스 이용 문의, 콘텐츠 오류 제보, 협업 제안은 <a href="mailto:wkdrndydtlr@gmail.com">wkdrndydtlr@gmail.com</a> 으로 받습니다.</p>
  </main>

${footer}`;
}

function renderPostNav(prev, next) {
  if (!prev && !next) return '';
  const cell = (post, dir, label) =>
    post
      ? `<a class="post-nav-${dir}" href="/log/${post.slug}" rel="${dir}"><span class="mono">${label}</span><strong>${escapeHtml(post.title)}</strong></a>`
      : '<span></span>';
  return `    <nav class="post-nav" aria-label="이전 글과 다음 글">
      ${cell(prev, 'prev', '← 이전 글')}
      ${cell(next, 'next', '다음 글 →')}
    </nav>`;
}

export function renderPost(post, prev, next, nameOf, adHead) {
  const path = `/log/${post.slug}`;
  const ld = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    ...(post.updated ? { dateModified: post.updated } : {}),
    inLanguage: 'ko',
    mainEntityOfPage: `${SITE}${path}`,
    author: { '@type': 'Organization', name: '주간실험실', url: `${SITE}/` },
    publisher: { '@type': 'Organization', name: '주간실험실', logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png` } },
  });
  const related = post.related
    .map((r) => `<li><a href="${escapeHtml(r.url)}">${escapeHtml(r.label)}</a> <span class="related-host mono">${escapeHtml(new URL(r.url).host + new URL(r.url).pathname.replace(/\/$/, ''))}</span></li>`)
    .join('');
  return `${head({
    title: `${post.title} | 주간실험실 개발기`,
    description: post.description,
    path,
    type: 'article',
    extraHead: `  <meta property="article:published_time" content="${post.date}">\n  ${ld}\n`,
    adHead,
  })}
<body>
${topbar('log')}

  <main class="doc wrap">
    <article class="post">
      <p class="mono doc-label"><a href="/log">개발기</a> · ${tagOf(post, nameOf)}</p>
      <h1>${escapeHtml(post.title)}</h1>
      <p class="post-meta mono"><time datetime="${post.date}">${dotted(post.date)}</time></p>
      <p class="doc-lede">${escapeHtml(post.description)}</p>
      <div class="post-body">
${post.html}
      </div>
      <aside class="related" aria-label="직접 써 보기">
        <p class="mono">직접 써 보기</p>
        <ul>${related}</ul>
      </aside>
    </article>
${renderPostNav(prev, next)}
  </main>

${footer}`;
}

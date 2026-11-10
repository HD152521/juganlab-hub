// robots.txt·sitemap.xml 생성과 dist 안 내부 링크 검사.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { SITE } from './pages.mjs';

export const renderRobots = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;

// pages: [{ path: '/log', lastmod?: 'YYYY-MM-DD' }]
export function renderSitemap(pages) {
  const urls = pages
    .map(({ path, lastmod }) => `  <url>\n    <loc>${SITE}${path}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const listHtml = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listHtml(full);
    return name.endsWith('.html') ? [full] : [];
  });

// Vercel cleanUrls 와 같은 규칙으로 주소 → 파일을 찾는다: /a → a.html, /a/ → a/index.html, /a.png → 그대로.
function resolveTarget(dist, urlPath) {
  const clean = decodeURI(urlPath.split(/[?#]/)[0]);
  if (clean === '' || clean === '/') return existsSync(join(dist, 'index.html'));
  const rel = clean.replace(/^\//, '');
  const candidates = clean.endsWith('/') ? [join(rel, 'index.html')] : [rel, `${rel}.html`, join(rel, 'index.html')];
  return candidates.some((c) => existsSync(join(dist, c)) && statSync(join(dist, c)).isFile());
}

// 깨진 내부 링크가 있으면 배포하지 않는다. 바깥 주소(https://…)는 여기서 보지 않는다.
export function checkInternalLinks(dist) {
  const broken = [];
  for (const file of listHtml(dist)) {
    const html = readFileSync(file, 'utf8');
    const pageDir = '/' + relative(dist, dirname(file)).split(sep).join('/');
    for (const [, url] of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:|#|data:)/.test(url) || url.startsWith('//')) continue;
      const absolute = url.startsWith('/') ? url : posix.join(pageDir, url);
      if (!resolveTarget(dist, absolute)) broken.push(`${relative(dist, file)} → ${url}`);
    }
  }
  if (broken.length) throw new Error(`깨진 내부 링크 ${broken.length}건\n- ${broken.join('\n- ')}`);
}

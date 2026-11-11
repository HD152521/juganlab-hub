// 개발기 글에 쓰는 작은 마크다운 변환기.
// 외부 패키지를 쓰지 않으려고 글에 실제로 쓰는 문법만 지원한다. 모르는 문법은 조용히 넘기지 않고 오류를 낸다.
//
// 블록: ## 소제목, ### 작은 제목, 문단, - 목록, 1. 번호 목록, > 인용, ``` 코드 블록, | 표 |
// 인라인: `코드`, **굵게**, [글자](주소)

export const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const SAFE_URL_RE = /^(https:\/\/|\/|#|mailto:)/;
const EXTERNAL_RE = /^https:\/\//;

// 코드 조각을 먼저 빼 두어 그 안의 ** 나 [ ] 가 바뀌지 않게 한다.
export function renderInline(text, where) {
  const codes = [];
  let out = text.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = escapeHtml(out);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, rawUrl) => {
    const url = rawUrl.replaceAll('&amp;', '&');
    if (!SAFE_URL_RE.test(url)) throw new Error(`${where}: 허용하지 않는 링크 주소 "${url}"`);
    const rel = EXTERNAL_RE.test(url) ? ' rel="noopener"' : '';
    return `<a href="${escapeHtml(url)}"${rel}>${label}</a>`;
  });
  if (/\*\*|\]\(/.test(out)) throw new Error(`${where}: 닫히지 않은 굵게(**) 또는 링크 문법이 있습니다`);
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

const splitRow = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());

function renderTable(lines, where) {
  const [head, sep, ...rows] = lines;
  if (!sep || !/^\|?\s*:?-{3,}/.test(sep.trim())) throw new Error(`${where}: 표 두 번째 줄은 |---| 구분선이어야 합니다`);
  const headCells = splitRow(head);
  const body = rows.map((row, r) => {
    const cells = splitRow(row);
    if (cells.length !== headCells.length) throw new Error(`${where}: 표 ${r + 1}번째 줄의 칸 수가 머리글과 다릅니다`);
    return `<tr>${cells.map((c) => `<td>${renderInline(c, where)}</td>`).join('')}</tr>`;
  });
  return `<div class="table-wrap"><table><thead><tr>${headCells
    .map((c) => `<th>${renderInline(c, where)}</th>`)
    .join('')}</tr></thead><tbody>${body.join('')}</tbody></table></div>`;
}

const BLOCK_START = /^(#{1,6}\s|```|>\s?|-\s|\d+\.\s|\|)/;

export function renderMarkdown(source, where) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;

  const collect = (test) => {
    const block = [];
    while (i < lines.length && test(lines[i])) block.push(lines[i++]);
    return block;
  };

  while (i < lines.length) {
    const line = lines[i];
    const at = `${where}:${i + 1}`;

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      // 글 제목(h1)은 앞머리에서 만든다. 본문에는 h2·h3 만 쓴다.
      if (level !== 2 && level !== 3) throw new Error(`${at}: 본문 제목은 ## 또는 ### 만 쓸 수 있습니다`);
      html.push(`<h${level}>${renderInline(heading[2].trim(), at)}</h${level}>`);
      i += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      i += 1;
      const code = collect((l) => !l.startsWith('```'));
      if (i >= lines.length) throw new Error(`${at}: 닫히지 않은 코드 블록`);
      i += 1;
      const cls = lang ? ` class="lang-${escapeHtml(lang)}"` : '';
      html.push(`<pre><code${cls}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = collect((l) => /^>\s?/.test(l)).map((l) => l.replace(/^>\s?/, ''));
      html.push(`<blockquote><p>${renderInline(quote.join(' '), at)}</p></blockquote>`);
      continue;
    }

    if (/^-\s/.test(line)) {
      const items = collect((l) => /^-\s/.test(l) || /^\s{2,}\S/.test(l));
      const merged = [];
      for (const item of items) {
        if (/^-\s/.test(item)) merged.push(item.replace(/^-\s+/, ''));
        else merged[merged.length - 1] += ` ${item.trim()}`;
      }
      html.push(`<ul>${merged.map((t) => `<li>${renderInline(t, at)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items = collect((l) => /^\d+\.\s/.test(l) || /^\s{2,}\S/.test(l));
      const merged = [];
      for (const item of items) {
        if (/^\d+\.\s/.test(item)) merged.push(item.replace(/^\d+\.\s+/, ''));
        else merged[merged.length - 1] += ` ${item.trim()}`;
      }
      html.push(`<ol>${merged.map((t) => `<li>${renderInline(t, at)}</li>`).join('')}</ol>`);
      continue;
    }

    if (line.trim().startsWith('|')) {
      html.push(renderTable(collect((l) => l.trim().startsWith('|')), at));
      continue;
    }

    if (/^\s*(<|\*\s|\+\s)/.test(line)) throw new Error(`${at}: 지원하지 않는 문법입니다(HTML, * 목록, + 목록)`);

    const para = collect((l) => l.trim() && !BLOCK_START.test(l));
    html.push(`<p>${renderInline(para.map((l) => l.trim()).join(' '), at)}</p>`);
  }

  return html.join('\n');
}

// 글자 수 검사용: 태그를 걷어 낸 본문 글자.
export const plainText = (html) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39);/g, 'x')
    .replace(/\s+/g, ' ')
    .trim();

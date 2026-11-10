// 개발기 글 읽기·검증: data/posts/<slug>.md 를 읽어 앞머리(--- … ---)와 본문 HTML 로 나눈다.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { plainText, renderMarkdown } from './markdown.mjs';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// 애드센스 "가치가 별로 없는 콘텐츠" 거절 뒤 정한 하한. 공백을 뺀 본문 글자 수.
export const MIN_POST_CHARS = 1500;
const DESCRIPTION_MAX = 160;

// 앞머리 형식: "키: 값" 한 줄씩. related 는 여러 번 쓸 수 있고 "보여 줄 이름 | https://주소" 모양이다.
function parseFrontMatter(raw, file) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!match) throw new Error(`${file}: 맨 위에 --- 로 감싼 앞머리가 필요합니다`);
  const meta = { related: [] };
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const kv = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!kv) throw new Error(`${file}: 앞머리 줄을 읽을 수 없습니다 → "${line}"`);
    const [, key, value] = kv;
    if (key === 'related') {
      const [label, url] = value.split('|').map((s) => s.trim());
      meta.related.push({ label, url });
    } else {
      meta[key] = value.trim();
    }
  }
  return { meta, body: match[2] };
}

function validatePost(post, serviceIds) {
  const errors = [];
  const at = `data/posts/${post.slug}.md`;
  if (!SLUG_RE.test(post.slug)) errors.push(`${at}: 파일 이름은 영문 소문자·숫자·하이픈만 씁니다`);
  if (!post.title) errors.push(`${at}: title 이 비어 있습니다`);
  if (!post.description) errors.push(`${at}: description 이 비어 있습니다`);
  else if (post.description.length > DESCRIPTION_MAX) errors.push(`${at}: description 은 ${DESCRIPTION_MAX}자 이하로 씁니다`);
  if (!DATE_RE.test(post.date ?? '')) errors.push(`${at}: date 는 YYYY-MM-DD 형식이어야 합니다`);
  if (!serviceIds.has(post.service)) errors.push(`${at}: service "${post.service}" 가 services.json 에 없습니다`);
  if (!post.related.length) errors.push(`${at}: related(직접 써 볼 서비스 페이지)가 하나 이상 필요합니다`);
  for (const r of post.related) {
    if (!r.label || !/^https:\/\//.test(r.url ?? '')) errors.push(`${at}: related 는 "이름 | https://주소" 모양이어야 합니다`);
  }
  if (post.chars < MIN_POST_CHARS) errors.push(`${at}: 본문이 ${post.chars}자입니다(공백 제외 ${MIN_POST_CHARS}자 이상)`);
  return errors;
}

export function readPosts(dir, serviceIds) {
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  const posts = files.map((file) => {
    const { meta, body } = parseFrontMatter(readFileSync(join(dir, file), 'utf8'), file);
    const slug = file.replace(/\.md$/, '');
    const html = renderMarkdown(body, `data/posts/${file}`);
    const text = plainText(html);
    return { ...meta, slug, html, chars: text.replace(/\s/g, '').length, charsWithSpaces: text.length };
  });

  const errors = posts.flatMap((p) => validatePost(p, serviceIds));
  if (errors.length) throw new Error(`글 오류 ${errors.length}건\n- ${errors.join('\n- ')}`);

  // 오래된 글부터. 이전/다음 링크가 이 순서를 쓴다. 같은 날짜면 파일 이름순.
  return posts.sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
}

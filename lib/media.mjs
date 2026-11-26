// 작품 이미지(thumbnail·screenshots) 검증과 렌더링. 다른 lib 파일을 불러오지 않는 순수 조각이다.
// 데이터에 이미지가 없으면 종류·분야에 맞는 대체 그림을 CSS 로 그린다.
import { escapeHtml } from './markdown.mjs';

export const MAX_SCREENSHOTS = 8;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)(\?[\w=&.-]*)?$/i;
const LOCAL_PATH = /^\/(?!\/)[\w./-]+$/;
const REMOTE_URL = /^https:\/\/[^\s"'<>\\]+$/;

// 이 사이트 안의 경로(/img/…)이거나 https 이미지 주소만 받는다. 그 밖의 형식은 빌드가 막는다.
export const isImageRef = (value) =>
  typeof value === 'string' && value.length <= 500 && !value.includes('..') && (LOCAL_PATH.test(value) || REMOTE_URL.test(value)) && IMAGE_EXT.test(value);

// screenshots 는 "경로" 문자열이나 { src, caption } 모두 받는다. 항상 { src, caption } 로 맞춘다.
export function screenshotsOf(s) {
  return (Array.isArray(s.screenshots) ? s.screenshots : []).map((x) => (typeof x === 'string' ? { src: x, caption: '' } : { src: x?.src, caption: x?.caption ?? '' }));
}

// howto 는 "문장" 문자열이나 { text, image } 모두 받는다.
export function howtoOf(s) {
  return (Array.isArray(s.howto) ? s.howto : []).map((x) => (typeof x === 'string' ? { text: x, image: '' } : { text: x?.text, image: x?.image ?? '' }));
}

export function validateMedia(s, at, errors) {
  if (s.thumbnail !== undefined && !isImageRef(s.thumbnail)) errors.push(`${at}: thumbnail 은 /로 시작하는 경로나 https:// 이미지 주소(png·jpg·webp·gif·avif)여야 합니다`);
  if (s.screenshots !== undefined) {
    if (!Array.isArray(s.screenshots)) errors.push(`${at}: screenshots 는 배열이어야 합니다`);
    else {
      if (s.screenshots.length > MAX_SCREENSHOTS) errors.push(`${at}: screenshots 는 ${MAX_SCREENSHOTS}장까지입니다`);
      for (const shot of screenshotsOf(s)) {
        if (!isImageRef(shot.src)) errors.push(`${at}: screenshots 항목은 이미지 경로(또는 { src, caption })여야 합니다`);
        if (typeof shot.caption !== 'string' || shot.caption.length > 120) errors.push(`${at}: screenshots 설명은 120자 이하 문자열이어야 합니다`);
      }
    }
  }
  if (s.howto !== undefined) {
    if (!Array.isArray(s.howto)) errors.push(`${at}: howto 는 배열이어야 합니다`);
    else {
      for (const step of howtoOf(s)) {
        if (typeof step.text !== 'string' || !step.text.trim()) errors.push(`${at}: howto 항목에는 문장(text)이 필요합니다`);
        if (step.image && !isImageRef(step.image)) errors.push(`${at}: howto 의 image 는 이미지 경로여야 합니다`);
      }
    }
  }
}

// 이미지 한 장. 크기를 미리 잡아 두어 늦게 떠도 화면이 밀리지 않는다. 외부 주소는 리퍼러를 보내지 않는다.
export const renderImg = (src, alt, { width, height, eager = false } = {}) =>
  `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="${width}" height="${height}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" referrerpolicy="no-referrer">`;

// 카드 대표 이미지. 없으면 종류(웹·앱·확장)와 분야 색에 맞는 대체 그림.
export function renderThumb(s, { type, cat, kindLabel }) {
  if (s.thumbnail && isImageRef(s.thumbnail)) {
    return `<div class="exp-thumb has-img">${renderImg(s.thumbnail, '', { width: 480, height: 300 })}</div>`;
  }
  const initial = [...s.name.trim()][0]?.toUpperCase() ?? '?';
  return `<div class="exp-thumb ph" data-type="${type}" data-cat="${cat}" aria-hidden="true"><span class="ph-glyph">${escapeHtml(initial)}</span><span class="ph-kind mono">${escapeHtml(kindLabel)}</span></div>`;
}

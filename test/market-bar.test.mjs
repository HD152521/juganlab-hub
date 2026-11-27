import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarketBar } from '../lib/market.mjs';

const services = [
  { type: 'web', category: 'study' },
  { type: 'extension', category: 'life' },
];
const render = () =>
  renderMarketBar(services, {
    lang: 'ko',
    types: [['web', '웹'], ['app', '앱'], ['extension', '확장 프로그램']],
    cats: [['study', '학습'], ['life', '생활'], ['game', '게임']],
    typeOf: (s) => s.type,
    catOf: (s) => s.category,
  });

test('작품이 없는 종류와 분야는 필터에 나오지 않는다', () => {
  const html = render();
  assert.doesNotMatch(html, /data-type-filter="app"/);
  assert.doesNotMatch(html, /data-cat-filter="game"/);
});

test('분야는 선택칸 대신 한 번에 누르는 버튼으로 나온다', () => {
  const html = render();
  assert.doesNotMatch(html, /id="market-cat"/);
  for (const id of ['all', 'study', 'life']) assert.match(html, new RegExp(`data-cat-filter="${id}"`));
});

test('처음에는 종류와 분야 모두 전체가 눌려 있다', () => {
  const pressed = render().match(/data-(type|cat)-filter="[a-z]+" aria-pressed="true"/g);
  assert.deepEqual(pressed, ['data-type-filter="all" aria-pressed="true"', 'data-cat-filter="all" aria-pressed="true"']);
});

// data/schema/submission.json 이 앱의 분류·DB 한도와 어긋나지 않는지 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORIES } from '../lib/projects.mjs';

const schema = JSON.parse(readFileSync(new URL('../data/schema/submission.json', import.meta.url), 'utf8'));
const KINDS = new Set(['text', 'longtext', 'url', 'select', 'multiselect', 'boolean', 'tags']);
const allFields = [
  ...schema.common,
  ...Object.values(schema.types).flatMap((t) => t.fields),
  ...Object.values(schema.categoryExtras).flat(),
];

test('종류는 web·app·extension 세 가지다', () => {
  assert.deepEqual(Object.keys(schema.types).sort(), ['app', 'extension', 'web']);
});

test('분야 목록이 사이트의 CATEGORIES 와 같다', () => {
  const ids = CATEGORIES.map((c) => c.id).sort();
  assert.deepEqual([...schema.common.find((f) => f.id === 'category').options].sort(), ids);
  assert.deepEqual(Object.keys(schema.categoryExtras).sort(), ids);
});

test('모든 입력은 id·label·알려진 kind 를 가진다', () => {
  for (const f of allFields) {
    assert.ok(f.id && f.label, `id/label 없음: ${JSON.stringify(f)}`);
    assert.ok(KINDS.has(f.kind), `알 수 없는 kind: ${f.id} ${f.kind}`);
  }
});

test('선택형 입력은 options 와 모든 옵션의 표시 이름을 가진다', () => {
  for (const f of allFields.filter((x) => x.kind === 'select' || x.kind === 'multiselect')) {
    assert.ok(Array.isArray(f.options) && f.options.length > 0, `options 없음: ${f.id}`);
    if (f.id !== 'category') for (const o of f.options) assert.ok(f.labels?.[o], `표시 이름 없음: ${f.id}.${o}`);
  }
});

test('종류별 필드 id 는 종류 안에서, 공통 필드와 겹치지 않는다', () => {
  const common = new Set(schema.common.map((f) => f.id));
  for (const [type, t] of Object.entries(schema.types)) {
    const ids = t.fields.map((f) => f.id);
    assert.equal(new Set(ids).size, ids.length, `${type} 안에서 id 중복`);
    for (const id of ids) assert.ok(!common.has(id), `${type}.${id} 가 공통 필드와 겹침`);
  }
});

test('조건부 필수는 같은 목록의 boolean 입력을 가리킨다', () => {
  for (const f of schema.common.filter((x) => x.requiredWhen)) {
    for (const key of Object.keys(f.requiredWhen)) {
      const ref = schema.common.find((x) => x.id === key);
      assert.equal(ref?.kind, 'boolean', `${f.id} 의 조건 대상이 boolean 이 아님: ${key}`);
    }
  }
});

test('확장 프로그램은 소스 저장소가 필수이고 GitHub 만 받는다', () => {
  const src = schema.types.extension.fields.find((f) => f.id === 'source_url');
  assert.equal(src.required, true);
  assert.deepEqual(src.allowedHosts, ['github.com']);
});

test('금융·건강 분야는 조언이 아님 안내를 반드시 true 로 요구한다', () => {
  for (const [cat, id] of [['finance', 'not_investment_advice'], ['life', 'not_medical_advice']]) {
    const f = schema.categoryExtras[cat].find((x) => x.id === id);
    assert.equal(f?.required, true);
    assert.equal(f?.mustBe, true);
  }
});

test('한도가 supabase/schema.sql 의 제약과 같다', () => {
  const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  const l = schema.limits;
  assert.match(sql, new RegExp(`char_length\\(name\\) between 1 and ${l.name}\\b`));
  assert.match(sql, new RegExp(`char_length\\(summary\\) between 1 and ${l.summary}\\b`));
  assert.match(sql, new RegExp(`char_length\\(description\\) <= ${l.description}\\b`));
  assert.match(sql, new RegExp(`cardinality\\(tags\\) <= ${l.tags}\\b`));
  assert.match(sql, new RegExp(`jsonb_array_length\\(links\\) <= ${l.links}\\b`));
  assert.match(sql, new RegExp(`bytes between 1 and ${l.imageBytes}\\b`));
  assert.match(sql, new RegExp(`height between 1 and ${l.imageMaxPixels}\\b`));
});

test('이미지는 WebP 만, 영상은 YouTube 주소만 받는다', () => {
  assert.deepEqual(schema.limits.imageFormats, ['webp']);
  assert.ok(schema.media.demoVideo.allowedHosts.every((h) => /youtube\.com$|^youtu\.be$/.test(h)));
});

test('바꿔치기 감시: details 의 주소들이 DB 지문과 재검사 트리거에 모두 들어 있다', () => {
  const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  for (const key of ['source_url', 'privacy_url', 'demo_video_url']) {
    assert.ok(sql.includes(`coalesce(details->>'${key}'`), `지문에 ${key} 없음`);
    assert.ok(sql.includes(`new.details->>'${key}' is distinct from old.details->>'${key}'`), `트리거에 ${key} 없음`);
  }
});

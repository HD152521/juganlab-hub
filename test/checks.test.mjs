import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeManifest, checkResponse, checkUrl, scanSource, summarize } from '../lib/checks.mjs';

test('http 주소는 거른다', () => {
  assert.equal(checkUrl('http://example.com').fails.length, 1);
});

test('단축 주소·IP·내부망·실행 파일 주소를 거른다', () => {
  for (const u of ['https://bit.ly/abc', 'https://192.168.0.1/', 'https://localhost/x', 'https://example.com/setup.exe', 'https://example.com/a.apk?x=1']) {
    assert.ok(checkUrl(u).fails.length > 0, u);
  }
});

test('정상 https 주소는 통과한다', () => {
  assert.deepEqual(checkUrl('https://cert.juganlab.com/').fails, []);
});

test('접속 실패와 파일 내려받기 응답을 거른다', () => {
  assert.equal(checkResponse({ status: 404 }).length, 1);
  assert.equal(checkResponse({ status: 200, contentType: 'application/octet-stream' }).length, 1);
  assert.equal(checkResponse({ status: 200, disposition: 'attachment; filename=a.exe' }).length, 1);
  assert.deepEqual(checkResponse({ status: 200, contentType: 'text/html' }), []);
});

test('manifest: 넓은 권한은 경고, unsafe-eval 은 실패', () => {
  const warn = analyzeManifest({ manifest_version: 3, permissions: ['storage', 'cookies'], host_permissions: ['<all_urls>'] });
  assert.deepEqual(warn.fails, []);
  assert.equal(warn.warns.length, 2);
  const bad = analyzeManifest({ manifest_version: 3, content_security_policy: { extension_pages: "script-src 'self' 'unsafe-eval'" } });
  assert.equal(bad.fails.length, 1);
  assert.ok(analyzeManifest(null).fails.length);
});

test('소스 휴리스틱', () => {
  assert.deepEqual(scanSource('const a = 1;'), []);
  assert.ok(scanSource('eval(x)').includes('eval() 사용'));
  assert.ok(scanSource('<script src="https://evil.example/a.js"></script>').length);
});

test('summarize: 실패 > 경고 > 통과 순으로 결과가 정해진다', () => {
  assert.equal(summarize({ fails: ['x'], warns: [], notes: [], date: 'd' }).result, 'fail');
  assert.equal(summarize({ fails: [], warns: ['x'], notes: [], date: 'd' }).result, 'warn');
  assert.equal(summarize({ fails: [], warns: [], notes: ['n'], date: 'd' }).result, 'pass');
});

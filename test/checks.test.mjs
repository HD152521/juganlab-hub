import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeManifest, checkResponse, checkUrl, isPrivateHost, isPrivateIp, redactSecrets, sanitizeLog, scanSource, summarize } from '../lib/checks.mjs';
import { guardedLookup, readCapped, safeHead } from '../lib/safe-fetch.mjs';

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

test('내부 이름: 끝의 점·점 없는 이름·내부 접미사로 검사를 피하지 못한다', () => {
  for (const h of ['localhost.', 'LOCALHOST', 'a.localhost', 'metadata', 'nas.lan', 'x.home.arpa', 'intranet.corp.', '127.0.0.1', '[::1]'.slice(1, -1) + ':1']) {
    assert.equal(isPrivateHost(h), true, h);
  }
  assert.equal(isPrivateHost('cert.juganlab.com'), false);
  assert.ok(checkUrl('https://localhost./x').fails.length);
  assert.ok(checkUrl('https://2130706433/').fails.length); // 10진수 IP 는 127.0.0.1 로 정규화된다
  assert.ok(checkUrl('https://[::ffff:7f00:1]/').fails.length);
});

test('내부 IP: 사설·루프백·링크로컬·메타데이터·IPv6 내부 대역을 막는다', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:10.0.0.1', 'garbage']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('DNS 재바인딩: 이름이 내부 주소로 풀리면 연결 전에 거부한다', async () => {
  const toLoopback = (_h, _o, cb) => cb(null, [{ address: '127.0.0.1', family: 4 }]);
  const mixed = (_h, _o, cb) => cb(null, [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }]);
  const pub = (_h, _o, cb) => cb(null, [{ address: '93.184.216.34', family: 4 }]);
  await assert.rejects(() => new Promise((res, rej) => guardedLookup(toLoopback)('rebind.example', {}, (e) => (e ? rej(e) : res()))));
  await assert.rejects(() => new Promise((res, rej) => guardedLookup(mixed)('rebind.example', { all: true }, (e) => (e ? rej(e) : res()))));
  const ok = await new Promise((res, rej) => guardedLookup(pub)('ok.example', {}, (e, a) => (e ? rej(e) : res(a))));
  assert.equal(ok, '93.184.216.34');
  // 네트워크 없이: 이름이 내부 주소로 풀리면 safeHead 가 연결하지 않고 실패한다
  await assert.rejects(() => safeHead('https://rebind.example/', { resolve: toLoopback }));
});

test('safeHead: IP 직접 입력·내부 이름·http 는 이름 풀이 전에 거부한다', async () => {
  for (const u of ['https://127.0.0.1/', 'https://169.254.169.254/latest/meta-data/', 'https://localhost/', 'http://example.com/']) {
    await assert.rejects(() => safeHead(u, { resolve: () => assert.fail('연결 시도 금지') }), u);
  }
});

test('응답 크기 제한: 한도를 넘으면 읽기를 멈추고 오류', async () => {
  assert.equal(await readCapped(new Response('abc'), 10), 'abc');
  await assert.rejects(() => readCapped(new Response('x'.repeat(100)), 10));
});

test('로그: 줄바꿈·워크플로 명령 끼워 넣기를 막고 비밀 값을 가린다', () => {
  assert.ok(!/[\r\n]/.test(sanitizeLog('a\n::error::boom')));
  assert.ok(!sanitizeLog('::add-mask::x').includes('::'));
  assert.equal(redactSecrets('fail key=SECRET123 end', ['SECRET123', undefined, '']), 'fail key=*** end');
});

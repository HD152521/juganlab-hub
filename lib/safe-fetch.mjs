// 사용자가 올린 주소를 서버(CI)가 열어 볼 때 쓰는 안전한 가져오기(SSRF 방어).
// - 주소를 열 때마다 형식 검사(https, 내부 이름·IP 직접 입력·단축 주소 거부)
// - 연결 직전에 이름 풀이 결과를 검사(내부 주소로 풀리면 거부). 검사한 주소로 그대로 연결하므로 DNS 재바인딩도 막는다
// - 리다이렉트는 직접 따라가며 횟수 제한, 전체 시간 제한, 헤더만 읽고 본문은 버린다
import dns from 'node:dns';
import https from 'node:https';
import { checkUrl, isPrivateIp } from './checks.mjs';

export const MAX_REDIRECTS = 5;
export const TOTAL_TIMEOUT_MS = 12_000;

// 연결에 쓰일 주소를 검사하는 lookup. resolve 를 바꿔 끼울 수 있게 해 시험한다.
export function guardedLookup(resolve = dns.lookup) {
  return (hostname, options, callback) => {
    const opts = typeof options === 'function' ? {} : options;
    const done = typeof options === 'function' ? options : callback;
    resolve(hostname, { ...opts, all: true }, (error, addresses) => {
      if (error) return done(error);
      const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: 4 }];
      const bad = list.find((a) => isPrivateIp(a.address));
      if (bad || !list.length) return done(new Error('내부 주소로 연결되는 이름은 받지 않습니다'));
      return opts.all ? done(null, list) : done(null, list[0].address, list[0].family);
    });
  };
}

function requestOnce(url, { lookup, signal }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: 'GET', lookup, signal, headers: { 'user-agent': 'juganlab-check/1.0 (+https://juganlab.com)', accept: '*/*' } },
      (res) => {
        res.destroy(); // 본문은 읽지 않는다(크기 제한을 따로 둘 필요 없음)
        resolve({ status: res.statusCode ?? 0, headers: res.headers });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

// 반환: { status, headers, url(최종 주소), redirects }. 거부·실패는 Error 로 던진다.
export async function safeHead(rawUrl, { resolve, maxRedirects = MAX_REDIRECTS, timeoutMs = TOTAL_TIMEOUT_MS } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const lookup = guardedLookup(resolve);
  try {
    let current = rawUrl;
    for (let hops = 0; ; hops += 1) {
      const { fails } = checkUrl(current, '이동 주소');
      if (fails.length) throw new Error(fails[0]);
      const res = await requestOnce(current, { lookup, signal: ctl.signal });
      const location = res.headers.location;
      if (res.status >= 300 && res.status < 400 && location) {
        if (hops >= maxRedirects) throw new Error(`이동이 ${maxRedirects}번을 넘습니다`);
        current = new URL(location, current).href;
        continue;
      }
      return { status: res.status, headers: res.headers, url: current, redirects: hops };
    }
  } catch (error) {
    if (ctl.signal.aborted) throw new Error(`${timeoutMs / 1000}초 안에 응답하지 않았습니다`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// 본문을 최대 maxBytes 까지만 읽는다. 넘으면 읽기를 멈추고 오류.
export async function readCapped(res, maxBytes) {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error(`응답이 ${maxBytes}바이트를 넘습니다`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// 고정된 신뢰 호스트(GitHub·Google·VirusTotal)용 fetch. 시간 제한이 본문 읽기까지 이어지고 크기 제한이 있다.
export async function timedText(url, init = {}, { ms = TOTAL_TIMEOUT_MS, maxBytes = 1_000_000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    const text = await readCapped(res, maxBytes);
    return { ok: res.ok, status: res.status, text: async () => text, json: async () => JSON.parse(text) };
  } finally {
    clearTimeout(timer);
  }
}

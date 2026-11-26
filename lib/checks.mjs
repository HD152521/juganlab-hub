// 작품 자동 검사의 순수 판정 함수. 네트워크 호출은 scripts/check-submission.mjs 가 맡는다.
// 여기서는 "이 주소·이 manifest 가 위험 신호를 보이는가"만 판단한다. 안전을 보장하지는 않는다.

const SHORTENERS = new Set([
  'bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly', 'shorturl.at', 'rb.gy', 'han.gl', 'url.kr',
]);
const EXEC_EXT = /\.(exe|msi|bat|cmd|scr|ps1|apk|dmg|pkg|jar|vbs|com|zip|rar|7z)(?:$|[?#])/i;

// 위험 권한: 있다고 나쁜 것은 아니지만 사용자에게 알려야 한다
export const RISKY_PERMISSIONS = {
  '<all_urls>': '모든 사이트의 데이터 읽기·변경',
  '*://*/*': '모든 사이트의 데이터 읽기·변경',
  'http://*/*': '모든 http 사이트 접근',
  'https://*/*': '모든 https 사이트 접근',
  webRequest: '네트워크 요청 감시',
  webRequestBlocking: '네트워크 요청 가로채기',
  declarativeNetRequest: '네트워크 요청 규칙 적용',
  cookies: '쿠키 읽기',
  history: '방문 기록 읽기',
  tabs: '열린 탭 주소 읽기',
  nativeMessaging: '컴퓨터 안의 프로그램과 통신',
  debugger: '브라우저 디버거 사용',
  management: '다른 확장 프로그램 관리',
  proxy: '브라우저 프록시 설정 변경',
  downloads: '파일 다운로드',
  clipboardRead: '클립보드 읽기',
};

const INTERNAL_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.lan', '.home.arpa', '.intranet', '.corp'];

export function isPrivateHost(host) {
  // 끝의 점("localhost.")으로 검사를 피하지 못하게 먼저 떼어 낸다
  const h = host.toLowerCase().replace(/\.+$/, '');
  if (h === 'localhost' || INTERNAL_SUFFIXES.some((s) => h.endsWith(s))) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true; // IP 직접 입력은 받지 않는다
  if (h.includes(':')) return true; // IPv6
  if (!h.includes('.')) return true; // 점 없는 이름("metadata" 등)은 내부 이름으로 본다
  return false;
}

// 이름 풀이(DNS) 결과가 사설·루프백·링크로컬 등 내부 주소인지. 이름이 내부 주소로 풀리는 경우(DNS 재바인딩 포함)를 거른다.
export function isPrivateIp(ip) {
  const s = String(ip).toLowerCase();
  if (s.includes(':')) {
    const mapped = s.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/); // IPv4-mapped
    if (mapped) return isPrivateIp(mapped[1]);
    if (s === '::' || s === '::1') return true;
    if (/^f[cd]/.test(s)) return true; // fc00::/7 고유 로컬
    if (/^fe[89ab]/.test(s)) return true; // fe80::/10 링크로컬
    if (/^ff/.test(s)) return true; // 멀티캐스트
    if (/^64:ff9b:/.test(s) || s.startsWith('2001:db8')) return true; // NAT64, 문서용
    return false;
  }
  const p = s.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true; // 이해할 수 없으면 막는다
  const [a, b, c] = p;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // 통신사 공유 대역
  if (a === 169 && b === 254) return true; // 링크로컬(클라우드 메타데이터 169.254.169.254 포함)
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // 멀티캐스트·예약
  return false;
}

// 로그에 찍기 전에 줄바꿈·제어문자를 없앤다(GitHub Actions 의 "::명령::" 끼워 넣기 방지)
export function sanitizeLog(text) {
  return String(text).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/::/g, ': :');
}

// 오류 문장에 비밀 값이 섞여 있으면 가린다
export function redactSecrets(text, secrets) {
  let out = String(text);
  for (const s of secrets) if (s && s.length >= 6) out = out.split(s).join('***');
  return out;
}

// 형식만 보는 검사. 반환: { fails: string[], notes: string[] }
export function checkUrl(raw, label = '주소') {
  const fails = [];
  const notes = [];
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { fails: [`${label}: 주소 형식이 올바르지 않습니다`], notes };
  }
  if (url.protocol !== 'https:') fails.push(`${label}: https 주소만 받습니다`);
  if (url.username || url.password) fails.push(`${label}: 주소에 계정 정보가 들어 있습니다`);
  if (isPrivateHost(url.hostname)) fails.push(`${label}: 내부망·IP 직접 주소는 받지 않습니다`);
  if (SHORTENERS.has(url.hostname.replace(/^www\./, ''))) fails.push(`${label}: 단축 주소는 받지 않습니다(실제 주소를 적어 주세요)`);
  if (EXEC_EXT.test(url.pathname + url.search)) fails.push(`${label}: 실행·압축 파일을 바로 내려받는 주소는 받지 않습니다(스토어나 저장소 주소를 적어 주세요)`);
  if (!fails.length) notes.push(`${label} 형식 확인(https, 단축·IP·직접 다운로드 아님)`);
  return { fails, notes };
}

// 응답 헤더 검사: 열었더니 파일이 내려받아지는 주소를 거른다
export function checkResponse({ status, contentType = '', disposition = '' }, label = '주소') {
  const fails = [];
  if (status >= 400) fails.push(`${label}: 접속할 수 없습니다(HTTP ${status})`);
  if (/application\/(octet-stream|x-msdownload|x-msi|vnd\.android\.package-archive|zip|x-dosexec)/i.test(contentType)) {
    fails.push(`${label}: 열면 파일이 내려받아집니다(${contentType})`);
  }
  if (/attachment/i.test(disposition)) fails.push(`${label}: 열면 파일이 내려받아집니다`);
  return fails;
}

// manifest.json 분석. 반환: { fails, warns, notes }
export function analyzeManifest(manifest) {
  const fails = [];
  const warns = [];
  const notes = [];
  if (!manifest || typeof manifest !== 'object') return { fails: ['manifest.json 을 읽을 수 없습니다'], warns, notes };

  if (manifest.manifest_version !== 3) warns.push(`manifest_version ${manifest.manifest_version ?? '없음'}: 크롬 웹스토어는 3 만 받습니다`);
  const perms = [...(manifest.permissions ?? []), ...(manifest.host_permissions ?? []), ...(manifest.optional_permissions ?? [])];
  const hits = [...new Set(perms.filter((p) => RISKY_PERMISSIONS[p]))];
  for (const p of hits) warns.push(`권한 ${p}: ${RISKY_PERMISSIONS[p]}`);
  const scripts = (manifest.content_scripts ?? []).flatMap((c) => c.matches ?? []);
  if (scripts.some((m) => RISKY_PERMISSIONS[m])) warns.push('content script 가 모든 사이트에서 실행됩니다');

  const csp = typeof manifest.content_security_policy === 'string' ? manifest.content_security_policy : JSON.stringify(manifest.content_security_policy ?? '');
  if (/unsafe-eval/.test(csp)) fails.push('content_security_policy 에 unsafe-eval 이 있습니다');
  if (/script-src[^;]*https?:\/\//.test(csp)) fails.push('content_security_policy 가 외부 주소의 스크립트를 허용합니다');
  notes.push(`manifest 권한 ${perms.length}개 확인${hits.length ? `, 넓은 권한 ${hits.length}개 표시` : ''}`);
  return { fails, warns, notes };
}

// 소스 텍스트의 위험 패턴(휴리스틱). 오탐이 있으므로 경고로만 쓴다.
export function scanSource(text) {
  const found = [];
  if (/\beval\s*\(/.test(text)) found.push('eval() 사용');
  if (/new\s+Function\s*\(/.test(text)) found.push('new Function() 사용');
  if (/<script[^>]+src=["']https?:\/\//i.test(text)) found.push('외부 주소의 스크립트 불러오기');
  if (/importScripts\s*\(\s*["']https?:\/\//.test(text)) found.push('외부 주소의 스크립트 불러오기');
  if (/atob\s*\(\s*["'][A-Za-z0-9+/=]{200,}["']\s*\)/.test(text)) found.push('긴 base64 문자열 해독');
  return found;
}

// 검사 결과를 한 덩어리로
export function summarize({ fails, warns, notes, date }) {
  return {
    date,
    result: fails.length ? 'fail' : warns.length ? 'warn' : 'pass',
    items: [...notes, ...warns.map((w) => `주의: ${w}`), ...fails.map((f) => `문제: ${f}`)],
  };
}

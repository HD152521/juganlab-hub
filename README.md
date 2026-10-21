# 주간실험실 허브 (juganlab.com)

운영 중인 서비스와 개발 기록(실험 일지)을 모아 보여 주는 정적 랜딩 페이지입니다.
화면 내용은 `data/` 의 JSON 에서 빌드 때 HTML 로 만들어집니다.

## 구조

```
data/services.json      서비스 목록 (카드, 콘솔 ls/open 명령)
data/log.json           실험 일지 (타임라인)
src/index.template.html 본문 틀. <!-- @이름 --> 자리를 빌드가 채운다
src/styles.css, app.js, privacy.html
build.mjs               data + src → dist/
```

## 빌드·미리보기

```bash
node build.mjs          # dist/ 생성 (데이터가 잘못되면 이유를 출력하고 멈춤)
```

`dist/index.html` 을 더블클릭하면 바로 볼 수 있습니다. Vercel 은 `vercel.json` 설정대로 같은 명령을 실행하고 `dist/` 를 배포합니다.

## 광고 (Google 애드센스)

Vercel 프로젝트 환경변수로 켭니다. 값이 없으면 광고 관련 코드가 하나도 나가지 않습니다.

| 환경변수 | 값 | 넣으면 |
|---|---|---|
| `ADSENSE_CLIENT` | `ca-pub-` + 16자리 | 모든 페이지에 애드센스 스크립트, `/ads.txt` 생성 (사이트 확인·심사용) |
| `ADSENSE_SLOT_HUB` | 광고 단위 ID(숫자) | 서비스 목록과 실험 일지 사이에 가로 광고 한 칸 |

- 심사 전에는 `ADSENSE_CLIENT` 만 넣고, 승인 뒤 광고 단위를 만들어 `ADSENSE_SLOT_HUB` 를 넣습니다.
- `juganlab.com/ads.txt` 는 하위 도메인(cert. 등) 광고에도 쓰이므로 게시자 ID 가 각 서비스와 같아야 합니다.
- 형식이 틀린 값이면 빌드가 실패합니다(잘못된 ID 로 조용히 배포되지 않도록).
- 환경변수를 바꾼 뒤에는 Vercel 에서 다시 배포해야 반영됩니다.

## 서비스 추가

`data/services.json` 배열 끝에 추가합니다. 순서대로 `EXP-01`, `EXP-02` … 번호가 붙고, 맨 끝 "다음 실험" 카드 번호는 자동으로 밀립니다.

```json
{
  "id": "memo-map",
  "name": "메모 지도",
  "url": "https://map.juganlab.com/",
  "status": "live",
  "since": "2026-11-01",
  "summary": "한두 문장 소개",
  "ping": "https://map.juganlab.com/robots.txt",
  "stats": [{ "label": "등록된 메모", "value": 1200 }]
}
```

| 필드 | 필수 | 설명 |
|---|---|---|
| `id` | O | 영문 소문자·숫자·하이픈. 콘솔에서 `open <id>` 로 쓰인다 |
| `name` | O | 카드 제목 |
| `status` | O | `live`(운영 중) / `beta`(베타) / `building`(준비 중, 링크 없음) |
| `url` | live·beta 일 때 | `https://` 주소 |
| `summary` | O | 카드 설명 |
| `featured` | | `true` 면 넓은 화면에서 두 칸 |
| `since` | | 시작일. 상단 "Since" 계산에 쓰인다 |
| `ping` | | 응답 시간을 잴 주소 (가벼운 파일 권장) |
| `stats` | | 카드 하단 수치. 직접 적는 값이라 가끔 갱신 필요 |

## 실험 일지 추가

`data/log.json` 에 넣습니다. 순서는 상관없고 빌드가 날짜순으로 정렬합니다.

```json
{ "date": "2026-11-02", "service": "memo-map", "kind": "출시", "title": "제목", "body": "두세 문장", "highlight": false }
```

- `service` 는 `services.json` 의 `id` 와 같아야 합니다.
- 일지에 등장하는 서비스가 2개 이상이 되면 서비스별 필터 버튼이 자동으로 생깁니다.
- 처음에는 최근 6개만 보이고 나머지는 "더 보기"로 펼칩니다(스크립트가 없으면 전부 보임).

# 주간실험실 허브 (juganlab.com)

처음 만든 웹·앱·확장 프로그램을 개발일지와 함께 올려 알리는 메이커 마켓이자, 만드는 사람을 위한 도구함입니다.
정적 사이트이며 화면 내용은 `data/` 의 JSON 에서 빌드 때 HTML 로 만들어집니다.

**방향성과 결정 기록은 [docs/DIRECTION.md](docs/DIRECTION.md) 를 먼저 읽으세요.**

## 구조

```
data/services.json      작품 목록 (type·category·영어 소개 포함, 카드·작품 페이지·콘솔 명령)
data/log.json           개발일지. service 가 작품 id 와 같으면 그 작품 페이지에 붙고, post 를 넣으면 개발기 글로 연결
data/checks.json        작품 자동 검사 결과 (CI 가 기록, 손으로 고치지 않음)
data/posts/*.md         개발기 글 → /log/<파일이름>
data/dojang, data/ai    UI·개발 참고 도감, AI 활용 가이드
data/trending*.json     AI 스킬 어워즈 (매일 Actions 가 갱신)
src/index.template.html 홈 틀. <!-- @이름 --> 자리를 빌드가 채운다
src/styles.css, app.js, privacy.html, dojang/
build.mjs               data + src → dist/ (robots.txt·sitemap.xml 포함, 깨진 내부 링크가 있으면 실패)
lib/                    페이지별 렌더링 (projects 작품, en 영어, home, learn, ai, trending, dojang, pages 공통) · checks 검사 판정 · seo · markdown · posts
scripts/                preview.mjs 미리보기, fetch-trending.mjs 트렌딩 수집, check-submission.mjs 작품 검사
test/                   node --test test/checks.test.mjs
.github/workflows/      trending(매일), check-pr(PR 검사), check-main(병합 뒤 전체 검사)
docs/DIRECTION.md       방향성·결정 기록·다음 순서
```

## 빌드·미리보기

```bash
node build.mjs          # dist/ 생성 (데이터가 잘못되면 이유를 출력하고 멈춤)
```

`dist/index.html` 을 더블클릭하면 홈은 바로 볼 수 있습니다. 개발기·소개처럼 `/` 로 시작하는 주소를 쓰는 페이지는 `npm run preview` (http://localhost:4173) 로 확인합니다. Vercel 은 `vercel.json` 설정대로 같은 명령을 실행하고 `dist/` 를 배포합니다.

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
| `type` | | `web`(기본) / `extension`(크롬 확장) / `guide`(도감). 마켓 필터가 된다 |
| `tags` | | 카드 태그, 검색 대상 |
| `statusLabel` | | 상태 글자 직접 지정 (예: 스토어 등록 준비) |
| `features` | | 상세 창 '주요 기능' `[{title, desc}]` |
| `groups` | | 상세 창 묶음 목록 `[{name, items[]}]` |
| `howto` | | 상세 창 '사용 방법' 단계 문자열 배열 |
| `links` | | 상세 창 추가 링크 `[{label, url}]` |
| `stats` | | 카드 하단 수치. 직접 적는 값이라 가끔 갱신 필요 |

## 실험 일지 추가

`data/log.json` 에 넣습니다. 순서는 상관없고 빌드가 날짜순으로 정렬합니다.

```json
{ "date": "2026-11-02", "service": "memo-map", "kind": "출시", "title": "제목", "body": "두세 문장", "highlight": false }
```

- `service` 는 `services.json` 의 `id` 와 같아야 합니다.
- 일지에 등장하는 서비스가 2개 이상이 되면 서비스별 필터 버튼이 자동으로 생깁니다.
- 처음에는 최근 6개만 보이고 나머지는 "더 보기"로 펼칩니다(스크립트가 없으면 전부 보임).

## 개발기 글 추가

`data/posts/<영문-소문자-슬러그>.md` 를 만듭니다. 맨 위 앞머리와 본문으로 이뤄집니다.

```
---
title: 글 제목
description: 검색 결과와 목록에 나갈 한두 문장(160자 이하)
date: 2026-11-10
service: certnote
kind: 기능
related: 보여 줄 이름 | https://cert.juganlab.com/lab
---
본문 (## 소제목, ### 작은 제목, 문단, - 목록, 1. 목록, > 인용, ``` 코드, | 표 |, `코드`, **굵게**, [링크](https://…))
```

- 본문은 공백을 뺀 1,500자 이상이어야 빌드가 통과합니다. 지원하지 않는 문법(HTML, `*` 목록 등)도 빌드를 멈춥니다.
- `related` 는 한 줄 이상, 글 끝 "직접 써 보기" 칸에 나옵니다.
- 홈 실험 일지에서 연결하려면 `data/log.json` 항목에 `"post": "슬러그"` 를 넣습니다.
- 사실은 저장소 기록(커밋·문서)에서 확인한 것만 씁니다.

## 배우기 (/learn)·도감 (/dojang)

- 홈(/)은 내가 만든 서비스 전시(마켓), 배우기(/learn)는 초보 개발자용 입구, 올리기(/submit)는 다른 사람이 프로젝트를 올리는 방법입니다. 도감은 서비스가 아니라 배우기 쪽 콘텐츠라 services.json 에 넣지 않습니다.

- `/dojang` 목차, `/dojang/ui` UI 도감(실제 동작 데모), `/dojang/http|git|regex` 개발 참고 도감.
- 데이터는 `data/dojang/`: `ui-<묶음>.json`(제목·쓸 때/피할 때), `ref-<이름>.json`(참고 도감). 새 참고 도감은 `ref-*.json` 을 추가하면 자동으로 페이지가 생깁니다.
- UI 데모 코드는 `src/dojang/ui-<묶음>.js|css`. `window.JL_DEMOS[id] = { mount(stage), code }` 형태이며 규칙은 `data/dojang/CONTRACT.md` 에 있습니다.

## AI 활용 (/ai)

- 데이터는 `data/ai/guide-<이름>.json`. 참고 도감(`data/dojang/ref-*.json`)과 같은 스키마(`slug`, `title`, `description`, `intro`, `sections[].items[]{term, short, detail?, example?}`)이고, 파일을 추가하면 `/ai/<slug>` 페이지가 자동으로 생깁니다.

## AI 스킬 트렌딩 (/trending)

- `data/trending.json` 을 `scripts/fetch-trending.mjs` 가 갱신합니다(GitHub 검색 API, 토픽: agent-skills·claude-skills·claude-code·mcp-server·ai-agents·prompt-engineering, 기간 내 새로 생성된 저장소를 별 많은 순). 오늘의 목록은 매일, 주간 목록은 일요일(한국 시간)에 새로 만듭니다.
- `.github/workflows/trending.yml` 이 매일 한국 시간 00:10 에 실행해 변경이 있으면 커밋합니다. 로컬 실행: `GITHUB_TOKEN=$(gh auth token) node scripts/fetch-trending.mjs --force`
- 별 수만으로 고른 목록이라 안전성을 보증하지 않습니다(페이지에 안내 문구가 있습니다). 설명이 없거나 수상한 단어가 든 저장소는 걸러냅니다.

## 작품 올리기와 자동 검사 (/submit, /p/<id>, /en)

- `data/services.json` 항목 하나가 작품 하나입니다. `type` 은 `web` / `app` / `extension`, 영어 소개는 `name_en`·`summary_en`(둘이 함께 있어야 `/en` 에 나옵니다).
- 작품마다 `/p/<id>` 페이지가 만들어지고, `data/log.json` 에서 `service` 가 같은 일지가 그 페이지에 붙습니다.
- `lib/checks.mjs` 가 순수 판정(주소 형식·응답·manifest 권한·소스 패턴), `scripts/check-submission.mjs` 가 네트워크 검사를 맡습니다. 시험은 `node --test test/checks.test.mjs`.
- PR: `.github/workflows/check-pr.yml` 이 빌드·시험·검사를 돌립니다(포크 PR 에는 비밀값이 없어 Safe Browsing·VirusTotal 은 건너뜀).
- 병합 후: `.github/workflows/check-main.yml` 이 전체 검사를 하고 `data/checks.json` 에 기록합니다(주소가 바뀌었거나 7일 지난 작품만). 저장소 secret `GSB_API_KEY`(Google Safe Browsing), `VT_API_KEY`(VirusTotal)가 없으면 그 검사는 "건너뜀"으로 기록됩니다.
- 화면에는 "안전함"이 아니라 "자동 검사 통과 날짜"와 검사 항목만 적습니다. 검사는 위험 신호를 거를 뿐 안전을 보장하지 않습니다.

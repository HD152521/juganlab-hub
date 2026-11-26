# RLS 시험 체크리스트

`supabase/schema.sql` 을 **개발용 Supabase 프로젝트(또는 로컬 `supabase start`)** 에 적용한 뒤 전부 확인한다. 운영 프로젝트에서 시험하지 않는다. 이 문서의 쿼리는 아직 한 번도 실행해 보지 않았다. 실행해 보고 어긋나는 곳은 스키마나 이 문서를 고친다.

모든 항목에 대해 **막혀야 하는 것은 오류(권한 없음)이거나 0행**이어야 한다. "막혀야 함"인데 성공하면 CRITICAL 이다.

## 준비: 시험용 사용자와 데이터

SQL 편집기(관리자 권한)에서 한 번 실행한다. 시험이 끝나면 맨 아래 정리 구문을 실행한다.

```sql
-- 사용자 A, B, 운영자 M 과 공개 작품 하나(A 소유), 임시저장 작품 하나(A 소유)
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@test.invalid'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@test.invalid'),
  ('cccccccc-0000-0000-0000-00000000000c', 'm@test.invalid');   -- 가입 트리거가 profiles 를 만든다
insert into public.admins (user_id) values ('cccccccc-0000-0000-0000-00000000000c');

-- 시험 데이터는 관리자 권한으로 직접 넣는다(상태를 공개로 만들기 위해)
insert into public.projects (id, owner_id, type, status, name, summary, url) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'web', 'published', 'A공개', '공개 작품', 'https://example.com/'),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'web', 'draft', 'A임시', '임시 작품', 'https://example.com/draft');
```

### 사용자 흉내 내기 (SQL 편집기)

한 트랜잭션 안에서 역할과 로그인 정보를 바꾼다. `rollback` 하면 흔적이 남지 않는다.

```sql
-- 익명
begin; set local role anon; set local request.jwt.claims = '{"role":"anon"}';
  -- 여기에 시험 쿼리
rollback;

-- 사용자 A (authenticated)
begin; set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}';
  -- 여기에 시험 쿼리
rollback;

-- 사용자 B: sub 를 bbbbbbbb-0000-0000-0000-00000000000b 로, 운영자 M: cccccccc-0000-0000-0000-00000000000c 로 바꾼다
```

HTTP(REST)로도 확인한다. `<PROJECT>`, `<ANON_KEY>`, `<TOKEN_A>`(A 로 로그인해 얻은 access token)는 직접 채운다. **service_role 키는 이 시험에 쓰지 않는다.**

```bash
curl "https://<PROJECT>.supabase.co/rest/v1/projects?select=id,name,status" -H "apikey: <ANON_KEY>"
curl "https://<PROJECT>.supabase.co/rest/v1/projects?select=id,name,status" -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <TOKEN_A>"
```

## 1. 로그인 없이 (anon)

| # | 시험 | 기대 |
|---|---|---|
| 1-1 | `select id, name, status from public.projects;` | **공개 작품 1건만**(A공개). 임시저장은 보이지 않음 |
| 1-2 | `select * from public.projects where status = 'draft';` | 0행 |
| 1-3 | `select review_note from public.project_reviews;` | 권한 없음 오류 |
| 1-4 | `select * from public.reports;` | 권한 없음 오류 |
| 1-5 | `select * from public.admins;` | 권한 없음 오류 |
| 1-6 | `select email from auth.users;` | 권한 없음 오류 (auth 스키마는 API 로 노출되지 않아야 함) |
| 1-7 | `select trusted, suspended_at from public.profiles;` | 권한 없음 오류(열 권한 없음) |
| 1-8 | `select id, display_name from public.profiles;` | 공개 작품이 있는 A 만 보임. B·M 은 안 보임 |
| 1-9 | `insert into public.projects (owner_id, type, name, summary) values ('aaaaaaaa-0000-0000-0000-00000000000a','web','x','x');` | 권한 없음 오류 |
| 1-10 | `update public.projects set name = 'hacked';` | 권한 없음 오류 |
| 1-11 | `delete from public.projects;` | 권한 없음 오류 |
| 1-12 | `select public.finish_check('11111111-0000-0000-0000-000000000002', 'x', 'pass', '{}');` | 권한 없음 오류 |
| 1-13 | `select public.admin_review('11111111-0000-0000-0000-000000000002', true);` | 권한 없음 오류 |
| 1-14 | `select public.submit_project('11111111-0000-0000-0000-000000000002');` | 권한 없음 오류 |
| 1-15 | `insert into public.reports (project_id, reporter_id, reason) values ('11111111-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-00000000000a','spam');` | 권한 없음 오류 |

## 2. 다른 사용자 (B 로 호출, 작품 주인은 A)

| # | 시험 | 기대 |
|---|---|---|
| 2-1 | `select id, status from public.projects;` | A공개 1건만. **A임시는 안 보임** |
| 2-2 | `update public.projects set name = 'hacked' where id = '11111111-0000-0000-0000-000000000001';` | 0행 갱신(`UPDATE 0`). A공개 이름 그대로 |
| 2-3 | `update public.projects set name = 'hacked' where id = '11111111-0000-0000-0000-000000000002';` | 0행 갱신 |
| 2-4 | `delete from public.projects where id = '11111111-0000-0000-0000-000000000001';` | 0행 삭제 |
| 2-5 | `insert into public.projects (owner_id, type, name, summary) values ('aaaaaaaa-0000-0000-0000-00000000000a','web','x','x');` | 정책 위반 오류(남의 이름으로 만들 수 없음) |
| 2-6 | `select * from public.project_reviews;` | 0행 |
| 2-7 | `select * from public.reports;` | 0행(본인 신고만 보임) |
| 2-8 | `update public.profiles set display_name = 'hacked' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';` | 0행 갱신 |
| 2-9 | `select public.submit_project('11111111-0000-0000-0000-000000000002');` | 오류('작품을 찾을 수 없습니다') |
| 2-10 | `insert into public.project_media (project_id, owner_id, storage_path, bytes) values ('11111111-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-00000000000b','bbbbbbbb-0000-0000-0000-00000000000b/11111111-0000-0000-0000-000000000001/x.webp',1000);` | 오류(남의 작품에 이미지 등록 불가) |
| 2-11 | `select public.admin_hide('11111111-0000-0000-0000-000000000001','x');` | 오류('운영자만') |

## 3. 본인(A)이 해도 막혀야 하는 것 (상태·권한 상승)

| # | 시험 | 기대 |
|---|---|---|
| 3-1 | `update public.projects set status = 'published' where id = '11111111-0000-0000-0000-000000000002';` | 권한 없음 오류(status 열 권한 없음) |
| 3-2 | `insert into public.projects (owner_id, type, status, name, summary) values ('aaaaaaaa-0000-0000-0000-00000000000a','web','published','x','x');` | 권한 없음 오류(status 열을 넣을 수 없음) |
| 3-3 | `update public.projects set owner_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where id = '11111111-0000-0000-0000-000000000002';` | 권한 없음 오류 |
| 3-4 | `update public.projects set check_summary = '{"result":"pass"}' where id = '11111111-0000-0000-0000-000000000002';` | 권한 없음 오류 |
| 3-5 | `update public.profiles set trusted = true where id = 'aaaaaaaa-0000-0000-0000-00000000000a';` | 권한 없음 오류 |
| 3-6 | `insert into public.admins (user_id) values ('aaaaaaaa-0000-0000-0000-00000000000a');` | 권한 없음 오류 |
| 3-7 | `select public.finish_check('11111111-0000-0000-0000-000000000002','x','pass','{}');` | 권한 없음 오류 |
| 3-8 | `select public.admin_review('11111111-0000-0000-0000-000000000002', true);` | 오류('운영자만') |
| 3-9 | `insert into public.reports (project_id, reporter_id, reason) values ('11111111-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-00000000000a','spam');` | 오류(본인 작품 신고 불가) |
| 3-10 | `insert into public.project_reviews (project_id, review_note) values ('11111111-0000-0000-0000-000000000002','통과');` | 권한 없음 오류 |

## 4. 주소를 바꾸면 재검사 (상태 되돌림 트리거)

관리자 권한으로 A공개를 만들어 둔 상태에서 A 로 호출한다.

```sql
-- A 로: 공개 작품의 주소를 바꾼다
update public.projects set url = 'https://example.org/changed' where id = '11111111-0000-0000-0000-000000000001';
select status, published_at, check_summary from public.projects where id = '11111111-0000-0000-0000-000000000001';
```

| # | 기대 |
|---|---|
| 4-1 | 위 update 직후 `status = 'checking'`, `published_at` 과 `check_summary` 가 null |
| 4-2 | 익명으로 `select ... where id = A공개` → 0행(공개 목록에서 사라짐) |
| 4-3 | 작품의 `links` 를 바꿔도 4-1 과 같음 |
| 4-4 | `name`·`summary` 만 바꾸면 상태가 유지됨(**알려진 한계**: 글 내용은 재검사 대상이 아님. 신고로 대응) |
| 4-5 | 검사중(`checking`)일 때 A 가 `update ... set name='x'` → 0행 갱신(검사 도중 수정 불가) |
| 4-6 | 관리자 권한으로 `select public.finish_check('<id>', 'badfingerprint', 'pass', '{}')` → 오류('검사 중에 주소가 바뀌었습니다') |
| 4-7 | 올바른 지문(`select url_fingerprint from public.projects where id=...`)과 `pass` 로 호출하면, 신뢰 계정이 아닐 때 `pending_review`, 확장 프로그램도 `pending_review` |
| 4-8 | 신뢰 계정(`trusted=true`)의 웹 작품이 `pass` 면 `published` |
| 4-9 | `fail` 이면 `rejected` |

## 5. 신고 → 즉시 비공개

| # | 시험(사용자 B 로) | 기대 |
|---|---|---|
| 5-1 | `insert into public.reports (project_id, reporter_id, reason, detail) values ('11111111-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-00000000000b','phishing','시험');` | 성공 |
| 5-2 | 관리자 권한으로 A공개의 `status` 확인 | `hidden`. `project_reviews.hidden_reason` 에 '신고 접수: phishing' |
| 5-3 | 익명으로 A공개 조회 | 0행 |
| 5-4 | B 가 같은 작품을 다시 신고 | 오류(공개 작품이 아니므로 정책 위반) |
| 5-5 | A 가 `update ... set name='x'` / `delete` (hidden 상태) | 0행(수정·삭제 불가, 증거 보존) |
| 5-6 | B 로 `select snapshot from public.reports` | 본인 신고만, `snapshot` 에 신고 시점 이름·주소 |
| 5-7 | B 가 신고 11건을 하루 안에 시도(다른 공개 작품 필요) | 11번째에서 오류 |
| 5-8 | 운영자 M 으로 `select public.admin_resolve_report('<신고id>', true, '오탐')` | 신고 `dismissed`, 작품 `checking`(곧바로 공개되지 않음) |
| 5-9 | 일반 사용자가 `admin_resolve_report` 호출 | 오류('운영자만') |

## 6. 이메일·개인정보 비노출

| # | 시험 | 기대 |
|---|---|---|
| 6-1 | 어떤 역할이든 `select * from public.profiles;` 결과의 열 | 이메일 열이 없음. anon 은 `*` 가 권한 오류일 수 있음(열 권한) |
| 6-2 | `curl ".../rest/v1/profiles?select=*" -H "apikey: <ANON_KEY>"` | 오류 또는 허용된 열만 |
| 6-3 | `curl ".../rest/v1/users"` / `.../auth/v1/admin/users` (anon 키) | 접근 불가(401/403/404) |
| 6-4 | `profiles.display_name` 의 기본값 | `maker-xxxxxx`(소셜 계정의 실명이 아님) |

## 7. Storage 버킷 `project-images`

사용자 A 의 토큰으로 호출한다. `<TOKEN_A>`, `<TOKEN_B>` 는 각각 로그인해서 얻는다. 작은 WebP 파일 `ok.webp`, 같은 내용에 이름만 `x.png`, `.svg` 파일 `bad.svg`, 2MB 파일 `big.webp` 를 준비한다.

```bash
# 내 폴더 + 내 작품(임시저장)에 올리기: 성공해야 함
curl -X POST "https://<PROJECT>.supabase.co/storage/v1/object/project-images/aaaaaaaa-0000-0000-0000-00000000000a/11111111-0000-0000-0000-000000000002/ok.webp" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <TOKEN_A>" -H "Content-Type: image/webp" --data-binary @ok.webp
```

| # | 시험 | 기대 |
|---|---|---|
| 7-1 | 위 업로드(A, 내 폴더, 내 작품) | 200 |
| 7-2 | 토큰 없이(anon 키만) 같은 경로에 업로드 | 401/403 |
| 7-3 | B 의 토큰으로 A 의 폴더(`aaaaaaaa-.../...`)에 업로드 | 403(정책 위반) |
| 7-4 | A 가 폴더를 자기 것이 아닌 uid 로 업로드 | 403 |
| 7-5 | A 가 남의 작품 id 폴더(`<A uid>/<B 의 작품 id>/x.webp`) | 403 |
| 7-6 | `bad.svg` 를 `Content-Type: image/svg+xml` 로 | 415/400(허용 형식 아님) |
| 7-7 | `bad.svg` 를 이름 `x.webp`, `Content-Type: image/webp` 로 | **통과할 수 있음(알려진 한계)**. 내용 검사는 운영 점검에서. 응답 `Content-Type` 이 `image/webp` 로 나가는지만 확인 |
| 7-8 | `x.png` (Content-Type image/png) | 400/415 |
| 7-9 | `big.webp`(1MB 초과) | 413 |
| 7-10 | 경로 깊이가 다름(`<uid>/x.webp`, `<uid>/<작품>/a/b.webp`) | 403 |
| 7-11 | B 가 A 폴더의 객체 삭제·덮어쓰기(DELETE, PUT) | 403 |
| 7-12 | anon 이 `POST /storage/v1/object/list/project-images` 로 목록 | 빈 목록 또는 403(폴더 열거 불가) |
| 7-13 | 검사중(`checking`)·비공개(`hidden`) 작품 폴더에 A 가 업로드 | 403 |

## 8. 정리

```sql
delete from public.projects where id in ('11111111-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000002');
delete from public.reports where reporter_id = 'bbbbbbbb-0000-0000-0000-00000000000b';
delete from auth.users where id in ('aaaaaaaa-0000-0000-0000-00000000000a','bbbbbbbb-0000-0000-0000-00000000000b','cccccccc-0000-0000-0000-00000000000c');
-- Storage 에 올린 시험 파일은 대시보드 또는 Storage API 로 지운다(SQL 로 지우면 실제 파일이 남을 수 있다)
```

## 시험을 자동으로 돌리려면 (선택)

수동 확인이 번거로워지면 위 표를 `pgTAP` 시험(`supabase test db`)으로 옮긴다. 이번 범위에서는 만들지 않는다.

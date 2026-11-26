-- 주간실험실 Supabase 스키마 초안 (Free 플랜 기준)
--
-- 상태: 초안. 아직 어떤 Supabase 프로젝트에도 적용하지 않았고, 실행해 본 적도 없다.
--       적용 전에 개발용 프로젝트에서 supabase/RLS-TESTS.md 를 전부 통과시킨다.
-- 원칙(docs/SECURITY.md 와 같음):
--   - 사용자가 올리는 것은 텍스트·링크·이미지(WebP)뿐. 설치파일은 받지 않는다.
--   - 모든 표에 RLS 를 켜고, 기본 권한을 걷은 뒤 필요한 열만 열어 준다.
--   - 사용자는 상태를 '공개'로 바꿀 수 없다. 상태 변경은 아래 함수(검사 서비스·운영자)만 한다.
--   - 이메일 등 개인정보는 auth.users 에만 있고, public 표에는 복사하지 않는다.
--   - 비밀 키(service_role)는 서버(CI·Edge Function)에서만 쓴다. 프런트에는 anon 키만.

-- ============================================================
-- 0. 상수 성격의 설정
-- ============================================================
-- 아래 숫자는 함수 안에 박혀 있다. 바꿀 때는 이 목록과 docs/SECURITY.md 를 같이 고친다.
--   사용자당 작품 수 최대 10, 작품당 이미지 최대 8장, 이미지 1장 최대 1MB(버킷 설정),
--   사용자당 신고 하루 최대 10건, 신고 1건이면 즉시 비공개(report_hide_threshold)

-- ============================================================
-- 1. 열거형
-- ============================================================
create type public.project_type as enum ('web', 'app', 'extension');

-- draft(임시저장) -> checking(검사중) -> pending_review(승인대기) -> published(공개) / rejected(반려)
-- hidden: 신고 또는 운영자가 즉시 비공개한 상태(검토 중)
create type public.project_status as enum ('draft', 'checking', 'pending_review', 'published', 'rejected', 'hidden');

create type public.report_reason as enum ('malware', 'phishing', 'impersonation', 'copyright', 'spam', 'inappropriate', 'other');
create type public.report_status as enum ('open', 'resolved', 'dismissed');

-- ============================================================
-- 2. 표
-- ============================================================

-- 운영자 명단. API 로는 아무도 읽거나 쓸 수 없다(정책 없음). is_admin() 함수만 읽는다.
-- 운영자 추가는 SQL 편집기에서 직접: insert into public.admins (user_id) values ('...');
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 공개 프로필. 이메일·실명·프로필 사진 주소는 두지 않는다(소셜 로그인의 이름이 그대로 노출되는 것을 막기 위해).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30 and display_name !~ '[[:cntrl:]<>]'),
  bio text check (bio is null or char_length(bio) <= 200),
  trusted boolean not null default false,   -- 첫 작품이 운영자 승인을 받으면 true (함수로만 바뀐다)
  suspended_at timestamptz,                  -- 값이 있으면 정지: 작품·신고를 새로 쓸 수 없다
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  type public.project_type not null,
  status public.project_status not null default 'draft',
  name text not null check (char_length(name) between 1 and 60),
  summary text not null check (char_length(summary) between 1 and 200),
  description text check (description is null or char_length(description) <= 4000),
  category text check (category is null or char_length(category) <= 30),
  -- 작품 주소: https 만, 계정 정보(@)·공백 금지, 길이 제한. 허용 도메인 규칙은 docs/SECURITY.md (앱·CI 에서 검사)
  url text check (url is null or (url ~ '^https://[^\s/@?#]+([/?#][^\s]*)?$' and char_length(url) <= 500)),
  -- 추가 링크: [{ "label": "...", "url": "https://..." }] 최대 8개
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 8),
  tags text[] not null default '{}' check (cardinality(tags) <= 8 and char_length(array_to_string(tags, ',')) <= 200),
  name_en text check (name_en is null or char_length(name_en) <= 60),
  summary_en text check (summary_en is null or char_length(summary_en) <= 200),
  -- 사용법 단계: [{ "text": "...", "image": "<project_media 경로>" }] 최대 10개, 글 300자
  howto jsonb not null default '[]'::jsonb check (jsonb_typeof(howto) = 'array' and jsonb_array_length(howto) <= 10),
  -- 종류·분야별 추가 입력(data/schema/submission.json 이 정의). 키 이름·값 검증은 앱과 검사 서비스가 하고, DB 는 모양과 크기만 제한한다.
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 4096),
  -- 검사 대상이 바뀌었는지 비교하는 지문(주소+링크). 검사 서비스가 "내가 검사한 것"과 "지금 것"이 같은지 확인한다.
  url_fingerprint text generated always as (md5(coalesce(url, '') || '|' || links::text || '|' || coalesce(details->>'source_url', '') || '|' || coalesce(details->>'privacy_url', '') || '|' || coalesce(details->>'demo_video_url', ''))) stored,
  -- 화면에 보여 줄 검사 요약({result, date, items}). 검사 서비스 함수만 쓴다. 운영자 메모는 여기에 넣지 않는다.
  check_summary jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_idx on public.projects (owner_id);
create index projects_public_idx on public.projects (published_at desc) where status = 'published';
create index projects_review_idx on public.projects (status) where status in ('pending_review', 'hidden');

-- 운영자·본인만 보는 정보(반려 사유, 비공개 사유, 검사 상세). 공개 열과 분리해 열 노출 실수를 막는다.
create table public.project_reviews (
  project_id uuid primary key references public.projects (id) on delete cascade,
  check_detail jsonb,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  hidden_reason text check (hidden_reason is null or char_length(hidden_reason) <= 300),
  reviewer_id uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.project_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'screenshot' check (kind in ('cover', 'screenshot')),
  -- 버킷 안 경로: <owner_id>/<project_id>/<파일명>.webp  (Storage 정책이 첫 폴더를 본인 id 로 강제)
  storage_path text not null
    check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.webp$'
           and storage_path like owner_id::text || '/' || project_id::text || '/%'),
  alt text check (alt is null or char_length(alt) <= 200),
  bytes integer not null check (bytes between 1 and 1048576),
  width integer check (width between 1 and 4096),
  height integer check (height between 1 and 4096),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (storage_path)
);
create index project_media_project_idx on public.project_media (project_id, sort);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete set null,  -- 작품이 지워져도 신고 기록은 남긴다
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason public.report_reason not null,
  detail text check (detail is null or char_length(detail) <= 1000),
  status public.report_status not null default 'open',
  snapshot jsonb,                              -- 신고 시점의 작품 이름·주소·링크(증거 보존). 트리거가 채운다
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  created_at timestamptz not null default now()
);
-- 같은 사람이 같은 작품을 열린 상태로 중복 신고하지 못하게 한다
create unique index reports_one_open_per_reporter on public.reports (project_id, reporter_id) where status = 'open';
create index reports_open_idx on public.reports (created_at) where status = 'open';

-- ============================================================
-- 3. 도우미 함수
-- ============================================================
-- 모든 함수는 search_path 를 비워(스키마 이름을 명시) 가짜 객체 끼워 넣기를 막는다.

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = (select auth.uid())) $$;

create function public.is_active_user() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and suspended_at is null) $$;

-- 사용자(anon·authenticated) 가 직접 건드리는 경우만 true. 아래 definer 함수 안에서는 소유자 권한이라 false.
create function public.is_api_user() returns boolean
language sql stable set search_path = ''
as $$ select current_user in ('anon', 'authenticated') $$;

-- 소셜 로그인 가입 시 프로필을 만든다. 이름은 소셜 계정의 실명 대신 임의 이름으로 시작한다(사용자가 바꿈).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, 'maker-' || substr(replace(new.id::text, '-', ''), 1, 6));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 4. 트리거: 상태 머신과 주소 변경 시 재검사
-- ============================================================

create function public.projects_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if public.is_api_user() then
      -- 사용자가 만들 때는 항상 임시저장. 상태·검사 결과를 끼워 넣지 못한다.
      new.status := 'draft';
      new.published_at := null;
      new.check_summary := null;
      if (select count(*) from public.projects where owner_id = new.owner_id) >= 10 then
        raise exception '작품은 계정당 최대 10개까지 만들 수 있습니다';
      end if;
    end if;
    return new;
  end if;

  if public.is_api_user() then
    -- 상태·소유자·공개 시각·검사 결과는 사용자가 직접 바꿀 수 없다(열 권한에서도 막지만 한 번 더).
    if new.status is distinct from old.status then raise exception '상태는 직접 바꿀 수 없습니다'; end if;
    if new.owner_id is distinct from old.owner_id then raise exception '소유자는 바꿀 수 없습니다'; end if;
    new.published_at := old.published_at;
    new.check_summary := old.check_summary;

    -- 주소·링크를 바꾸면 재검사가 끝날 때까지 비공개(바꿔치기 방지). 공개·승인대기였던 작품만 해당.
    -- details 안의 소스·처방침·영상 주소도 같은 취급(생성 열 url_fingerprint 와 같은 대상).
    if (new.url is distinct from old.url or new.links is distinct from old.links
        or new.details->>'source_url' is distinct from old.details->>'source_url'
        or new.details->>'privacy_url' is distinct from old.details->>'privacy_url'
        or new.details->>'demo_video_url' is distinct from old.details->>'demo_video_url')
       and old.status in ('pending_review', 'published') then
      new.status := 'checking';
      new.check_summary := null;
      new.published_at := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

create trigger projects_guard_trg before insert or update on public.projects
  for each row execute function public.projects_guard();

-- 이미지: 작품당 8장, 작품 주인과 일치해야 한다
create function public.project_media_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from public.projects where id = new.project_id and owner_id = new.owner_id) then
    raise exception '작품 주인의 이미지만 등록할 수 있습니다';
  end if;
  if (select count(*) from public.project_media where project_id = new.project_id) >= 8 then
    raise exception '이미지는 작품당 최대 8장입니다';
  end if;
  return new;
end $$;

create trigger project_media_guard_trg before insert on public.project_media
  for each row execute function public.project_media_guard();

-- 신고: 본인 작품 신고 금지, 하루 10건 제한, 증거(snapshot) 보존
create function public.reports_before_insert() returns trigger
language plpgsql set search_path = ''
as $$
declare p public.projects;
begin
  select * into p from public.projects where id = new.project_id;
  if p.id is null then raise exception '신고할 작품을 찾을 수 없습니다'; end if;
  if p.owner_id = new.reporter_id then raise exception '본인 작품은 신고할 수 없습니다'; end if;
  if (select count(*) from public.reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 10 then
    raise exception '신고는 하루 10건까지 가능합니다';
  end if;
  new.status := 'open';
  new.resolved_by := null; new.resolved_at := null; new.resolution_note := null;
  new.snapshot := jsonb_build_object('name', p.name, 'url', p.url, 'links', p.links, 'source_url', p.details->>'source_url', 'owner_id', p.owner_id, 'reported_at', now());
  return new;
end $$;

create trigger reports_before_insert_trg before insert on public.reports
  for each row execute function public.reports_before_insert();

-- 신고가 들어오면 즉시 비공개. 신고 1건이면 비공개(report_hide_threshold). 허위 신고 남용은 가입 필요·일 10건 제한·운영자 복구로 막는다.
create function public.reports_after_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare report_hide_threshold constant integer := 1;
begin
  if (select count(*) from public.reports where project_id = new.project_id and status = 'open') >= report_hide_threshold then
    update public.projects set status = 'hidden' where id = new.project_id and status = 'published';
    if found then
      insert into public.project_reviews (project_id, hidden_reason) values (new.project_id, '신고 접수: ' || new.reason::text)
      on conflict (project_id) do update set hidden_reason = excluded.hidden_reason, updated_at = now();
    end if;
  end if;
  return new;
end $$;

create trigger reports_after_insert_trg after insert on public.reports
  for each row execute function public.reports_after_insert();

-- ============================================================
-- 5. 상태 전환 함수 (사용자는 submit_project 만, 나머지는 검사 서비스·운영자)
-- ============================================================

-- 본인 임시저장·반려 작품을 검사 요청(검사중)으로. 필수 항목이 비면 거부.
create function public.submit_project(p_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare p public.projects;
begin
  select * into p from public.projects where id = p_id and owner_id = (select auth.uid());
  if p.id is null then raise exception '작품을 찾을 수 없습니다'; end if;
  if not public.is_active_user() then raise exception '정지된 계정입니다'; end if;
  if p.status not in ('draft', 'rejected') then raise exception '임시저장·반려 상태에서만 제출할 수 있습니다'; end if;
  -- 확장 프로그램은 스토어 등록 전일 수 있어 주소가 없어도 되지만, 소스 저장소는 필수.
  if p.url is null and p.type <> 'extension' then raise exception '작품 주소가 필요합니다'; end if;
  if p.type = 'extension'
     and coalesce(p.details->>'source_url', '') !~ '^https://github\.com/[^/]+/[^/]+/?    raise exception '확장 프로그램은 소스가 있는 GitHub 저장소 주소가 필요합니다';
  end if;
  update public.projects set status = 'checking', check_summary = null where id = p_id;
end $$;

-- 검사 서비스(service_role)만. p_fingerprint 는 검사를 시작할 때의 url_fingerprint.
-- 검사 중에 주소가 바뀌었으면 결과를 버린다(바꿔치기 방지).
-- 통과 + 신뢰 계정 + 확장 프로그램 아님 => 바로 공개. 그 밖의 통과·경고 => 승인대기. 실패 => 반려.
create function public.finish_check(p_id uuid, p_fingerprint text, p_result text, p_summary jsonb, p_detail jsonb default null)
returns public.project_status
language plpgsql security definer set search_path = ''
as $$
declare
  p public.projects;
  owner_trusted boolean;
  next_status public.project_status;
begin
  if p_result not in ('pass', 'warn', 'fail') then raise exception 'result 는 pass/warn/fail'; end if;
  select * into p from public.projects where id = p_id for update;
  if p.id is null or p.status <> 'checking' then raise exception '검사중인 작품이 아닙니다'; end if;
  if p.url_fingerprint is distinct from p_fingerprint then raise exception '검사 중에 주소가 바뀌었습니다. 다시 검사해야 합니다'; end if;

  select trusted into owner_trusted from public.profiles where id = p.owner_id;
  next_status := case
    when p_result = 'fail' then 'rejected'::public.project_status
    when p_result = 'pass' and owner_trusted and p.type <> 'extension' then 'published'::public.project_status
    else 'pending_review'::public.project_status
  end;

  update public.projects
     set status = next_status, check_summary = p_summary,
         published_at = case when next_status = 'published' then coalesce(published_at, now()) else null end
   where id = p_id;
  insert into public.project_reviews (project_id, check_detail) values (p_id, p_detail)
  on conflict (project_id) do update set check_detail = excluded.check_detail, updated_at = now();
  return next_status;
end $$;

-- 운영자: 승인대기 작품을 승인(공개) 또는 반려. 첫 승인이면 그 계정을 신뢰 계정으로.
create function public.admin_review(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare p public.projects;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있습니다'; end if;
  select * into p from public.projects where id = p_id for update;
  if p.id is null or p.status <> 'pending_review' then raise exception '승인대기 작품이 아닙니다'; end if;
  if p_approve then
    update public.projects set status = 'published', published_at = coalesce(published_at, now()) where id = p_id;
    update public.profiles set trusted = true where id = p.owner_id;
  else
    update public.projects set status = 'rejected', published_at = null where id = p_id;
  end if;
  insert into public.project_reviews (project_id, review_note, reviewer_id) values (p_id, p_note, (select auth.uid()))
  on conflict (project_id) do update set review_note = excluded.review_note, reviewer_id = excluded.reviewer_id, updated_at = now();
end $$;

-- 운영자: 어떤 상태의 작품이든 즉시 비공개(악성 의심 등)
create function public.admin_hide(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있습니다'; end if;
  update public.projects set status = 'hidden', published_at = null where id = p_id;
  insert into public.project_reviews (project_id, hidden_reason, reviewer_id) values (p_id, p_reason, (select auth.uid()))
  on conflict (project_id) do update set hidden_reason = excluded.hidden_reason, reviewer_id = excluded.reviewer_id, updated_at = now();
end $$;

-- 운영자: 비공개 작품을 신고와 무관하게 되살린다(다시 검사부터)
create function public.admin_restore(p_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있습니다'; end if;
  if exists (select 1 from public.reports where project_id = p_id and status = 'open') then raise exception '열린 신고가 있어 먼저 신고를 처리해야 합니다'; end if;
  update public.projects set status = 'checking', published_at = null where id = p_id and status = 'hidden';
end $$;

-- 운영자: 신고 처리. p_restore=true 면 비공개를 풀어 다시 검사(checking)로 보낸다(주소가 그사이 바뀌었을 수 있으므로 곧바로 공개하지 않는다).
-- p_restore=false 면 반려. 열린 신고가 남아 있으면 상태를 바꾸지 않는다.
create function public.admin_resolve_report(p_report_id uuid, p_restore boolean, p_note text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare r public.reports;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있습니다'; end if;
  select * into r from public.reports where id = p_report_id for update;
  if r.id is null or r.status <> 'open' then raise exception '열린 신고가 아닙니다'; end if;
  update public.reports
     set status = case when p_restore then 'dismissed'::public.report_status else 'resolved'::public.report_status end,
         resolved_by = (select auth.uid()), resolved_at = now(), resolution_note = p_note
   where id = p_report_id;
  if r.project_id is not null
     and not exists (select 1 from public.reports where project_id = r.project_id and status = 'open') then
    update public.projects
       set status = case when p_restore then 'checking'::public.project_status else 'rejected'::public.project_status end, published_at = null
     where id = r.project_id and status = 'hidden';
  end if;
end $$;

-- ============================================================
-- 6. 권한: 기본 권한을 모두 걷고 필요한 것만 연다
-- ============================================================
-- Supabase 는 public 표에 anon·authenticated 권한을 기본으로 준다. RLS 가 마지막 방어선이 되도록
-- 열 단위로 다시 연다. (service_role 은 RLS 를 우회하므로 서버에서만 쓴다.)
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- 익명(anon): 공개 작품과 그 작성자·이미지의 공개 열만 읽는다
grant select (id, display_name, bio, created_at) on public.profiles to anon, authenticated;
grant select (id, owner_id, type, status, name, summary, description, category, url, links, tags, name_en, summary_en, howto, details, url_fingerprint, check_summary, published_at, created_at, updated_at)
  on public.projects to anon, authenticated;
grant select (id, project_id, owner_id, kind, storage_path, alt, width, height, sort) on public.project_media to anon, authenticated;

-- 로그인 사용자: 쓸 수 있는 열만 연다. 상태·소유자·검사 결과·신뢰 여부·정지 여부 열은 없다.
grant update (display_name, bio) on public.profiles to authenticated;
grant insert (owner_id, type, name, summary, description, category, url, links, tags, name_en, summary_en, howto, details) on public.projects to authenticated;
grant update (type, name, summary, description, category, url, links, tags, name_en, summary_en, howto, details) on public.projects to authenticated;
grant delete on public.projects to authenticated;
grant insert (project_id, owner_id, kind, storage_path, alt, bytes, width, height, sort) on public.project_media to authenticated;
grant update (kind, alt, sort) on public.project_media to authenticated;
grant delete on public.project_media to authenticated;
grant select on public.project_reviews to authenticated;                  -- 정책이 본인 작품만 허용
grant select on public.reports to authenticated;                          -- 정책이 본인 신고만 허용
grant insert (project_id, reporter_id, reason, detail) on public.reports to authenticated;

-- 함수: 사용자는 submit_project 만. 검사 서비스 함수는 service_role 만.
grant execute on function public.submit_project(uuid) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;       -- 익명 조회 정책에서도 호출되므로 anon 도 필요(항상 false)
grant execute on function public.admin_restore(uuid) to authenticated;
grant execute on function public.admin_review(uuid, boolean, text) to authenticated;       -- 함수 안에서 is_admin() 재확인
grant execute on function public.admin_hide(uuid, text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, boolean, text) to authenticated;
grant execute on function public.finish_check(uuid, text, text, jsonb, jsonb) to service_role;
-- RLS 정책 안에서 호출되는 도우미는 호출자 권한으로 실행되므로 실행 권한이 필요하다
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_api_user() to anon, authenticated;

-- ============================================================
-- 7. RLS 켜기와 정책
-- ============================================================
alter table public.admins enable row level security;           -- 정책 없음 = API 로 접근 불가
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_reviews enable row level security;
alter table public.project_media enable row level security;
alter table public.reports enable row level security;

-- profiles: 본인, 공개 작품이 있는 사람, 운영자만 조회. 수정은 본인만(열 권한이 display_name, bio 로 제한).
create policy profiles_select on public.profiles for select
  using (
    id = (select auth.uid())
    or public.is_admin()
    or exists (select 1 from public.projects p where p.owner_id = profiles.id and p.status = 'published')
  );
create policy profiles_update_own on public.profiles for update
  using (id = (select auth.uid()) and public.is_active_user())
  with check (id = (select auth.uid()));

-- projects
create policy projects_select_public on public.projects for select to anon, authenticated
  using (status = 'published');
create policy projects_select_own on public.projects for select to authenticated
  using (owner_id = (select auth.uid()));
create policy projects_select_admin on public.projects for select to authenticated
  using (public.is_admin());
create policy projects_insert_own on public.projects for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_active_user());
-- 검사중·비공개(hidden) 작품은 본인도 수정 못 한다(검사 도중 바꿔치기 방지, 신고 증거 보존)
create policy projects_update_own on public.projects for update to authenticated
  using (owner_id = (select auth.uid()) and status not in ('checking', 'hidden') and public.is_active_user())
  with check (owner_id = (select auth.uid()));
create policy projects_delete_own on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()) and status <> 'hidden');

-- project_reviews: 본인 작품의 반려 사유 등은 본인이, 전체는 운영자가 읽는다. 쓰기 정책 없음(함수만).
create policy project_reviews_select on public.project_reviews for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.projects p where p.id = project_reviews.project_id and p.owner_id = (select auth.uid()))
  );

-- project_media: 공개 작품의 이미지는 누구나, 그 밖에는 본인·운영자. 쓰기는 본인(검사중·비공개 제외).
create policy project_media_select on public.project_media for select to anon, authenticated
  using (
    exists (select 1 from public.projects p where p.id = project_media.project_id and p.status = 'published')
    or owner_id = (select auth.uid())
    or public.is_admin()
  );
create policy project_media_insert_own on public.project_media for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()) and p.status not in ('checking', 'hidden'))
  );
create policy project_media_update_own on public.project_media for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy project_media_delete_own on public.project_media for delete to authenticated
  using (owner_id = (select auth.uid()));

-- reports: 로그인한 사용자가 공개 작품만 신고. 읽기는 본인 신고와 운영자. 수정·삭제는 함수(운영자)만.
create policy reports_insert_own on public.reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and public.is_active_user()
    and exists (select 1 from public.projects p where p.id = project_id and p.status = 'published')
  );
create policy reports_select_own on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());

-- ============================================================
-- 8. Storage: 작품 이미지 버킷
-- ============================================================
-- 이미지(WebP)만, 1MB 이하. 이 두 제한은 버킷 설정이라 정책보다 먼저 걸린다.
-- 주의: allowed_mime_types 는 요청이 선언한 형식을 본다. 파일 내용(RIFF....WEBP)까지 보장하지는 않으므로
--       운영 점검(docs/SECURITY.md '이미지')에서 정기적으로 매직바이트를 확인한다. SVG 는 허용 형식에 없다.
-- 주의: public=true 는 주소를 아는 사람이 누구나 읽는다(경로가 추측 불가능한 uuid). 비공개로 돌린 작품의
--       이미지 파일은 Storage API 로 지울 때까지 주소로 접근된다. 비공개 버킷+서명 주소 방식은 docs/SECURITY.md '결정 필요' 참고.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-images', 'project-images', true, 1048576, array['image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 올리기: 경로가 <내 uid>/<내 작품 id>/<파일>.webp 일 때만, 검사중·비공개가 아닌 내 작품에만
create policy "project-images insert own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(name) like '%.webp'
    and array_length(storage.foldername(name), 1) = 2
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2] and p.owner_id = (select auth.uid()) and p.status not in ('checking', 'hidden')
    )
  );
-- 목록·조회(API 경유): 본인 폴더와 운영자만. 공개 버킷의 주소 직접 접근은 이 정책과 무관하게 열려 있다.
create policy "project-images select own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'project-images' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
create policy "project-images update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'project-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'project-images' and (storage.foldername(name))[1] = (select auth.uid())::text and lower(name) like '%.webp');
create policy "project-images delete own folder or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'project-images' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

     and not exists (select 1 from jsonb_array_elements(p.links) l where l ->> 'url' ~ '^https://github\.com/[^/]+/[^/]+/?    raise exception '확장 프로그램은 소스가 있는 GitHub 저장소 주소가 필요합니다';
  end if;
  update public.projects set status = 'checking', check_summary = null where id = p_id;
end $$;

-- 검사 서비스(service_role)만. p_fingerprint 는 검사를 시작할 때의 url_fingerprint.
-- 검사 중에 주소가 바뀌었으면 결과를 버린다(바꿔치기 방지).
-- 통과 + 신뢰 계정 + 확장 프로그램 아님 => 바로 공개. 그 밖의 통과·경고 => 승인대기. 실패 => 반려.
create function public.finish_check(p_id uuid, p_fingerprint text, p_result text, p_summary jsonb, p_detail jsonb default null)
returns public.project_status
language plpgsql security definer set search_path = ''
as $$
declare
  p public.projects;
  owner_trusted boolean;
  next_status public.project_status;
begin
  if p_result not in ('pass', 'warn', 'fail') then raise exception 'result 는 pass/warn/fail'; end if;
  select * into p from public.projects where id = p_id for update;
  if p.id is null or p.status <> 'checking' then raise exception '검사중인 작품이 아닙니다'; end if;
  if p.url_fingerprint is distinct from p_fingerprint then raise exception '검사 중에 주소가 바뀌었습니다. 다시 검사해야 합니다'; end if;

  select trusted into owner_trusted from public.profiles where id = p.owner_id;
  next_status := case
    when p_result = 'fail' then 'rejected'::public.project_status
    when p_result = 'pass' and owner_trusted and p.type <> 'extension' then 'published'::public.project_status
    else 'pending_review'::public.project_status
  end;

  update public.projects
     set status = next_status, check_summary = p_summary,
         published_at = case when next_status = 'published' then coalesce(published_at, now()) else null end
   where id = p_id;
  insert into public.project_reviews (project_id, check_detail) values (p_id, p_detail)
  on conflict (project_id) do update set check_detail = excluded.check_detail, updated_at = now();
  return next_status;
end $$;

-- 운영자: 승인대기 작품을 승인(공개) 또는 반려. 첫 승인이면 그 계정을 신뢰 계정으로.
create function public.admin_review(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare p public.projects;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있습니다'; end if;
  select * into p from public.projects where id = p_id for update;
  if p.id is null or p.status <> 'pending_review' then raise exception '승인대기 작품이 아닙니다'; end if;
  if p_approve then
    update public.projects set status = 'published', published_at = coalesce(published_at, now()) where id = p_id;
    update public.profiles set trusted = true where id = p.owner_id;
  else
    update public.projects set status = 'rejected', published_at = null where id = p_id;
  end if;
  insert into public.project_reviews (project_id, review_note, reviewer_id) values (p_id, p_note, (select auth.uid()))
  on conflict (project_id) do update set review_note = excluded.review_note, reviewer_id = excluded.reviewer_id, updated_at = now();
end $$;

-- 운영자: 어떤 상태의 작품이든 즉시 비공개(악성 의심 등)
create function public.admin_hide(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있습니다'; end if;
  update public.projects set status = 'hidden', published_at = null where id = p_id;
  insert into public.project_reviews (project_id, hidden_reason, reviewer_id) values (p_id, p_reason, (select auth.uid()))
  on conflict (project_id) do update set hidden_reason = excluded.hidden_reason, reviewer_id = excluded.reviewer_id, updated_at = now();
end $$;

-- 운영자: 비공개 작품을 신고와 무관하게 되살린다(다시 검사부터)
create function public.admin_restore(p_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있습니다'; end if;
  if exists (select 1 from public.reports where project_id = p_id and status = 'open') then raise exception '열린 신고가 있어 먼저 신고를 처리해야 합니다'; end if;
  update public.projects set status = 'checking', published_at = null where id = p_id and status = 'hidden';
end $$;

-- 운영자: 신고 처리. p_restore=true 면 비공개를 풀어 다시 검사(checking)로 보낸다(주소가 그사이 바뀌었을 수 있으므로 곧바로 공개하지 않는다).
-- p_restore=false 면 반려. 열린 신고가 남아 있으면 상태를 바꾸지 않는다.
create function public.admin_resolve_report(p_report_id uuid, p_restore boolean, p_note text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare r public.reports;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있습니다'; end if;
  select * into r from public.reports where id = p_report_id for update;
  if r.id is null or r.status <> 'open' then raise exception '열린 신고가 아닙니다'; end if;
  update public.reports
     set status = case when p_restore then 'dismissed'::public.report_status else 'resolved'::public.report_status end,
         resolved_by = (select auth.uid()), resolved_at = now(), resolution_note = p_note
   where id = p_report_id;
  if r.project_id is not null
     and not exists (select 1 from public.reports where project_id = r.project_id and status = 'open') then
    update public.projects
       set status = case when p_restore then 'checking'::public.project_status else 'rejected'::public.project_status end, published_at = null
     where id = r.project_id and status = 'hidden';
  end if;
end $$;

-- ============================================================
-- 6. 권한: 기본 권한을 모두 걷고 필요한 것만 연다
-- ============================================================
-- Supabase 는 public 표에 anon·authenticated 권한을 기본으로 준다. RLS 가 마지막 방어선이 되도록
-- 열 단위로 다시 연다. (service_role 은 RLS 를 우회하므로 서버에서만 쓴다.)
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- 익명(anon): 공개 작품과 그 작성자·이미지의 공개 열만 읽는다
grant select (id, display_name, bio, created_at) on public.profiles to anon, authenticated;
grant select (id, owner_id, type, status, name, summary, description, category, url, links, tags, name_en, summary_en, howto, details, url_fingerprint, check_summary, published_at, created_at, updated_at)
  on public.projects to anon, authenticated;
grant select (id, project_id, owner_id, kind, storage_path, alt, width, height, sort) on public.project_media to anon, authenticated;

-- 로그인 사용자: 쓸 수 있는 열만 연다. 상태·소유자·검사 결과·신뢰 여부·정지 여부 열은 없다.
grant update (display_name, bio) on public.profiles to authenticated;
grant insert (owner_id, type, name, summary, description, category, url, links, tags, name_en, summary_en, howto, details) on public.projects to authenticated;
grant update (type, name, summary, description, category, url, links, tags, name_en, summary_en, howto, details) on public.projects to authenticated;
grant delete on public.projects to authenticated;
grant insert (project_id, owner_id, kind, storage_path, alt, bytes, width, height, sort) on public.project_media to authenticated;
grant update (kind, alt, sort) on public.project_media to authenticated;
grant delete on public.project_media to authenticated;
grant select on public.project_reviews to authenticated;                  -- 정책이 본인 작품만 허용
grant select on public.reports to authenticated;                          -- 정책이 본인 신고만 허용
grant insert (project_id, reporter_id, reason, detail) on public.reports to authenticated;

-- 함수: 사용자는 submit_project 만. 검사 서비스 함수는 service_role 만.
grant execute on function public.submit_project(uuid) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;       -- 익명 조회 정책에서도 호출되므로 anon 도 필요(항상 false)
grant execute on function public.admin_restore(uuid) to authenticated;
grant execute on function public.admin_review(uuid, boolean, text) to authenticated;       -- 함수 안에서 is_admin() 재확인
grant execute on function public.admin_hide(uuid, text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, boolean, text) to authenticated;
grant execute on function public.finish_check(uuid, text, text, jsonb, jsonb) to service_role;
-- RLS 정책 안에서 호출되는 도우미는 호출자 권한으로 실행되므로 실행 권한이 필요하다
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_api_user() to anon, authenticated;

-- ============================================================
-- 7. RLS 켜기와 정책
-- ============================================================
alter table public.admins enable row level security;           -- 정책 없음 = API 로 접근 불가
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_reviews enable row level security;
alter table public.project_media enable row level security;
alter table public.reports enable row level security;

-- profiles: 본인, 공개 작품이 있는 사람, 운영자만 조회. 수정은 본인만(열 권한이 display_name, bio 로 제한).
create policy profiles_select on public.profiles for select
  using (
    id = (select auth.uid())
    or public.is_admin()
    or exists (select 1 from public.projects p where p.owner_id = profiles.id and p.status = 'published')
  );
create policy profiles_update_own on public.profiles for update
  using (id = (select auth.uid()) and public.is_active_user())
  with check (id = (select auth.uid()));

-- projects
create policy projects_select_public on public.projects for select to anon, authenticated
  using (status = 'published');
create policy projects_select_own on public.projects for select to authenticated
  using (owner_id = (select auth.uid()));
create policy projects_select_admin on public.projects for select to authenticated
  using (public.is_admin());
create policy projects_insert_own on public.projects for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_active_user());
-- 검사중·비공개(hidden) 작품은 본인도 수정 못 한다(검사 도중 바꿔치기 방지, 신고 증거 보존)
create policy projects_update_own on public.projects for update to authenticated
  using (owner_id = (select auth.uid()) and status not in ('checking', 'hidden') and public.is_active_user())
  with check (owner_id = (select auth.uid()));
create policy projects_delete_own on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()) and status <> 'hidden');

-- project_reviews: 본인 작품의 반려 사유 등은 본인이, 전체는 운영자가 읽는다. 쓰기 정책 없음(함수만).
create policy project_reviews_select on public.project_reviews for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.projects p where p.id = project_reviews.project_id and p.owner_id = (select auth.uid()))
  );

-- project_media: 공개 작품의 이미지는 누구나, 그 밖에는 본인·운영자. 쓰기는 본인(검사중·비공개 제외).
create policy project_media_select on public.project_media for select to anon, authenticated
  using (
    exists (select 1 from public.projects p where p.id = project_media.project_id and p.status = 'published')
    or owner_id = (select auth.uid())
    or public.is_admin()
  );
create policy project_media_insert_own on public.project_media for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()) and p.status not in ('checking', 'hidden'))
  );
create policy project_media_update_own on public.project_media for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy project_media_delete_own on public.project_media for delete to authenticated
  using (owner_id = (select auth.uid()));

-- reports: 로그인한 사용자가 공개 작품만 신고. 읽기는 본인 신고와 운영자. 수정·삭제는 함수(운영자)만.
create policy reports_insert_own on public.reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and public.is_active_user()
    and exists (select 1 from public.projects p where p.id = project_id and p.status = 'published')
  );
create policy reports_select_own on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());

-- ============================================================
-- 8. Storage: 작품 이미지 버킷
-- ============================================================
-- 이미지(WebP)만, 1MB 이하. 이 두 제한은 버킷 설정이라 정책보다 먼저 걸린다.
-- 주의: allowed_mime_types 는 요청이 선언한 형식을 본다. 파일 내용(RIFF....WEBP)까지 보장하지는 않으므로
--       운영 점검(docs/SECURITY.md '이미지')에서 정기적으로 매직바이트를 확인한다. SVG 는 허용 형식에 없다.
-- 주의: public=true 는 주소를 아는 사람이 누구나 읽는다(경로가 추측 불가능한 uuid). 비공개로 돌린 작품의
--       이미지 파일은 Storage API 로 지울 때까지 주소로 접근된다. 비공개 버킷+서명 주소 방식은 docs/SECURITY.md '결정 필요' 참고.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-images', 'project-images', true, 1048576, array['image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 올리기: 경로가 <내 uid>/<내 작품 id>/<파일>.webp 일 때만, 검사중·비공개가 아닌 내 작품에만
create policy "project-images insert own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(name) like '%.webp'
    and array_length(storage.foldername(name), 1) = 2
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2] and p.owner_id = (select auth.uid()) and p.status not in ('checking', 'hidden')
    )
  );
-- 목록·조회(API 경유): 본인 폴더와 운영자만. 공개 버킷의 주소 직접 접근은 이 정책과 무관하게 열려 있다.
create policy "project-images select own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'project-images' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
create policy "project-images update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'project-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'project-images' and (storage.foldername(name))[1] = (select auth.uid())::text and lower(name) like '%.webp');
create policy "project-images delete own folder or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'project-images' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
) then
    raise exception '확장 프로그램은 소스가 있는 GitHub 저장소 주소가 필요합니다';
  end if;
  update public.projects set status = 'checking', check_summary = null where id = p_id;
end $$;

-- 검사 서비스(service_role)만. p_fingerprint 는 검사를 시작할 때의 url_fingerprint.
-- 검사 중에 주소가 바뀌었으면 결과를 버린다(바꿔치기 방지).
-- 통과 + 신뢰 계정 + 확장 프로그램 아님 => 바로 공개. 그 밖의 통과·경고 => 승인대기. 실패 => 반려.
create function public.finish_check(p_id uuid, p_fingerprint text, p_result text, p_summary jsonb, p_detail jsonb default null)
returns public.project_status
language plpgsql security definer set search_path = ''
as $$
declare
  p public.projects;
  owner_trusted boolean;
  next_status public.project_status;
begin
  if p_result not in ('pass', 'warn', 'fail') then raise exception 'result 는 pass/warn/fail'; end if;
  select * into p from public.projects where id = p_id for update;
  if p.id is null or p.status <> 'checking' then raise exception '검사중인 작품이 아닙니다'; end if;
  if p.url_fingerprint is distinct from p_fingerprint then raise exception '검사 중에 주소가 바뀌었습니다. 다시 검사해야 합니다'; end if;

  select trusted into owner_trusted from public.profiles where id = p.owner_id;
  next_status := case
    when p_result = 'fail' then 'rejected'::public.project_status
    when p_result = 'pass' and owner_trusted and p.type <> 'extension' then 'published'::public.project_status
    else 'pending_review'::public.project_status
  end;

  update public.projects
     set status = next_status, check_summary = p_summary,
         published_at = case when next_status = 'published' then coalesce(published_at, now()) else null end
   where id = p_id;
  insert into public.project_reviews (project_id, check_detail) values (p_id, p_detail)
  on conflict (project_id) do update set check_detail = excluded.check_detail, updated_at = now();
  return next_status;
end $$;

-- 운영자: 승인대기 작품을 승인(공개) 또는 반려. 첫 승인이면 그 계정을 신뢰 계정으로.
create function public.admin_review(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare p public.projects;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있습니다'; end if;
  select * into p from public.projects where id = p_id for update;
  if p.id is null or p.status <> 'pending_review' then raise exception '승인대기 작품이 아닙니다'; end if;
  if p_approve then
    update public.projects set status = 'published', published_at = coalesce(published_at, now()) where id = p_id;
    update public.profiles set trusted = true where id = p.owner_id;
  else
    update public.projects set status = 'rejected', published_at = null where id = p_id;
  end if;
  insert into public.project_reviews (project_id, review_note, reviewer_id) values (p_id, p_note, (select auth.uid()))
  on conflict (project_id) do update set review_note = excluded.review_note, reviewer_id = excluded.reviewer_id, updated_at = now();
end $$;

-- 운영자: 어떤 상태의 작품이든 즉시 비공개(악성 의심 등)
create function public.admin_hide(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있습니다'; end if;
  update public.projects set status = 'hidden', published_at = null where id = p_id;
  insert into public.project_reviews (project_id, hidden_reason, reviewer_id) values (p_id, p_reason, (select auth.uid()))
  on conflict (project_id) do update set hidden_reason = excluded.hidden_reason, reviewer_id = excluded.reviewer_id, updated_at = now();
end $$;

-- 운영자: 비공개 작품을 신고와 무관하게 되살린다(다시 검사부터)
create function public.admin_restore(p_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있습니다'; end if;
  if exists (select 1 from public.reports where project_id = p_id and status = 'open') then raise exception '열린 신고가 있어 먼저 신고를 처리해야 합니다'; end if;
  update public.projects set status = 'checking', published_at = null where id = p_id and status = 'hidden';
end $$;

-- 운영자: 신고 처리. p_restore=true 면 비공개를 풀어 다시 검사(checking)로 보낸다(주소가 그사이 바뀌었을 수 있으므로 곧바로 공개하지 않는다).
-- p_restore=false 면 반려. 열린 신고가 남아 있으면 상태를 바꾸지 않는다.
create function public.admin_resolve_report(p_report_id uuid, p_restore boolean, p_note text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare r public.reports;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있습니다'; end if;
  select * into r from public.reports where id = p_report_id for update;
  if r.id is null or r.status <> 'open' then raise exception '열린 신고가 아닙니다'; end if;
  update public.reports
     set status = case when p_restore then 'dismissed'::public.report_status else 'resolved'::public.report_status end,
         resolved_by = (select auth.uid()), resolved_at = now(), resolution_note = p_note
   where id = p_report_id;
  if r.project_id is not null
     and not exists (select 1 from public.reports where project_id = r.project_id and status = 'open') then
    update public.projects
       set status = case when p_restore then 'checking'::public.project_status else 'rejected'::public.project_status end, published_at = null
     where id = r.project_id and status = 'hidden';
  end if;
end $$;

-- ============================================================
-- 6. 권한: 기본 권한을 모두 걷고 필요한 것만 연다
-- ============================================================
-- Supabase 는 public 표에 anon·authenticated 권한을 기본으로 준다. RLS 가 마지막 방어선이 되도록
-- 열 단위로 다시 연다. (service_role 은 RLS 를 우회하므로 서버에서만 쓴다.)
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- 익명(anon): 공개 작품과 그 작성자·이미지의 공개 열만 읽는다
grant select (id, display_name, bio, created_at) on public.profiles to anon, authenticated;
grant select (id, owner_id, type, status, name, summary, description, category, url, links, tags, name_en, summary_en, howto, details, url_fingerprint, check_summary, published_at, created_at, updated_at)
  on public.projects to anon, authenticated;
grant select (id, project_id, owner_id, kind, storage_path, alt, width, height, sort) on public.project_media to anon, authenticated;

-- 로그인 사용자: 쓸 수 있는 열만 연다. 상태·소유자·검사 결과·신뢰 여부·정지 여부 열은 없다.
grant update (display_name, bio) on public.profiles to authenticated;
grant insert (owner_id, type, name, summary, description, category, url, links, tags, name_en, summary_en, howto, details) on public.projects to authenticated;
grant update (type, name, summary, description, category, url, links, tags, name_en, summary_en, howto, details) on public.projects to authenticated;
grant delete on public.projects to authenticated;
grant insert (project_id, owner_id, kind, storage_path, alt, bytes, width, height, sort) on public.project_media to authenticated;
grant update (kind, alt, sort) on public.project_media to authenticated;
grant delete on public.project_media to authenticated;
grant select on public.project_reviews to authenticated;                  -- 정책이 본인 작품만 허용
grant select on public.reports to authenticated;                          -- 정책이 본인 신고만 허용
grant insert (project_id, reporter_id, reason, detail) on public.reports to authenticated;

-- 함수: 사용자는 submit_project 만. 검사 서비스 함수는 service_role 만.
grant execute on function public.submit_project(uuid) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;       -- 익명 조회 정책에서도 호출되므로 anon 도 필요(항상 false)
grant execute on function public.admin_restore(uuid) to authenticated;
grant execute on function public.admin_review(uuid, boolean, text) to authenticated;       -- 함수 안에서 is_admin() 재확인
grant execute on function public.admin_hide(uuid, text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, boolean, text) to authenticated;
grant execute on function public.finish_check(uuid, text, text, jsonb, jsonb) to service_role;
-- RLS 정책 안에서 호출되는 도우미는 호출자 권한으로 실행되므로 실행 권한이 필요하다
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_api_user() to anon, authenticated;

-- ============================================================
-- 7. RLS 켜기와 정책
-- ============================================================
alter table public.admins enable row level security;           -- 정책 없음 = API 로 접근 불가
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_reviews enable row level security;
alter table public.project_media enable row level security;
alter table public.reports enable row level security;

-- profiles: 본인, 공개 작품이 있는 사람, 운영자만 조회. 수정은 본인만(열 권한이 display_name, bio 로 제한).
create policy profiles_select on public.profiles for select
  using (
    id = (select auth.uid())
    or public.is_admin()
    or exists (select 1 from public.projects p where p.owner_id = profiles.id and p.status = 'published')
  );
create policy profiles_update_own on public.profiles for update
  using (id = (select auth.uid()) and public.is_active_user())
  with check (id = (select auth.uid()));

-- projects
create policy projects_select_public on public.projects for select to anon, authenticated
  using (status = 'published');
create policy projects_select_own on public.projects for select to authenticated
  using (owner_id = (select auth.uid()));
create policy projects_select_admin on public.projects for select to authenticated
  using (public.is_admin());
create policy projects_insert_own on public.projects for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_active_user());
-- 검사중·비공개(hidden) 작품은 본인도 수정 못 한다(검사 도중 바꿔치기 방지, 신고 증거 보존)
create policy projects_update_own on public.projects for update to authenticated
  using (owner_id = (select auth.uid()) and status not in ('checking', 'hidden') and public.is_active_user())
  with check (owner_id = (select auth.uid()));
create policy projects_delete_own on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()) and status <> 'hidden');

-- project_reviews: 본인 작품의 반려 사유 등은 본인이, 전체는 운영자가 읽는다. 쓰기 정책 없음(함수만).
create policy project_reviews_select on public.project_reviews for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.projects p where p.id = project_reviews.project_id and p.owner_id = (select auth.uid()))
  );

-- project_media: 공개 작품의 이미지는 누구나, 그 밖에는 본인·운영자. 쓰기는 본인(검사중·비공개 제외).
create policy project_media_select on public.project_media for select to anon, authenticated
  using (
    exists (select 1 from public.projects p where p.id = project_media.project_id and p.status = 'published')
    or owner_id = (select auth.uid())
    or public.is_admin()
  );
create policy project_media_insert_own on public.project_media for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()) and p.status not in ('checking', 'hidden'))
  );
create policy project_media_update_own on public.project_media for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy project_media_delete_own on public.project_media for delete to authenticated
  using (owner_id = (select auth.uid()));

-- reports: 로그인한 사용자가 공개 작품만 신고. 읽기는 본인 신고와 운영자. 수정·삭제는 함수(운영자)만.
create policy reports_insert_own on public.reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and public.is_active_user()
    and exists (select 1 from public.projects p where p.id = project_id and p.status = 'published')
  );
create policy reports_select_own on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());

-- ============================================================
-- 8. Storage: 작품 이미지 버킷
-- ============================================================
-- 이미지(WebP)만, 1MB 이하. 이 두 제한은 버킷 설정이라 정책보다 먼저 걸린다.
-- 주의: allowed_mime_types 는 요청이 선언한 형식을 본다. 파일 내용(RIFF....WEBP)까지 보장하지는 않으므로
--       운영 점검(docs/SECURITY.md '이미지')에서 정기적으로 매직바이트를 확인한다. SVG 는 허용 형식에 없다.
-- 주의: public=true 는 주소를 아는 사람이 누구나 읽는다(경로가 추측 불가능한 uuid). 비공개로 돌린 작품의
--       이미지 파일은 Storage API 로 지울 때까지 주소로 접근된다. 비공개 버킷+서명 주소 방식은 docs/SECURITY.md '결정 필요' 참고.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-images', 'project-images', true, 1048576, array['image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 올리기: 경로가 <내 uid>/<내 작품 id>/<파일>.webp 일 때만, 검사중·비공개가 아닌 내 작품에만
create policy "project-images insert own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(name) like '%.webp'
    and array_length(storage.foldername(name), 1) = 2
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2] and p.owner_id = (select auth.uid()) and p.status not in ('checking', 'hidden')
    )
  );
-- 목록·조회(API 경유): 본인 폴더와 운영자만. 공개 버킷의 주소 직접 접근은 이 정책과 무관하게 열려 있다.
create policy "project-images select own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'project-images' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
create policy "project-images update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'project-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'project-images' and (storage.foldername(name))[1] = (select auth.uid())::text and lower(name) like '%.webp');
create policy "project-images delete own folder or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'project-images' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

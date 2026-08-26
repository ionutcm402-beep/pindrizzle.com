create table if not exists public.compliance_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('data_access','data_erasure','data_correction','data_restriction','data_objection','safety_complaint','moderation_appeal','other')),
  details text not null check (char_length(trim(details)) between 10 and 2000),
  status text not null default 'open' check (status in ('open','in_review','completed','rejected')),
  response_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null
);

alter table public.compliance_requests enable row level security;

revoke all on table public.compliance_requests from public, anon, authenticated;
grant select, insert, update on table public.compliance_requests to authenticated;

create index if not exists compliance_requests_user_created_idx
  on public.compliance_requests (user_id, created_at desc);
create index if not exists compliance_requests_status_created_idx
  on public.compliance_requests (status, created_at asc);

drop policy if exists "users read own compliance requests" on public.compliance_requests;
create policy "users read own compliance requests"
  on public.compliance_requests
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users submit own compliance requests" on public.compliance_requests;
create policy "users submit own compliance requests"
  on public.compliance_requests
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'open'
    and response_note is null
    and resolved_at is null
  );

drop policy if exists "moderators read compliance requests" on public.compliance_requests;
create policy "moderators read compliance requests"
  on public.compliance_requests
  for select
  to authenticated
  using (public.is_moderator());

drop policy if exists "moderators update compliance requests" on public.compliance_requests;
create policy "moderators update compliance requests"
  on public.compliance_requests
  for update
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

comment on table public.compliance_requests is 'Phase 22 authenticated privacy, safety complaint, and moderation appeal requests.';

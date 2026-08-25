create table if not exists public.moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.report_reviews (
  report_id uuid primary key references public.reports(id) on delete cascade,
  status text not null check (status in ('dismissed','actioned')),
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  notes text
);

alter table public.moderators enable row level security;
alter table public.report_reviews enable row level security;
revoke all on table public.moderators from anon, authenticated;
revoke all on table public.report_reviews from anon, authenticated;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.moderators m where m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

create or replace function public.moderation_report_queue()
returns table (
  report_id uuid,
  ping_id uuid,
  reason text,
  details text,
  reported_at timestamptz,
  ping_title text,
  ping_body text,
  ping_status public.ping_status,
  ping_owner_name text,
  reporter_name text,
  reports_on_ping bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  return query
  select
    r.id,
    r.ping_id,
    r.reason,
    r.details,
    r.created_at,
    p.title,
    p.body,
    p.status,
    coalesce(owner_profile.display_name, 'Neighbour'),
    coalesce(reporter_profile.display_name, 'Neighbour'),
    (select count(*) from public.reports r2 where r2.ping_id = r.ping_id)
  from public.reports r
  join public.pings p on p.id = r.ping_id
  left join public.profiles owner_profile on owner_profile.id = p.user_id
  left join public.profiles reporter_profile on reporter_profile.id = r.reporter_id
  left join public.report_reviews rr on rr.report_id = r.id
  where rr.report_id is null
    and p.status = 'active'
  order by r.created_at desc;
end;
$$;

revoke all on function public.moderation_report_queue() from public, anon;
grant execute on function public.moderation_report_queue() to authenticated;

create or replace function public.moderate_report(
  target_report_id uuid,
  moderation_action text,
  moderation_notes text default ''
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_ping_id uuid;
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  if moderation_action not in ('dismiss','remove') then
    raise exception 'Invalid moderation action';
  end if;

  select r.ping_id into target_ping_id
  from public.reports r
  where r.id = target_report_id;

  if target_ping_id is null then
    raise exception 'Report not found';
  end if;

  if moderation_action = 'remove' then
    update public.pings
    set status = 'removed', updated_at = now()
    where id = target_ping_id and status = 'active';
  end if;

  insert into public.report_reviews (report_id, status, reviewed_by, reviewed_at, notes)
  values (
    target_report_id,
    case when moderation_action = 'remove' then 'actioned' else 'dismissed' end,
    auth.uid(),
    now(),
    left(nullif(trim(moderation_notes), ''), 500)
  )
  on conflict (report_id) do update set
    status = excluded.status,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    notes = excluded.notes;

  return moderation_action;
end;
$$;

revoke all on function public.moderate_report(uuid, text, text) from public, anon;
grant execute on function public.moderate_report(uuid, text, text) to authenticated;

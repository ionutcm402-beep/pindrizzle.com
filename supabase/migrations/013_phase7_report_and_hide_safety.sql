create table if not exists public.ping_hides (
  user_id uuid not null references auth.users(id) on delete cascade,
  ping_id uuid not null references public.pings(id) on delete cascade,
  reason text not null default 'reported',
  created_at timestamptz not null default now(),
  primary key (user_id, ping_id)
);

alter table public.ping_hides enable row level security;

drop policy if exists "users read own hidden pings" on public.ping_hides;
create policy "users read own hidden pings"
on public.ping_hides for select
to authenticated
using (auth.uid() = user_id);

revoke all on table public.ping_hides from anon, authenticated;
grant select on table public.ping_hides to authenticated;

drop policy if exists "users create reports" on public.reports;
revoke insert, update, delete on table public.reports from anon, authenticated;
grant select on table public.reports to authenticated;

create or replace function public.report_ping(
  target_ping_id uuid,
  report_reason text,
  report_details text default ''
)
returns table (report_id uuid, hidden boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  existing_report_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if report_reason not in ('incorrect','spam','harassment','dangerous','privacy','other') then
    raise exception 'Invalid report reason';
  end if;

  select p.user_id into owner_id
  from public.pings p
  where p.id = target_ping_id
    and p.status = 'active'
    and p.expires_at > now();

  if owner_id is null then
    raise exception 'Ping not available';
  end if;
  if owner_id = auth.uid() then
    raise exception 'You cannot report your own Ping';
  end if;

  if (
    select count(*)
    from public.reports r
    where r.reporter_id = auth.uid()
      and r.created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'Report limit reached. Please try again later.';
  end if;

  insert into public.reports (ping_id, reporter_id, reason, details)
  values (
    target_ping_id,
    auth.uid(),
    report_reason,
    left(nullif(trim(report_details), ''), 500)
  )
  on conflict (ping_id, reporter_id)
  do update set
    reason = excluded.reason,
    details = excluded.details,
    created_at = now()
  returning id into existing_report_id;

  insert into public.ping_hides (user_id, ping_id, reason)
  values (auth.uid(), target_ping_id, 'reported')
  on conflict (user_id, ping_id)
  do update set reason = excluded.reason, created_at = now();

  report_id := existing_report_id;
  hidden := true;
  return next;
end;
$$;

revoke all on function public.report_ping(uuid, text, text) from public, anon;
grant execute on function public.report_ping(uuid, text, text) to authenticated;

create or replace function public.unhide_ping(target_ping_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from public.ping_hides
  where user_id = auth.uid() and ping_id = target_ping_id;

  return found;
end;
$$;

revoke all on function public.unhide_ping(uuid) from public, anon;
grant execute on function public.unhide_ping(uuid) to authenticated;

create or replace function public.ping_hidden_for_viewer(target_ping_id uuid, owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.ping_hides h
      where h.user_id = auth.uid() and h.ping_id = target_ping_id
    )
    or exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = owner_id)
         or (b.blocker_id = owner_id and b.blocked_id = auth.uid())
    )
  );
$$;

revoke all on function public.ping_hidden_for_viewer(uuid, uuid) from public, anon, authenticated;

create or replace function public.nearby_pings(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_meters integer default 1609,
  result_limit integer default 50
)
returns table (
  id uuid,
  user_id uuid,
  category public.ping_category,
  title text,
  body text,
  place_label text,
  confirmation_count integer,
  comment_count integer,
  created_at timestamptz,
  expires_at timestamptz,
  distance_meters double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.user_id, p.category, p.title, p.body, p.place_label,
    p.confirmation_count, p.comment_count, p.created_at, p.expires_at,
    st_distance(p.location, st_setsrid(st_makepoint(viewer_lng, viewer_lat),4326)::geography) as distance_meters
  from public.pings p
  where p.status = 'active'
    and p.expires_at > now()
    and st_dwithin(p.location, st_setsrid(st_makepoint(viewer_lng, viewer_lat),4326)::geography, radius_meters)
    and not public.ping_hidden_for_viewer(p.id, p.user_id)
  order by p.created_at desc
  limit least(result_limit, 100);
$$;

revoke all on function public.nearby_pings(double precision, double precision, integer, integer) from public;
grant execute on function public.nearby_pings(double precision, double precision, integer, integer) to anon, authenticated;

create or replace function public.nearby_map_pings(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_meters integer default 1609,
  result_limit integer default 100
)
returns table (
  id uuid,
  user_id uuid,
  category public.ping_category,
  title text,
  body text,
  place_label text,
  confirmation_count integer,
  comment_count integer,
  created_at timestamptz,
  expires_at timestamptz,
  distance_meters double precision,
  map_lat double precision,
  map_lng double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography as location
  ),
  candidates as (
    select
      p.*,
      case
        when auth.uid() is not null and p.user_id = auth.uid() then p.location::geometry
        else st_translate(st_snaptogrid(p.location::geometry, 0.004), 0.002, 0.002)
      end as display_location
    from public.pings p
    cross join viewer v
    where p.status = 'active'
      and p.expires_at > now()
      and st_dwithin(p.location, v.location, radius_meters)
      and not public.ping_hidden_for_viewer(p.id, p.user_id)
  )
  select
    p.id,
    p.user_id,
    p.category,
    p.title,
    p.body,
    p.place_label,
    p.confirmation_count,
    p.comment_count,
    p.created_at,
    p.expires_at,
    st_distance(p.display_location::geography, v.location) as distance_meters,
    st_y(p.display_location) as map_lat,
    st_x(p.display_location) as map_lng
  from candidates p
  cross join viewer v
  order by p.created_at desc
  limit least(result_limit, 100);
$$;

revoke all on function public.nearby_map_pings(double precision, double precision, integer, integer) from public;
grant execute on function public.nearby_map_pings(double precision, double precision, integer, integer) to anon, authenticated;

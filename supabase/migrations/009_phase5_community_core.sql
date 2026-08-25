create table if not exists public.ping_helpful (
  ping_id uuid not null references public.pings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ping_id, user_id)
);

alter table public.ping_helpful enable row level security;
revoke all on table public.ping_helpful from anon, authenticated;

create or replace function public.sync_profile_helpful_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_ping_id uuid;
  owner_id uuid;
begin
  affected_ping_id := coalesce(new.ping_id, old.ping_id);
  select p.user_id into owner_id from public.pings p where p.id = affected_ping_id;
  if owner_id is not null then
    update public.profiles pr
    set helpful_pings = (
      select count(*)::integer
      from public.ping_helpful h
      join public.pings p on p.id = h.ping_id
      where p.user_id = owner_id
    ), updated_at = now()
    where pr.id = owner_id;
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.sync_profile_helpful_total() from public, anon, authenticated;
drop trigger if exists sync_profile_helpful_total on public.ping_helpful;
create trigger sync_profile_helpful_total
after insert or delete on public.ping_helpful
for each row execute procedure public.sync_profile_helpful_total();

create or replace function public.sync_profile_confirmation_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_ping_id uuid;
  owner_id uuid;
begin
  affected_ping_id := coalesce(new.ping_id, old.ping_id);
  select p.user_id into owner_id from public.pings p where p.id = affected_ping_id;
  if owner_id is not null then
    update public.profiles pr
    set confirmation_count = (
      select count(*)::integer
      from public.confirmations c
      join public.pings p on p.id = c.ping_id
      where p.user_id = owner_id
    ), updated_at = now()
    where pr.id = owner_id;
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.sync_profile_confirmation_total() from public, anon, authenticated;
drop trigger if exists sync_profile_confirmation_total on public.confirmations;
create trigger sync_profile_confirmation_total
after insert or delete on public.confirmations
for each row execute procedure public.sync_profile_confirmation_total();

update public.profiles pr
set helpful_pings = (
      select count(*)::integer
      from public.ping_helpful h
      join public.pings p on p.id = h.ping_id
      where p.user_id = pr.id
    ),
    confirmation_count = (
      select count(*)::integer
      from public.confirmations c
      join public.pings p on p.id = c.ping_id
      where p.user_id = pr.id
    ),
    updated_at = now();

create or replace function public.toggle_ping_helpful(target_ping_id uuid)
returns table (helpful_count integer, marked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  existing boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
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
    raise exception 'You cannot mark your own Ping helpful';
  end if;

  select exists(
    select 1 from public.ping_helpful h
    where h.ping_id = target_ping_id and h.user_id = auth.uid()
  ) into existing;

  if existing then
    delete from public.ping_helpful
    where ping_id = target_ping_id and user_id = auth.uid();
    marked := false;
  else
    insert into public.ping_helpful (ping_id, user_id)
    values (target_ping_id, auth.uid())
    on conflict do nothing;
    marked := true;
  end if;

  select count(*)::integer into helpful_count
  from public.ping_helpful h
  where h.ping_id = target_ping_id;

  return next;
end;
$$;

revoke all on function public.toggle_ping_helpful(uuid) from public, anon;
grant execute on function public.toggle_ping_helpful(uuid) to authenticated;

create or replace function public.toggle_block_user(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if target_user_id is null or target_user_id = auth.uid() then
    raise exception 'Invalid user';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    raise exception 'User not found';
  end if;

  select exists(
    select 1 from public.blocks b
    where b.blocker_id = auth.uid() and b.blocked_id = target_user_id
  ) into existing;

  if existing then
    delete from public.blocks
    where blocker_id = auth.uid() and blocked_id = target_user_id;
    return false;
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (auth.uid(), target_user_id)
  on conflict do nothing;
  return true;
end;
$$;

revoke all on function public.toggle_block_user(uuid) from public, anon;
grant execute on function public.toggle_block_user(uuid) to authenticated;

create or replace function public.ping_community_state(target_ping_id uuid)
returns table (
  helpful_count integer,
  helpful_by_me boolean,
  blocked_by_me boolean,
  hidden_by_block boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  select p.user_id into owner_id from public.pings p where p.id = target_ping_id;

  select count(*)::integer into helpful_count
  from public.ping_helpful h
  where h.ping_id = target_ping_id;

  helpful_by_me := auth.uid() is not null and exists(
    select 1 from public.ping_helpful h
    where h.ping_id = target_ping_id and h.user_id = auth.uid()
  );

  blocked_by_me := auth.uid() is not null and owner_id is not null and exists(
    select 1 from public.blocks b
    where b.blocker_id = auth.uid() and b.blocked_id = owner_id
  );

  hidden_by_block := auth.uid() is not null and owner_id is not null and exists(
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = owner_id)
       or (b.blocker_id = owner_id and b.blocked_id = auth.uid())
  );

  return next;
end;
$$;

revoke all on function public.ping_community_state(uuid) from public;
grant execute on function public.ping_community_state(uuid) to anon, authenticated;

create or replace function public.my_community_stats()
returns table (helpful_pings integer, confirmations integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.helpful_pings, p.confirmation_count
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.my_community_stats() from public, anon;
grant execute on function public.my_community_stats() to authenticated;

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
    and (
      auth.uid() is null
      or not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = p.user_id)
           or (b.blocker_id = p.user_id and b.blocked_id = auth.uid())
      )
    )
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
      and (
        auth.uid() is null
        or not exists (
          select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = p.user_id)
             or (b.blocker_id = p.user_id and b.blocked_id = auth.uid())
        )
      )
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

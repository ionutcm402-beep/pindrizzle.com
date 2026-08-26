-- Phase 20: reduce hot-path spatial/visibility/query work without changing privacy semantics.

create or replace function public.create_ping(
  ping_category public.ping_category,
  ping_title text,
  ping_body text,
  ping_lat double precision,
  ping_lng double precision,
  ping_place_label text default null,
  ping_precision public.location_precision default 'approximate'::public.location_precision
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_id uuid;
  approximate_location geography(point,4326);
  resolved_place text;
  center_lat double precision;
  center_lng double precision;
  cell_key text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if ping_lat is null or ping_lng is null
     or ping_lat < -90 or ping_lat > 90
     or ping_lng < -180 or ping_lng > 180 then
    raise exception 'Invalid Ping location';
  end if;

  approximate_location := st_snaptogrid(
    st_setsrid(st_makepoint(ping_lng, ping_lat), 4326),
    0.004
  )::geography;

  -- Match the exact privacy-cell key used by /api/location/place instead of
  -- scanning nearby cache rows. This remains O(1) as cached areas grow.
  center_lat := floor(ping_lat / 0.004) * 0.004 + 0.002;
  center_lng := floor(ping_lng / 0.004) * 0.004 + 0.002;
  cell_key := to_char(round(center_lat::numeric, 3), 'FM999990.000') || ':' ||
              to_char(round(center_lng::numeric, 3), 'FM999990.000');

  select pc.display_label
  into resolved_place
  from public.place_cells pc
  where pc.grid_key = cell_key
    and pc.refreshed_at > now() - interval '30 days';

  resolved_place := coalesce(
    left(nullif(trim(resolved_place), ''), 120),
    left(nullif(trim(ping_place_label), ''), 120),
    'Nearby'
  );

  insert into public.pings (
    user_id, category, title, body, location, location_precision, place_label
  ) values (
    auth.uid(), ping_category, ping_title, ping_body, approximate_location, 'approximate', resolved_place
  ) returning id into created_id;

  return created_id;
end;
$$;

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
  with params as (
    select
      st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography as viewer_location,
      least(greatest(coalesce(radius_meters, 1609), 100), 8047) as capped_radius,
      auth.uid() as viewer_user_id
  ),
  hidden_pings as (
    select h.ping_id
    from public.ping_hides h
    cross join params v
    where h.user_id = v.viewer_user_id
  ),
  blocked_users as (
    select b.blocked_id as user_id
    from public.blocks b
    cross join params v
    where b.blocker_id = v.viewer_user_id
    union
    select b.blocker_id as user_id
    from public.blocks b
    cross join params v
    where b.blocked_id = v.viewer_user_id
  ),
  candidates as (
    select
      p.id, p.user_id, p.category, p.title, p.body, p.place_label,
      p.confirmation_count, p.comment_count, p.created_at, p.expires_at,
      case
        when v.viewer_user_id is not null and p.user_id = v.viewer_user_id then p.location::geometry
        else st_translate(p.location::geometry, 0.002, 0.002)
      end as display_location
    from public.pings p
    cross join params v
    where p.status = 'active'
      and p.expires_at > now()
      and not exists (select 1 from hidden_pings h where h.ping_id = p.id)
      and not exists (select 1 from blocked_users b where b.user_id = p.user_id)
      and st_dwithin(p.location, v.viewer_location, v.capped_radius + 400)
  )
  select
    p.id, p.user_id, p.category, p.title, p.body, p.place_label,
    p.confirmation_count, p.comment_count, p.created_at, p.expires_at,
    st_distance(p.display_location::geography, v.viewer_location) as distance_meters
  from candidates p
  cross join params v
  where st_dwithin(p.display_location::geography, v.viewer_location, v.capped_radius)
  order by p.created_at desc
  limit greatest(0, least(coalesce(result_limit, 50), 100));
$$;

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
  with params as (
    select
      st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography as viewer_location,
      least(greatest(coalesce(radius_meters, 1609), 100), 8047) as capped_radius,
      auth.uid() as viewer_user_id
  ),
  hidden_pings as (
    select h.ping_id
    from public.ping_hides h
    cross join params v
    where h.user_id = v.viewer_user_id
  ),
  blocked_users as (
    select b.blocked_id as user_id
    from public.blocks b
    cross join params v
    where b.blocker_id = v.viewer_user_id
    union
    select b.blocker_id as user_id
    from public.blocks b
    cross join params v
    where b.blocked_id = v.viewer_user_id
  ),
  candidates as (
    select
      p.id, p.user_id, p.category, p.title, p.body, p.place_label,
      p.confirmation_count, p.comment_count, p.created_at, p.expires_at,
      case
        when v.viewer_user_id is not null and p.user_id = v.viewer_user_id then p.location::geometry
        else st_translate(p.location::geometry, 0.002, 0.002)
      end as display_location
    from public.pings p
    cross join params v
    where p.status = 'active'
      and p.expires_at > now()
      and not exists (select 1 from hidden_pings h where h.ping_id = p.id)
      and not exists (select 1 from blocked_users b where b.user_id = p.user_id)
      and st_dwithin(p.location, v.viewer_location, v.capped_radius + 400)
  )
  select
    p.id, p.user_id, p.category, p.title, p.body, p.place_label,
    p.confirmation_count, p.comment_count, p.created_at, p.expires_at,
    st_distance(p.display_location::geography, v.viewer_location) as distance_meters,
    st_y(p.display_location) as map_lat,
    st_x(p.display_location) as map_lng
  from candidates p
  cross join params v
  where st_dwithin(p.display_location::geography, v.viewer_location, v.capped_radius)
  order by p.created_at desc
  limit greatest(0, least(coalesce(result_limit, 100), 100));
$$;

create or replace function public.search_nearby_pings(
  viewer_lat double precision,
  viewer_lng double precision,
  search_query text default '',
  category_filter public.ping_category default null,
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
  distance_meters double precision,
  search_rank real
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography as viewer_location,
      least(greatest(coalesce(radius_meters, 1609), 100), 8047) as capped_radius,
      left(trim(coalesce(search_query, '')), 120) as query_text,
      auth.uid() as viewer_user_id
  ),
  query_params as (
    select p.*, plainto_tsquery('simple'::regconfig, p.query_text) as query_vector
    from params p
  ),
  hidden_pings as (
    select h.ping_id
    from public.ping_hides h
    cross join query_params v
    where h.user_id = v.viewer_user_id
  ),
  blocked_users as (
    select b.blocked_id as user_id
    from public.blocks b
    cross join query_params v
    where b.blocker_id = v.viewer_user_id
    union
    select b.blocker_id as user_id
    from public.blocks b
    cross join query_params v
    where b.blocked_id = v.viewer_user_id
  ),
  candidates as (
    select
      p.id, p.user_id, p.category, p.title, p.body, p.place_label,
      p.confirmation_count, p.comment_count, p.created_at, p.expires_at,
      case
        when v.viewer_user_id is not null and p.user_id = v.viewer_user_id then p.location::geometry
        else st_translate(p.location::geometry, 0.002, 0.002)
      end as display_location,
      case
        when v.query_text = '' then 0::real
        else ts_rank_cd(
          to_tsvector('simple'::regconfig, coalesce(p.title, '') || ' ' || coalesce(p.body, '') || ' ' || coalesce(p.place_label, '')),
          v.query_vector
        )
      end as rank_value
    from public.pings p
    cross join query_params v
    where p.status = 'active'
      and p.expires_at > now()
      and (category_filter is null or p.category = category_filter)
      and not exists (select 1 from hidden_pings h where h.ping_id = p.id)
      and not exists (select 1 from blocked_users b where b.user_id = p.user_id)
      and st_dwithin(p.location, v.viewer_location, v.capped_radius + 400)
      and (
        v.query_text = ''
        or to_tsvector('simple'::regconfig, coalesce(p.title, '') || ' ' || coalesce(p.body, '') || ' ' || coalesce(p.place_label, '')) @@ v.query_vector
      )
  )
  select
    p.id, p.user_id, p.category, p.title, p.body, p.place_label,
    p.confirmation_count, p.comment_count, p.created_at, p.expires_at,
    st_distance(p.display_location::geography, v.viewer_location) as distance_meters,
    p.rank_value as search_rank
  from candidates p
  cross join query_params v
  where st_dwithin(p.display_location::geography, v.viewer_location, v.capped_radius)
  order by
    case when v.query_text <> '' then p.rank_value else 0 end desc,
    p.confirmation_count desc,
    p.created_at desc
  limit greatest(0, least(coalesce(result_limit, 50), 100));
$$;

create or replace function public.nearby_promoted_pings(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_meters integer default 1609,
  result_limit integer default 1
)
returns table (
  promotion_id uuid,
  ping_id uuid,
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
  sponsor_name text,
  promoted_until timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography as viewer_location,
      least(greatest(coalesce(radius_meters, 1609), 100), 8047) as capped_radius,
      auth.uid() as viewer_user_id
  ),
  hidden_pings as (
    select h.ping_id
    from public.ping_hides h
    cross join params v
    where h.user_id = v.viewer_user_id
  ),
  blocked_users as (
    select b.blocked_id as user_id
    from public.blocks b
    cross join params v
    where b.blocker_id = v.viewer_user_id
    union
    select b.blocker_id as user_id
    from public.blocks b
    cross join params v
    where b.blocked_id = v.viewer_user_id
  ),
  candidates as (
    select
      pr.id as promotion_id,
      pr.ping_id,
      pr.sponsor_name,
      pr.ends_at,
      pr.target_radius_meters,
      pr.priority,
      pr.starts_at,
      p.user_id,
      p.category,
      p.title,
      p.body,
      p.place_label,
      p.confirmation_count,
      p.comment_count,
      p.created_at,
      p.expires_at,
      case
        when v.viewer_user_id is not null and p.user_id = v.viewer_user_id then p.location::geometry
        else st_translate(p.location::geometry, 0.002, 0.002)
      end as display_location
    from public.promotions pr
    join public.pings p on p.id = pr.ping_id
    cross join params v
    where pr.status = 'active'
      and pr.approved_at is not null
      and pr.payment_status in ('paid','waived')
      and pr.starts_at <= now()
      and pr.ends_at > now()
      and p.status = 'active'
      and p.expires_at > now()
      and not exists (select 1 from hidden_pings h where h.ping_id = p.id)
      and not exists (select 1 from blocked_users b where b.user_id = p.user_id)
      and st_dwithin(p.location, v.viewer_location, least(v.capped_radius, pr.target_radius_meters) + 400)
  )
  select
    pr.promotion_id,
    pr.ping_id,
    pr.user_id,
    pr.category,
    pr.title,
    pr.body,
    pr.place_label,
    pr.confirmation_count,
    pr.comment_count,
    pr.created_at,
    pr.expires_at,
    st_distance(pr.display_location::geography, v.viewer_location) as distance_meters,
    pr.sponsor_name,
    pr.ends_at as promoted_until
  from candidates pr
  cross join params v
  where st_dwithin(pr.display_location::geography, v.viewer_location, least(v.capped_radius, pr.target_radius_meters))
  order by pr.priority desc, pr.starts_at asc, pr.promotion_id asc
  limit greatest(0, least(coalesce(result_limit, 1), 3));
$$;

revoke all on function public.create_ping(public.ping_category,text,text,double precision,double precision,text,public.location_precision) from public, anon;
grant execute on function public.create_ping(public.ping_category,text,text,double precision,double precision,text,public.location_precision) to authenticated;

revoke all on function public.nearby_pings(double precision,double precision,integer,integer) from public;
grant execute on function public.nearby_pings(double precision,double precision,integer,integer) to anon, authenticated;
revoke all on function public.nearby_map_pings(double precision,double precision,integer,integer) from public;
grant execute on function public.nearby_map_pings(double precision,double precision,integer,integer) to anon, authenticated;
revoke all on function public.search_nearby_pings(double precision,double precision,text,public.ping_category,integer,integer) from public;
grant execute on function public.search_nearby_pings(double precision,double precision,text,public.ping_category,integer,integer) to anon, authenticated;
revoke all on function public.nearby_promoted_pings(double precision,double precision,integer,integer) from public;
grant execute on function public.nearby_promoted_pings(double precision,double precision,integer,integer) to anon, authenticated;

-- Phase 10 launch hardening: public nearby endpoints must never expose or
-- measure against a non-owner Ping's exact stored point. Keep the public
-- experience usable before sign-in while applying the same approximate grid
-- location to Feed, Map and promoted placements. Also cap all public radii at
-- five miles server-side so direct RPC callers cannot widen the search.

create or replace function public.nearby_pings(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_meters integer default 1609,
  result_limit integer default 50
)
returns table(
  id uuid,
  user_id uuid,
  category ping_category,
  title text,
  body text,
  place_label text,
  confirmation_count integer,
  comment_count integer,
  created_at timestamptz,
  expires_at timestamptz,
  distance_meters double precision
)
language sql stable security definer set search_path = public
as $$
  with params as (
    select
      st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography as viewer_location,
      least(greatest(coalesce(radius_meters, 1609), 100), 8047) as capped_radius
  ),
  candidates as (
    select
      p.*,
      case
        when auth.uid() is not null and p.user_id = auth.uid() then p.location::geometry
        else st_translate(st_snaptogrid(p.location::geometry, 0.004), 0.002, 0.002)
      end as display_location
    from public.pings p
    cross join params v
    where p.status = 'active'
      and p.expires_at > now()
      and not public.ping_hidden_for_viewer(p.id, p.user_id)
      and st_dwithin(p.location, v.viewer_location, v.capped_radius + 1000)
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
returns table(
  id uuid,
  user_id uuid,
  category ping_category,
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
language sql stable security definer set search_path = public
as $$
  with params as (
    select
      st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography as viewer_location,
      least(greatest(coalesce(radius_meters, 1609), 100), 8047) as capped_radius
  ),
  candidates as (
    select
      p.*,
      case
        when auth.uid() is not null and p.user_id = auth.uid() then p.location::geometry
        else st_translate(st_snaptogrid(p.location::geometry, 0.004), 0.002, 0.002)
      end as display_location
    from public.pings p
    cross join params v
    where p.status = 'active'
      and p.expires_at > now()
      and not public.ping_hidden_for_viewer(p.id, p.user_id)
      and st_dwithin(p.location, v.viewer_location, v.capped_radius + 1000)
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

create or replace function public.nearby_promoted_pings(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_meters integer default 1609,
  result_limit integer default 1
)
returns table(
  promotion_id uuid,
  ping_id uuid,
  user_id uuid,
  category ping_category,
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
language sql stable security definer set search_path = public
as $$
  with params as (
    select
      st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography as viewer_location,
      least(greatest(coalesce(radius_meters, 1609), 100), 8047) as capped_radius
  ),
  candidates as (
    select
      pr.*,
      p.user_id as ping_user_id,
      p.category,
      p.title,
      p.body,
      p.place_label,
      p.confirmation_count,
      p.comment_count,
      p.created_at as ping_created_at,
      p.expires_at as ping_expires_at,
      case
        when auth.uid() is not null and p.user_id = auth.uid() then p.location::geometry
        else st_translate(st_snaptogrid(p.location::geometry, 0.004), 0.002, 0.002)
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
      and st_dwithin(p.location, v.viewer_location, least(v.capped_radius, pr.target_radius_meters) + 1000)
      and (
        auth.uid() is null
        or not exists (
          select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = p.user_id)
             or (b.blocker_id = p.user_id and b.blocked_id = auth.uid())
        )
      )
      and (
        auth.uid() is null
        or not exists (
          select 1 from public.ping_hides h
          where h.user_id = auth.uid() and h.ping_id = p.id
        )
      )
  )
  select
    pr.id as promotion_id,
    pr.ping_id,
    pr.ping_user_id as user_id,
    pr.category,
    pr.title,
    pr.body,
    pr.place_label,
    pr.confirmation_count,
    pr.comment_count,
    pr.ping_created_at as created_at,
    pr.ping_expires_at as expires_at,
    st_distance(pr.display_location::geography, v.viewer_location) as distance_meters,
    pr.sponsor_name,
    pr.ends_at as promoted_until
  from candidates pr
  cross join params v
  where st_dwithin(pr.display_location::geography, v.viewer_location, least(v.capped_radius, pr.target_radius_meters))
  order by pr.priority desc, pr.starts_at asc, pr.id asc
  limit greatest(0, least(coalesce(result_limit, 1), 3));
$$;

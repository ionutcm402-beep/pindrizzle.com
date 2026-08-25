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
security invoker
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

grant execute on function public.nearby_map_pings(double precision, double precision, integer, integer) to anon, authenticated;

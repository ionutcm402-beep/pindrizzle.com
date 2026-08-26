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
    st_distance(
      p.location,
      st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography
    ) as distance_meters,
    case
      when p.location_precision = 'exact' then st_y(p.location::geometry)
      else st_y(st_snaptogrid(p.location::geometry, 0.002))
    end as map_lat,
    case
      when p.location_precision = 'exact' then st_x(p.location::geometry)
      else st_x(st_snaptogrid(p.location::geometry, 0.002))
    end as map_lng
  from public.pings p
  where p.status = 'active'
    and p.expires_at > now()
    and st_dwithin(
      p.location,
      st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography,
      radius_meters
    )
  order by p.created_at desc
  limit least(result_limit, 100);
$$;

grant execute on function public.nearby_map_pings(double precision, double precision, integer, integer) to anon, authenticated;

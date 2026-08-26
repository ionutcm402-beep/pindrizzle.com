-- Phase 15: automatically apply the privacy-safe coarse place label resolved for
-- the user's location cell. Client supplied text remains a fallback only.

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
set search_path = public
as $$
declare
  created_id uuid;
  approximate_location geography(point,4326);
  resolved_place text;
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

  -- place_cells contains only coarse cell centres. Pick the nearest fresh cell
  -- within one privacy grid step; exact GPS is never stored in this cache.
  select pc.display_label
  into resolved_place
  from public.place_cells pc
  where pc.refreshed_at > now() - interval '30 days'
    and abs(pc.center_lat - ping_lat) <= 0.004
    and abs(pc.center_lng - ping_lng) <= 0.004
  order by power(pc.center_lat - ping_lat, 2) + power(pc.center_lng - ping_lng, 2)
  limit 1;

  resolved_place := coalesce(
    left(nullif(trim(resolved_place), ''), 120),
    left(nullif(trim(ping_place_label), ''), 120),
    'Nearby'
  );

  insert into public.pings (
    user_id, category, title, body, location, location_precision, place_label
  ) values (
    auth.uid(),
    ping_category,
    ping_title,
    ping_body,
    approximate_location,
    'approximate',
    resolved_place
  ) returning id into created_id;

  return created_id;
end;
$$;

revoke all on function public.create_ping(public.ping_category,text,text,double precision,double precision,text,public.location_precision) from public, anon;
grant execute on function public.create_ping(public.ping_category,text,text,double precision,double precision,text,public.location_precision) to authenticated;

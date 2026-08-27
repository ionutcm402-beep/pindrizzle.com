-- Phase 25.5: explicit per-Ping location visibility.
-- Private/approximate remains the default. Exact must be deliberately requested.

create or replace function public.enforce_approximate_ping_location()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $function$
begin
  if new.location_precision = 'exact'::public.location_precision then
    new.location := st_setsrid(new.location::geometry, 4326)::geography;
  else
    new.location := st_snaptogrid(st_setsrid(new.location::geometry, 4326), 0.004)::geography;
    new.location_precision := 'approximate'::public.location_precision;
  end if;
  return new;
end;
$function$;

create or replace function public.create_ping_v4(
  ping_category public.ping_category,
  ping_title text,
  ping_body text,
  ping_lat double precision,
  ping_lng double precision,
  ping_place_label text default null,
  ping_expires_in_hours integer default 24,
  ping_deal_source text default null,
  ping_deal_kind text default null,
  ping_merchant_name text default null,
  ping_marketplace_type text default null,
  ping_marketplace_intent text default null,
  ping_marketplace_subtype text default null,
  ping_marketplace_price numeric default null,
  ping_marketplace_price_period text default null,
  ping_marketplace_currency text default null,
  ping_marketplace_url text default null,
  ping_location_precision text default 'approximate'
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  created_id uuid;
  clean_precision text;
begin
  clean_precision := lower(coalesce(nullif(trim(ping_location_precision), ''), 'approximate'));
  if clean_precision = 'private' then clean_precision := 'approximate'; end if;
  if clean_precision not in ('approximate','exact') then
    raise exception 'Choose Private location or Exact location';
  end if;

  created_id := public.create_ping_v3(
    ping_category, ping_title, ping_body, ping_lat, ping_lng, ping_place_label,
    ping_expires_in_hours, ping_deal_source, ping_deal_kind, ping_merchant_name,
    ping_marketplace_type, ping_marketplace_intent, ping_marketplace_subtype,
    ping_marketplace_price, ping_marketplace_price_period, ping_marketplace_currency,
    ping_marketplace_url
  );

  if clean_precision = 'exact' then
    update public.pings
    set location = st_setsrid(st_makepoint(ping_lng, ping_lat), 4326)::geography,
        location_precision = 'exact'::public.location_precision,
        updated_at = now()
    where id = created_id and user_id = auth.uid();
  end if;

  return created_id;
end;
$function$;

revoke all on function public.create_ping_v4(public.ping_category,text,text,double precision,double precision,text,integer,text,text,text,text,text,text,numeric,text,text,text,text) from public, anon;
grant execute on function public.create_ping_v4(public.ping_category,text,text,double precision,double precision,text,integer,text,text,text,text,text,text,numeric,text,text,text,text) to authenticated, service_role;

create or replace function public.nearby_pings(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_meters integer default 1609,
  result_limit integer default 50
)
returns table(
  id uuid, user_id uuid, category public.ping_category, title text, body text,
  place_label text, confirmation_count integer, comment_count integer,
  created_at timestamptz, expires_at timestamptz, distance_meters double precision
)
language sql
stable
security definer
set search_path = 'public'
as $function$
  with params as (
    select st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography as viewer_location,
           least(greatest(coalesce(radius_meters, 1609), 100), 8047) as capped_radius,
           auth.uid() as viewer_user_id
  ),
  hidden_pings as (
    select h.ping_id from public.ping_hides h cross join params v where h.user_id = v.viewer_user_id
  ),
  blocked_users as (
    select b.blocked_id as user_id from public.blocks b cross join params v where b.blocker_id = v.viewer_user_id
    union
    select b.blocker_id as user_id from public.blocks b cross join params v where b.blocked_id = v.viewer_user_id
  ),
  candidates as (
    select p.id,p.user_id,p.category,p.title,p.body,p.place_label,p.confirmation_count,p.comment_count,p.created_at,p.expires_at,
      case
        when p.location_precision = 'exact'::public.location_precision then p.location::geometry
        when v.viewer_user_id is not null and p.user_id = v.viewer_user_id then p.location::geometry
        else st_translate(p.location::geometry, 0.002, 0.002)
      end as display_location
    from public.pings p cross join params v
    where p.status = 'active' and p.expires_at > now()
      and not exists (select 1 from hidden_pings h where h.ping_id = p.id)
      and not exists (select 1 from blocked_users b where b.user_id = p.user_id)
      and st_dwithin(p.location, v.viewer_location, v.capped_radius + 400)
  )
  select p.id,p.user_id,p.category,p.title,p.body,p.place_label,p.confirmation_count,p.comment_count,p.created_at,p.expires_at,
         st_distance(p.display_location::geography, v.viewer_location) as distance_meters
  from candidates p cross join params v
  where st_dwithin(p.display_location::geography, v.viewer_location, v.capped_radius)
  order by p.created_at desc
  limit greatest(0, least(coalesce(result_limit, 50), 100));
$function$;

create or replace function public.nearby_map_pings(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_meters integer default 1609,
  result_limit integer default 100
)
returns table(
  id uuid, user_id uuid, category public.ping_category, title text, body text,
  place_label text, confirmation_count integer, comment_count integer,
  created_at timestamptz, expires_at timestamptz, distance_meters double precision,
  map_lat double precision, map_lng double precision
)
language sql
stable
security definer
set search_path = 'public'
as $function$
  with params as (
    select st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography as viewer_location,
           least(greatest(coalesce(radius_meters, 1609), 100), 8047) as capped_radius,
           auth.uid() as viewer_user_id
  ),
  hidden_pings as (
    select h.ping_id from public.ping_hides h cross join params v where h.user_id = v.viewer_user_id
  ),
  blocked_users as (
    select b.blocked_id as user_id from public.blocks b cross join params v where b.blocker_id = v.viewer_user_id
    union
    select b.blocker_id as user_id from public.blocks b cross join params v where b.blocked_id = v.viewer_user_id
  ),
  candidates as (
    select p.id,p.user_id,p.category,p.title,p.body,p.place_label,p.confirmation_count,p.comment_count,p.created_at,p.expires_at,
      case
        when p.location_precision = 'exact'::public.location_precision then p.location::geometry
        when v.viewer_user_id is not null and p.user_id = v.viewer_user_id then p.location::geometry
        else st_translate(p.location::geometry, 0.002, 0.002)
      end as display_location
    from public.pings p cross join params v
    where p.status = 'active' and p.expires_at > now()
      and not exists (select 1 from hidden_pings h where h.ping_id = p.id)
      and not exists (select 1 from blocked_users b where b.user_id = p.user_id)
      and st_dwithin(p.location, v.viewer_location, v.capped_radius + 400)
  )
  select p.id,p.user_id,p.category,p.title,p.body,p.place_label,p.confirmation_count,p.comment_count,p.created_at,p.expires_at,
         st_distance(p.display_location::geography, v.viewer_location) as distance_meters,
         st_y(p.display_location) as map_lat, st_x(p.display_location) as map_lng
  from candidates p cross join params v
  where st_dwithin(p.display_location::geography, v.viewer_location, v.capped_radius)
  order by p.created_at desc
  limit greatest(0, least(coalesce(result_limit, 100), 100));
$function$;

create or replace function public.get_own_ping_edit(target_ping_id uuid)
returns table(
  id uuid, category public.ping_category, title text, body text, created_at timestamptz,
  expires_at timestamptz, deal_source text, deal_kind text, merchant_name text,
  marketplace_type text, marketplace_intent text, marketplace_subtype text,
  marketplace_price numeric, marketplace_price_period text, marketplace_currency text,
  marketplace_url text, location_precision public.location_precision,
  location_lat double precision, location_lng double precision
)
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $function$
  select p.id,p.category,p.title,p.body,p.created_at,p.expires_at,p.deal_source,p.deal_kind,p.merchant_name,
         p.marketplace_type,p.marketplace_intent,p.marketplace_subtype,p.marketplace_price,p.marketplace_price_period,p.marketplace_currency,p.marketplace_url,
         p.location_precision,
         case when p.location_precision='approximate'::public.location_precision then st_y(st_translate(p.location::geometry,0.002,0.002)) else st_y(p.location::geometry) end,
         case when p.location_precision='approximate'::public.location_precision then st_x(st_translate(p.location::geometry,0.002,0.002)) else st_x(p.location::geometry) end
  from public.pings p
  where auth.uid() is not null and p.user_id=auth.uid() and p.id=target_ping_id and p.status='active' and p.expires_at>now();
$function$;

revoke all on function public.get_own_ping_edit(uuid) from public, anon;
grant execute on function public.get_own_ping_edit(uuid) to authenticated, service_role;

create or replace function public.update_own_ping_v2(
  target_ping_id uuid, new_title text, new_body text, new_expires_in_hours integer default null,
  new_deal_source text default null, new_deal_kind text default null, new_merchant_name text default null,
  new_marketplace_type text default null, new_marketplace_intent text default null, new_marketplace_subtype text default null,
  new_marketplace_price numeric default null, new_marketplace_price_period text default null,
  new_marketplace_currency text default null, new_marketplace_url text default null,
  new_location_precision text default null, new_lat double precision default null, new_lng double precision default null
)
returns boolean
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  current_precision public.location_precision;
  current_location geography(point,4326);
  next_precision text;
  next_location geography(point,4326);
  resolved_place text;
  center_lat double precision;
  center_lng double precision;
  cell_key text;
begin
  perform public.update_own_ping(target_ping_id,new_title,new_body,new_expires_in_hours,new_deal_source,new_deal_kind,new_merchant_name,
    new_marketplace_type,new_marketplace_intent,new_marketplace_subtype,new_marketplace_price,new_marketplace_price_period,new_marketplace_currency,new_marketplace_url);

  select p.location_precision,p.location into current_precision,current_location
  from public.pings p where p.id=target_ping_id and p.user_id=auth.uid() for update;

  if (new_lat is null) <> (new_lng is null) then raise exception 'Choose both latitude and longitude for a new Ping point'; end if;
  next_precision := lower(coalesce(nullif(trim(new_location_precision),''),current_precision::text));
  if next_precision='private' then next_precision:='approximate'; end if;
  if next_precision not in ('approximate','exact') then raise exception 'Choose Private location or Exact location'; end if;
  if new_lat is null and new_lng is null and next_precision=current_precision::text then return true; end if;
  if next_precision='exact' and current_precision='approximate'::public.location_precision and new_lat is null then
    raise exception 'Choose the exact point on the map before making this Ping exact';
  end if;

  if new_lat is not null then
    if new_lat < -90 or new_lat > 90 or new_lng < -180 or new_lng > 180 then raise exception 'Invalid Ping location'; end if;
    next_location := st_setsrid(st_makepoint(new_lng,new_lat),4326)::geography;
    center_lat := floor(new_lat/0.004)*0.004+0.002;
    center_lng := floor(new_lng/0.004)*0.004+0.002;
    cell_key := to_char(round(center_lat::numeric,3),'FM999990.000')||':'||to_char(round(center_lng::numeric,3),'FM999990.000');
    select pc.display_label into resolved_place from public.place_cells pc where pc.grid_key=cell_key and pc.refreshed_at>now()-interval '30 days';
  else
    next_location := current_location;
  end if;

  update public.pings
  set location=next_location, location_precision=next_precision::public.location_precision,
      place_label=coalesce(left(nullif(trim(resolved_place),''),120),place_label), updated_at=now()
  where id=target_ping_id and user_id=auth.uid();
  return true;
end;
$function$;

revoke all on function public.update_own_ping_v2(uuid,text,text,integer,text,text,text,text,text,text,numeric,text,text,text,text,double precision,double precision) from public, anon;
grant execute on function public.update_own_ping_v2(uuid,text,text,integer,text,text,text,text,text,text,numeric,text,text,text,text,double precision,double precision) to authenticated, service_role;

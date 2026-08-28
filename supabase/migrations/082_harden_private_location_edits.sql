-- Keep the privacy invariant true during edits: any pin marked approximate/private
-- must store only a snapped neighbourhood-scale point, never an exact coordinate.
create or replace function public.update_own_ping_v2(
  target_ping_id uuid,
  new_title text,
  new_body text,
  new_expires_in_hours integer default null,
  new_deal_source text default null,
  new_deal_kind text default null,
  new_merchant_name text default null,
  new_marketplace_type text default null,
  new_marketplace_intent text default null,
  new_marketplace_subtype text default null,
  new_marketplace_price numeric default null,
  new_marketplace_price_period text default null,
  new_marketplace_currency text default null,
  new_marketplace_url text default null,
  new_location_precision text default null,
  new_lat double precision default null,
  new_lng double precision default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
  perform public.update_own_ping(
    target_ping_id,
    new_title,
    new_body,
    new_expires_in_hours,
    new_deal_source,
    new_deal_kind,
    new_merchant_name,
    new_marketplace_type,
    new_marketplace_intent,
    new_marketplace_subtype,
    new_marketplace_price,
    new_marketplace_price_period,
    new_marketplace_currency,
    new_marketplace_url
  );

  select p.location_precision, p.location into current_precision, current_location
  from public.pings p
  where p.id = target_ping_id and p.user_id = auth.uid()
  for update;

  if (new_lat is null) <> (new_lng is null) then
    raise exception 'Choose both latitude and longitude for a new Ping point';
  end if;

  next_precision := lower(coalesce(nullif(trim(new_location_precision), ''), current_precision::text));
  if next_precision = 'private' then next_precision := 'approximate'; end if;
  if next_precision not in ('approximate','exact') then
    raise exception 'Choose Private location or Exact location';
  end if;

  if new_lat is null and new_lng is null and next_precision = current_precision::text then
    return true;
  end if;

  if next_precision = 'exact' and current_precision = 'approximate'::public.location_precision and new_lat is null then
    raise exception 'Choose the exact point on the map before making this Ping exact';
  end if;

  if new_lat is not null then
    if new_lat < -90 or new_lat > 90 or new_lng < -180 or new_lng > 180 then
      raise exception 'Invalid Ping location';
    end if;

    if next_precision = 'approximate' then
      next_location := st_snaptogrid(st_setsrid(st_makepoint(new_lng, new_lat),4326), 0.004)::geography;
    else
      next_location := st_setsrid(st_makepoint(new_lng, new_lat),4326)::geography;
    end if;

    center_lat := floor(new_lat / 0.004) * 0.004 + 0.002;
    center_lng := floor(new_lng / 0.004) * 0.004 + 0.002;
    cell_key := to_char(round(center_lat::numeric,3),'FM999990.000') || ':' || to_char(round(center_lng::numeric,3),'FM999990.000');
    select pc.display_label into resolved_place
    from public.place_cells pc
    where pc.grid_key = cell_key and pc.refreshed_at > now() - interval '30 days';
  else
    if next_precision = 'approximate' then
      next_location := st_snaptogrid(current_location::geometry, 0.004)::geography;
    else
      next_location := current_location;
    end if;
  end if;

  update public.pings
  set location = next_location,
      location_precision = next_precision::public.location_precision,
      place_label = coalesce(left(nullif(trim(resolved_place),''),120), place_label),
      updated_at = now()
  where id = target_ping_id and user_id = auth.uid();

  return true;
end;
$$;

revoke all on function public.update_own_ping_v2(uuid,text,text,integer,text,text,text,text,text,text,numeric,text,text,text,text,double precision,double precision) from public;
grant execute on function public.update_own_ping_v2(uuid,text,text,integer,text,text,text,text,text,text,numeric,text,text,text,text,double precision,double precision) to authenticated;

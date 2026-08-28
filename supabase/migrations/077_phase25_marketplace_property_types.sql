-- Consolidate Marketplace parking spaces under Property and add Business listings.
-- Keep legacy marketplace_type='parking_space' accepted internally during preview transition.

alter table public.pings drop constraint if exists pings_marketplace_subtype_check;

update public.pings
set marketplace_type = 'property', marketplace_subtype = 'parking_space'
where category = 'marketplace'::public.ping_category
  and marketplace_type = 'parking_space';

alter table public.pings
  add constraint pings_marketplace_subtype_check check (
    marketplace_subtype is null or
    (marketplace_type = 'property' and marketplace_subtype in ('house','flat','room','land','warehouse','commercial','garage','parking_space','business','other')) or
    (marketplace_type = 'vehicle' and marketplace_subtype in ('car','van','motorbike','bicycle','other')) or
    (marketplace_type = 'parking_space' and marketplace_subtype = 'parking_space')
  );

create or replace function public.create_ping_v3(
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
  ping_marketplace_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_id uuid;
  approximate_location geography(point,4326);
  resolved_place text;
  center_lat double precision;
  center_lng double precision;
  cell_key text;
  requested_hours integer;
  category_max_hours integer;
  effective_hours integer;
  clean_source text;
  clean_kind text;
  clean_merchant text;
  clean_market_type text;
  clean_market_intent text;
  clean_market_subtype text;
  clean_market_period text;
  clean_market_currency text;
  clean_market_url text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if ping_lat is null or ping_lng is null or ping_lat < -90 or ping_lat > 90 or ping_lng < -180 or ping_lng > 180 then raise exception 'Invalid Ping location'; end if;

  requested_hours := greatest(coalesce(ping_expires_in_hours, 24), 1);
  category_max_hours := case ping_category
    when 'alert'::public.ping_category then 24
    when 'traffic'::public.ping_category then 24
    when 'parking'::public.ping_category then 24
    when 'outages'::public.ping_category then 48
    when 'lost_found'::public.ping_category then 168
    when 'marketplace'::public.ping_category then 720
    else 72
  end;
  effective_hours := least(requested_hours, category_max_hours);

  if ping_category = 'deals'::public.ping_category then
    clean_source := coalesce(nullif(trim(ping_deal_source), ''), 'spotted');
    clean_kind := coalesce(nullif(trim(ping_deal_kind), ''), 'offer');
    clean_merchant := left(nullif(trim(ping_merchant_name), ''), 120);
    if clean_source not in ('spotted','business') then raise exception 'Invalid deal source'; end if;
    if clean_kind not in ('offer','new_in','restock','clearance','limited_time') then raise exception 'Invalid deal kind'; end if;
    if clean_merchant is null or char_length(clean_merchant) < 2 then raise exception 'Business or shop name required for Deals'; end if;
  else
    clean_source := null; clean_kind := null; clean_merchant := null;
  end if;

  if ping_category = 'marketplace'::public.ping_category then
    clean_market_type := nullif(trim(ping_marketplace_type), '');
    clean_market_intent := nullif(trim(ping_marketplace_intent), '');
    clean_market_subtype := nullif(trim(ping_marketplace_subtype), '');
    clean_market_url := left(nullif(trim(ping_marketplace_url), ''), 500);

    if clean_market_type = 'parking_space' then
      clean_market_type := 'property';
      clean_market_subtype := 'parking_space';
    end if;

    if clean_market_type not in ('property','vehicle') then raise exception 'Choose Property or Vehicles'; end if;
    if clean_market_intent not in ('sale','rent','wanted') then raise exception 'Choose For sale, For rent or Wanted'; end if;
    if clean_market_type = 'property' and clean_market_subtype not in ('house','flat','room','land','warehouse','commercial','garage','parking_space','business','other') then raise exception 'Invalid property type'; end if;
    if clean_market_type = 'vehicle' and clean_market_subtype not in ('car','van','motorbike','bicycle','other') then raise exception 'Invalid vehicle type'; end if;

    if ping_marketplace_price is not null and (ping_marketplace_price < 0 or ping_marketplace_price > 999999999.99) then raise exception 'Invalid marketplace price'; end if;
    if ping_marketplace_price is not null then
      clean_market_period := coalesce(nullif(trim(ping_marketplace_price_period), ''), case when clean_market_intent = 'rent' then 'month' else 'total' end);
      clean_market_currency := upper(coalesce(nullif(trim(ping_marketplace_currency), ''), 'GBP'));
      if clean_market_period not in ('total','month','week','day','hour') then raise exception 'Invalid price period'; end if;
      if clean_market_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid currency'; end if;
    else
      clean_market_period := null; clean_market_currency := null;
    end if;
    if clean_market_url is not null and clean_market_url !~* '^https?://' then raise exception 'Listing link must start with http:// or https://'; end if;
  else
    clean_market_type := null; clean_market_intent := null; clean_market_subtype := null;
    clean_market_period := null; clean_market_currency := null; clean_market_url := null; ping_marketplace_price := null;
  end if;

  approximate_location := st_snaptogrid(st_setsrid(st_makepoint(ping_lng, ping_lat), 4326), 0.004)::geography;
  center_lat := floor(ping_lat / 0.004) * 0.004 + 0.002;
  center_lng := floor(ping_lng / 0.004) * 0.004 + 0.002;
  cell_key := to_char(round(center_lat::numeric, 3), 'FM999990.000') || ':' || to_char(round(center_lng::numeric, 3), 'FM999990.000');
  select pc.display_label into resolved_place from public.place_cells pc where pc.grid_key = cell_key and pc.refreshed_at > now() - interval '30 days';
  resolved_place := coalesce(left(nullif(trim(resolved_place), ''), 120), left(nullif(trim(ping_place_label), ''), 120), 'Nearby');

  insert into public.pings (user_id, category, title, body, location, location_precision, place_label, expires_at, deal_source, deal_kind, merchant_name, marketplace_type, marketplace_intent, marketplace_subtype, marketplace_price, marketplace_price_period, marketplace_currency, marketplace_url)
  values (auth.uid(), ping_category, ping_title, ping_body, approximate_location, 'approximate', resolved_place, now() + make_interval(hours => effective_hours), clean_source, clean_kind, clean_merchant, clean_market_type, clean_market_intent, clean_market_subtype, ping_marketplace_price, clean_market_period, clean_market_currency, clean_market_url)
  returning id into created_id;
  return created_id;
end;
$$;

revoke all on function public.create_ping_v3(public.ping_category,text,text,double precision,double precision,text,integer,text,text,text,text,text,text,numeric,text,text,text) from public, anon;
grant execute on function public.create_ping_v3(public.ping_category,text,text,double precision,double precision,text,integer,text,text,text,text,text,text,numeric,text,text,text) to authenticated, service_role;

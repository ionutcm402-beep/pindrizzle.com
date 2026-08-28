-- Phase 25.5: allow owners to edit their own active Ping without changing its public location.
-- Editing is blocked while a promotion is pending/approved/active/paused.

create or replace function public.update_own_ping(
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
  new_marketplace_url text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  current_category public.ping_category;
  current_created_at timestamptz;
  current_expires_at timestamptz;
  max_hours integer;
  requested_hours integer;
  next_expires_at timestamptz;
  clean_title text;
  clean_body text;
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
  if me is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select p.category, p.created_at, p.expires_at
    into current_category, current_created_at, current_expires_at
  from public.pings p
  where p.id = target_ping_id and p.user_id = me and p.status = 'active' and p.expires_at > now()
  for update;

  if not found then raise exception 'Only your active Ping can be edited' using errcode = 'P0002'; end if;

  if exists(
    select 1 from public.promotions pr
    where pr.ping_id = target_ping_id
      and pr.promoter_user_id = me
      and pr.status in ('pending','approved','active','paused')
  ) then
    raise exception 'This Ping has a promotion in progress. Finish the promotion before editing it.' using errcode = '55000';
  end if;

  clean_title := trim(coalesce(new_title,''));
  clean_body := trim(coalesce(new_body,''));
  if char_length(clean_title) < 4 or char_length(clean_title) > 70 then raise exception 'Headline must be between 4 and 70 characters'; end if;
  if char_length(clean_body) < 6 or char_length(clean_body) > 280 then raise exception 'Details must be between 6 and 280 characters'; end if;

  max_hours := case current_category
    when 'alert'::public.ping_category then 24
    when 'traffic'::public.ping_category then 24
    when 'parking'::public.ping_category then 24
    when 'outages'::public.ping_category then 48
    when 'lost_found'::public.ping_category then 168
    when 'marketplace'::public.ping_category then 720
    else 72
  end;

  if new_expires_in_hours is null then
    next_expires_at := current_expires_at;
  else
    requested_hours := greatest(new_expires_in_hours, 1);
    next_expires_at := least(now() + make_interval(hours => requested_hours), current_created_at + make_interval(hours => max_hours));
    if next_expires_at <= now() then raise exception 'This Ping cannot be extended beyond its maximum lifetime'; end if;
  end if;

  if current_category = 'deals'::public.ping_category then
    clean_source := coalesce(nullif(trim(new_deal_source),''),'spotted');
    clean_kind := coalesce(nullif(trim(new_deal_kind),''),'offer');
    clean_merchant := left(nullif(trim(new_merchant_name),''),120);
    if clean_source not in ('spotted','business') then raise exception 'Invalid deal source'; end if;
    if clean_kind not in ('offer','new_in','restock','clearance','limited_time') then raise exception 'Invalid deal kind'; end if;
    if clean_merchant is null or char_length(clean_merchant) < 2 then raise exception 'Business or shop name required for Deals'; end if;
  else
    clean_source := null; clean_kind := null; clean_merchant := null;
  end if;

  if current_category = 'marketplace'::public.ping_category then
    clean_market_type := coalesce(nullif(trim(new_marketplace_type),''),'property');
    clean_market_intent := coalesce(nullif(trim(new_marketplace_intent),''),'rent');
    clean_market_subtype := nullif(trim(new_marketplace_subtype),'');
    clean_market_url := left(nullif(trim(new_marketplace_url),''),500);

    if clean_market_type not in ('property','vehicle','parking_space') then raise exception 'Invalid Marketplace type'; end if;
    if clean_market_intent not in ('sale','rent','wanted') then raise exception 'Invalid Marketplace intent'; end if;
    if clean_market_type = 'property' and clean_market_subtype not in ('house','flat','room','land','warehouse','commercial','garage','parking_space','business','other') then raise exception 'Invalid property type'; end if;
    if clean_market_type = 'vehicle' and clean_market_subtype not in ('car','van','motorbike','bicycle','other') then raise exception 'Invalid vehicle type'; end if;
    if clean_market_type = 'parking_space' then clean_market_subtype := 'parking_space'; end if;
    if new_marketplace_price is not null and (new_marketplace_price < 0 or new_marketplace_price > 999999999.99) then raise exception 'Invalid Marketplace price'; end if;

    if new_marketplace_price is not null then
      clean_market_period := coalesce(nullif(trim(new_marketplace_price_period),''), case when clean_market_intent='rent' then 'month' else 'total' end);
      clean_market_currency := upper(coalesce(nullif(trim(new_marketplace_currency),''),'GBP'));
      if clean_market_period not in ('total','month','week','day','hour') then raise exception 'Invalid price period'; end if;
      if clean_market_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid currency'; end if;
    else
      clean_market_period := null; clean_market_currency := null;
    end if;

    if clean_market_url is not null and clean_market_url !~* '^https?://' then raise exception 'Listing link must start with http:// or https://'; end if;
  else
    clean_market_type := null; clean_market_intent := null; clean_market_subtype := null;
    clean_market_period := null; clean_market_currency := null; clean_market_url := null; new_marketplace_price := null;
  end if;

  update public.pings
  set title = clean_title,
      body = clean_body,
      expires_at = next_expires_at,
      deal_source = clean_source,
      deal_kind = clean_kind,
      merchant_name = clean_merchant,
      marketplace_type = clean_market_type,
      marketplace_intent = clean_market_intent,
      marketplace_subtype = clean_market_subtype,
      marketplace_price = new_marketplace_price,
      marketplace_price_period = clean_market_period,
      marketplace_currency = clean_market_currency,
      marketplace_url = clean_market_url,
      updated_at = now()
  where id = target_ping_id and user_id = me;

  return true;
end;
$$;

revoke all on function public.update_own_ping(uuid,text,text,integer,text,text,text,text,text,text,numeric,text,text,text) from public, anon;
grant execute on function public.update_own_ping(uuid,text,text,integer,text,text,text,text,text,text,numeric,text,text,text) to authenticated, service_role;

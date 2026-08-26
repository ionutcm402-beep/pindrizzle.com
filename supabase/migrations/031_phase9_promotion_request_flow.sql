alter table public.promotions
  drop constraint if exists promotions_status_check;

alter table public.promotions
  add constraint promotions_status_check
  check (status in ('draft','pending','approved','active','paused','ended','rejected'));

alter table public.promotions
  add column if not exists target_radius_meters integer not null default 1609,
  add column if not exists duration_hours integer not null default 24,
  add column if not exists quoted_price_pence integer,
  add column if not exists currency text not null default 'GBP',
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists requested_at timestamptz not null default now();

alter table public.promotions
  drop constraint if exists promotions_target_radius_check,
  drop constraint if exists promotions_duration_check,
  drop constraint if exists promotions_price_check,
  drop constraint if exists promotions_currency_check,
  drop constraint if exists promotions_payment_status_check;

alter table public.promotions
  add constraint promotions_target_radius_check check (target_radius_meters in (805,1609,4828,8047)),
  add constraint promotions_duration_check check (duration_hours in (6,12,24)),
  add constraint promotions_price_check check (quoted_price_pence is null or quoted_price_pence > 0),
  add constraint promotions_currency_check check (currency = 'GBP'),
  add constraint promotions_payment_status_check check (payment_status in ('unpaid','paid','refunded','waived'));

create or replace function public.promotion_price_pence(
  target_radius_meters integer,
  duration_hours integer
)
returns integer
language plpgsql
immutable
security invoker
set search_path = public
as $$
begin
  if target_radius_meters not in (805,1609,4828,8047) or duration_hours not in (6,12,24) then
    raise exception 'Unsupported promotion configuration';
  end if;

  return case target_radius_meters
    when 805 then case duration_hours when 6 then 99 when 12 then 149 else 199 end
    when 1609 then case duration_hours when 6 then 149 when 12 then 199 else 299 end
    when 4828 then case duration_hours when 6 then 249 when 12 then 399 else 599 end
    when 8047 then case duration_hours when 6 then 349 when 12 then 549 else 899 end
  end;
end;
$$;

revoke all on function public.promotion_price_pence(integer, integer) from public;
grant execute on function public.promotion_price_pence(integer, integer) to authenticated;

create or replace function public.my_promotable_pings()
returns table (
  ping_id uuid,
  category public.ping_category,
  title text,
  body text,
  place_label text,
  created_at timestamptz,
  expires_at timestamptz,
  remaining_minutes integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.category,
    p.title,
    p.body,
    p.place_label,
    p.created_at,
    p.expires_at,
    greatest(0, floor(extract(epoch from (p.expires_at - now())) / 60))::integer
  from public.pings p
  where p.user_id = auth.uid()
    and p.status = 'active'
    and p.expires_at > now()
    and not exists (
      select 1 from public.promotions pr
      where pr.ping_id = p.id
        and pr.promoter_user_id = auth.uid()
        and pr.status in ('pending','approved','active','paused')
    )
  order by p.created_at desc;
$$;

revoke all on function public.my_promotable_pings() from public;
grant execute on function public.my_promotable_pings() to authenticated;

create or replace function public.submit_promotion_request(
  target_ping_id uuid,
  requested_sponsor_name text,
  requested_radius_meters integer,
  requested_duration_hours integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target_ping public.pings%rowtype;
  price_pence integer;
  promotion_id uuid;
begin
  if me is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(requested_sponsor_name,''))) not between 2 and 80 then
    raise exception 'Sponsor name must be between 2 and 80 characters';
  end if;

  select * into target_ping
  from public.pings p
  where p.id = target_ping_id
    and p.user_id = me
    and p.status = 'active'
    and p.expires_at > now();

  if not found then raise exception 'Ping is not available for promotion'; end if;

  if target_ping.expires_at < now() + make_interval(hours => requested_duration_hours) then
    raise exception 'This Ping expires before that promotion duration ends';
  end if;

  if exists (
    select 1 from public.promotions pr
    where pr.ping_id = target_ping_id
      and pr.promoter_user_id = me
      and pr.status in ('pending','approved','active','paused')
  ) then
    raise exception 'This Ping already has a current promotion request';
  end if;

  price_pence := public.promotion_price_pence(requested_radius_meters, requested_duration_hours);

  insert into public.promotions (
    ping_id,
    promoter_user_id,
    sponsor_name,
    status,
    starts_at,
    ends_at,
    target_radius_meters,
    duration_hours,
    quoted_price_pence,
    currency,
    payment_status,
    requested_at
  ) values (
    target_ping_id,
    me,
    trim(requested_sponsor_name),
    'pending',
    now(),
    now() + make_interval(hours => requested_duration_hours),
    requested_radius_meters,
    requested_duration_hours,
    price_pence,
    'GBP',
    'unpaid',
    now()
  ) returning id into promotion_id;

  return promotion_id;
end;
$$;

revoke all on function public.submit_promotion_request(uuid,text,integer,integer) from public;
grant execute on function public.submit_promotion_request(uuid,text,integer,integer) to authenticated;

create or replace function public.my_promotion_requests()
returns table (
  promotion_id uuid,
  ping_id uuid,
  ping_title text,
  sponsor_name text,
  status text,
  target_radius_meters integer,
  duration_hours integer,
  quoted_price_pence integer,
  currency text,
  payment_status text,
  requested_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pr.id,
    pr.ping_id,
    p.title,
    pr.sponsor_name,
    pr.status,
    pr.target_radius_meters,
    pr.duration_hours,
    pr.quoted_price_pence,
    pr.currency,
    pr.payment_status,
    pr.requested_at,
    pr.starts_at,
    pr.ends_at
  from public.promotions pr
  join public.pings p on p.id = pr.ping_id
  where pr.promoter_user_id = auth.uid()
  order by pr.requested_at desc;
$$;

revoke all on function public.my_promotion_requests() from public;
grant execute on function public.my_promotion_requests() to authenticated;

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
  with viewer as (
    select st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography as location
  )
  select
    pr.id as promotion_id,
    p.id as ping_id,
    p.user_id,
    p.category,
    p.title,
    p.body,
    p.place_label,
    p.confirmation_count,
    p.comment_count,
    p.created_at,
    p.expires_at,
    st_distance(p.location, v.location) as distance_meters,
    pr.sponsor_name,
    pr.ends_at as promoted_until
  from public.promotions pr
  join public.pings p on p.id = pr.ping_id
  cross join viewer v
  where pr.status = 'active'
    and pr.approved_at is not null
    and pr.payment_status in ('paid','waived')
    and pr.starts_at <= now()
    and pr.ends_at > now()
    and p.status = 'active'
    and p.expires_at > now()
    and st_dwithin(p.location, v.location, least(greatest(100, least(radius_meters, 8047)), pr.target_radius_meters))
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
  order by pr.priority desc, pr.starts_at asc, pr.id asc
  limit greatest(0, least(result_limit, 3));
$$;

revoke all on function public.nearby_promoted_pings(double precision,double precision,integer,integer) from public;
grant execute on function public.nearby_promoted_pings(double precision,double precision,integer,integer) to anon, authenticated;

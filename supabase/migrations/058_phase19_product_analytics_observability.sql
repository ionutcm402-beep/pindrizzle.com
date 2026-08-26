-- Phase 19: privacy-minimal product analytics and internal observability.

create table if not exists public.product_events (
  id bigint generated always as identity primary key,
  browser_session_id uuid not null,
  event_type text not null check (event_type in (
    'session_start','feed_view','map_view','search_view','place_view',
    'alerts_view','you_view','promote_view','business_view','ping_open',
    'onboarding_complete','onboarding_skip'
  )),
  signed_in boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.product_events enable row level security;
revoke all on table public.product_events from public, anon, authenticated;

create unique index if not exists product_events_session_event_uidx
  on public.product_events (browser_session_id, event_type);
create index if not exists product_events_created_at_idx
  on public.product_events (created_at desc);
create index if not exists product_events_event_created_idx
  on public.product_events (event_type, created_at desc);

create or replace function public.record_product_event(
  target_event_type text,
  browser_session uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if browser_session is null then
    raise exception 'Missing browser session';
  end if;

  if target_event_type not in (
    'session_start','feed_view','map_view','search_view','place_view',
    'alerts_view','you_view','promote_view','business_view','ping_open',
    'onboarding_complete','onboarding_skip'
  ) then
    raise exception 'Unsupported analytics event';
  end if;

  insert into public.product_events (browser_session_id, event_type, signed_in)
  values (browser_session, target_event_type, auth.uid() is not null)
  on conflict (browser_session_id, event_type) do update
    set signed_in = public.product_events.signed_in or excluded.signed_in;

  if target_event_type = 'session_start' then
    delete from public.product_events
    where created_at < now() - interval '90 days';
  end if;

  return true;
end;
$$;

revoke all on function public.record_product_event(text,uuid) from public;
grant execute on function public.record_product_event(text,uuid) to anon, authenticated;

create or replace function public.ops_product_summary(range_days integer default 7)
returns table (
  window_days integer,
  sessions bigint,
  signed_in_sessions bigint,
  feed_sessions bigint,
  map_sessions bigint,
  search_sessions bigint,
  ping_open_sessions bigint,
  new_profiles bigint,
  pings_created bigint,
  replies_created bigint,
  confirmations_created bigint,
  reports_created bigint,
  promotion_requests bigint,
  paid_promotions bigint,
  revenue_pence bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  d integer := least(greatest(coalesce(range_days, 7), 1), 90);
  since_at timestamptz := now() - make_interval(days => d);
begin
  if not public.is_moderator() then
    raise exception 'Operator access required';
  end if;

  return query
  select
    d,
    (select count(distinct pe.browser_session_id) from public.product_events pe where pe.event_type='session_start' and pe.created_at >= since_at),
    (select count(distinct pe.browser_session_id) from public.product_events pe where pe.signed_in and pe.created_at >= since_at),
    (select count(distinct pe.browser_session_id) from public.product_events pe where pe.event_type='feed_view' and pe.created_at >= since_at),
    (select count(distinct pe.browser_session_id) from public.product_events pe where pe.event_type='map_view' and pe.created_at >= since_at),
    (select count(distinct pe.browser_session_id) from public.product_events pe where pe.event_type='search_view' and pe.created_at >= since_at),
    (select count(distinct pe.browser_session_id) from public.product_events pe where pe.event_type='ping_open' and pe.created_at >= since_at),
    (select count(*) from public.profiles p where p.created_at >= since_at),
    (select count(*) from public.pings p where p.created_at >= since_at),
    (select count(*) from public.comments c where c.created_at >= since_at),
    (select count(*) from public.confirmations c where c.created_at >= since_at),
    (select count(*) from public.reports r where r.created_at >= since_at),
    (select count(*) from public.promotions pr where pr.requested_at >= since_at),
    (select count(*) from public.promotions pr where pr.paid_at >= since_at and pr.payment_status='paid'),
    (select coalesce(sum(pr.quoted_price_pence),0)::bigint from public.promotions pr where pr.paid_at >= since_at and pr.payment_status='paid');
end;
$$;

create or replace function public.ops_daily_metrics(range_days integer default 14)
returns table (
  metric_day date,
  sessions bigint,
  signed_in_sessions bigint,
  new_profiles bigint,
  pings_created bigint,
  replies_created bigint,
  confirmations_created bigint,
  reports_created bigint,
  promotion_requests bigint,
  paid_promotions bigint,
  revenue_pence bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  d integer := least(greatest(coalesce(range_days, 14), 1), 90);
begin
  if not public.is_moderator() then
    raise exception 'Operator access required';
  end if;

  return query
  with days as (
    select generate_series(
      (current_date - (d - 1)),
      current_date,
      interval '1 day'
    )::date as day
  )
  select
    days.day,
    (select count(distinct pe.browser_session_id) from public.product_events pe where pe.event_type='session_start' and pe.created_at >= days.day and pe.created_at < days.day + 1),
    (select count(distinct pe.browser_session_id) from public.product_events pe where pe.signed_in and pe.created_at >= days.day and pe.created_at < days.day + 1),
    (select count(*) from public.profiles p where p.created_at >= days.day and p.created_at < days.day + 1),
    (select count(*) from public.pings p where p.created_at >= days.day and p.created_at < days.day + 1),
    (select count(*) from public.comments c where c.created_at >= days.day and c.created_at < days.day + 1),
    (select count(*) from public.confirmations c where c.created_at >= days.day and c.created_at < days.day + 1),
    (select count(*) from public.reports r where r.created_at >= days.day and r.created_at < days.day + 1),
    (select count(*) from public.promotions pr where pr.requested_at >= days.day and pr.requested_at < days.day + 1),
    (select count(*) from public.promotions pr where pr.paid_at >= days.day and pr.paid_at < days.day + 1 and pr.payment_status='paid'),
    (select coalesce(sum(pr.quoted_price_pence),0)::bigint from public.promotions pr where pr.paid_at >= days.day and pr.paid_at < days.day + 1 and pr.payment_status='paid')
  from days
  order by days.day;
end;
$$;

create or replace function public.ops_health_snapshot()
returns table (
  live_pings bigint,
  open_report_cases bigint,
  report_cases_over_24h bigint,
  pending_promotions bigint,
  active_promotions bigint,
  promotion_anomalies bigint,
  active_push_devices bigint,
  notifications_24h bigint,
  push_attempts_24h bigint,
  push_delivered_24h bigint,
  push_failed_24h bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Operator access required';
  end if;

  return query
  select
    (select count(*) from public.pings p where p.status='active' and p.expires_at > now()),
    (select count(distinct r.ping_id) from public.reports r left join public.report_reviews rr on rr.report_id=r.id where rr.report_id is null),
    (select count(distinct r.ping_id) from public.reports r left join public.report_reviews rr on rr.report_id=r.id where rr.report_id is null and r.created_at < now() - interval '24 hours'),
    (select count(*) from public.promotions pr where pr.status='pending'),
    (select count(*) from public.promotions pr where pr.status='active' and pr.ends_at > now()),
    (select count(*) from public.promotions pr join public.pings p on p.id=pr.ping_id where pr.status='active' and (pr.payment_status not in ('paid','waived') or pr.ends_at <= now() or p.status <> 'active' or p.expires_at <= now())),
    (select count(*) from public.push_subscriptions ps where ps.disabled_at is null),
    (select count(*) from public.notifications n where n.created_at >= now() - interval '24 hours'),
    (select count(*) from public.push_delivery_attempts a where a.last_attempt_at >= now() - interval '24 hours'),
    (select count(*) from public.push_delivery_attempts a where a.delivered_at >= now() - interval '24 hours'),
    (select count(*) from public.push_delivery_attempts a where a.last_attempt_at >= now() - interval '24 hours' and a.delivered_at is null and a.last_error is not null);
end;
$$;

revoke all on function public.ops_product_summary(integer) from public, anon;
revoke all on function public.ops_daily_metrics(integer) from public, anon;
revoke all on function public.ops_health_snapshot() from public, anon;
grant execute on function public.ops_product_summary(integer) to authenticated;
grant execute on function public.ops_daily_metrics(integer) to authenticated;
grant execute on function public.ops_health_snapshot() to authenticated;

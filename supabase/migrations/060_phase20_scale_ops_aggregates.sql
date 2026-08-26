-- Phase 20: keep internal observability cheap as event/community tables grow.

create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists pings_created_at_idx on public.pings (created_at desc);
create index if not exists comments_created_at_idx on public.comments (created_at desc);
create index if not exists confirmations_created_at_idx on public.confirmations (created_at desc);
create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists promotions_requested_at_idx on public.promotions (requested_at desc);
create index if not exists promotions_paid_at_idx on public.promotions (paid_at desc) where paid_at is not null;
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);
create index if not exists push_delivery_attempts_last_attempt_idx on public.push_delivery_attempts (last_attempt_at desc) where last_attempt_at is not null;
create index if not exists push_delivery_attempts_delivered_at_idx on public.push_delivery_attempts (delivered_at desc) where delivered_at is not null;

create or replace function public.ops_product_summary(range_days integer default 7)
returns table(
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
  with product as (
    select
      count(distinct pe.browser_session_id) filter (where pe.event_type='session_start') as sessions,
      count(distinct pe.browser_session_id) filter (where pe.signed_in) as signed_in_sessions,
      count(distinct pe.browser_session_id) filter (where pe.event_type='feed_view') as feed_sessions,
      count(distinct pe.browser_session_id) filter (where pe.event_type='map_view') as map_sessions,
      count(distinct pe.browser_session_id) filter (where pe.event_type='search_view') as search_sessions,
      count(distinct pe.browser_session_id) filter (where pe.event_type='ping_open') as ping_open_sessions
    from public.product_events pe
    where pe.created_at >= since_at
  ),
  paid as (
    select
      count(*)::bigint as paid_promotions,
      coalesce(sum(pr.quoted_price_pence),0)::bigint as revenue_pence
    from public.promotions pr
    where pr.paid_at >= since_at
      and pr.payment_status='paid'
  )
  select
    d,
    product.sessions,
    product.signed_in_sessions,
    product.feed_sessions,
    product.map_sessions,
    product.search_sessions,
    product.ping_open_sessions,
    (select count(*) from public.profiles p where p.created_at >= since_at),
    (select count(*) from public.pings p where p.created_at >= since_at),
    (select count(*) from public.comments c where c.created_at >= since_at),
    (select count(*) from public.confirmations c where c.created_at >= since_at),
    (select count(*) from public.reports r where r.created_at >= since_at),
    (select count(*) from public.promotions pr where pr.requested_at >= since_at),
    paid.paid_promotions,
    paid.revenue_pence
  from product
  cross join paid;
end;
$$;

create or replace function public.ops_daily_metrics(range_days integer default 14)
returns table(
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
  first_day date := current_date - (d - 1);
begin
  if not public.is_moderator() then
    raise exception 'Operator access required';
  end if;

  return query
  with days as (
    select generate_series(first_day, current_date, interval '1 day')::date as day
  ),
  product as (
    select
      pe.created_at::date as day,
      count(distinct pe.browser_session_id) filter (where pe.event_type='session_start') as sessions,
      count(distinct pe.browser_session_id) filter (where pe.signed_in) as signed_in_sessions
    from public.product_events pe
    where pe.created_at >= first_day
    group by pe.created_at::date
  ),
  profiles_by_day as (
    select p.created_at::date as day, count(*)::bigint as cnt
    from public.profiles p where p.created_at >= first_day group by p.created_at::date
  ),
  pings_by_day as (
    select p.created_at::date as day, count(*)::bigint as cnt
    from public.pings p where p.created_at >= first_day group by p.created_at::date
  ),
  replies_by_day as (
    select c.created_at::date as day, count(*)::bigint as cnt
    from public.comments c where c.created_at >= first_day group by c.created_at::date
  ),
  confirmations_by_day as (
    select c.created_at::date as day, count(*)::bigint as cnt
    from public.confirmations c where c.created_at >= first_day group by c.created_at::date
  ),
  reports_by_day as (
    select r.created_at::date as day, count(*)::bigint as cnt
    from public.reports r where r.created_at >= first_day group by r.created_at::date
  ),
  promotion_requests_by_day as (
    select pr.requested_at::date as day, count(*)::bigint as cnt
    from public.promotions pr where pr.requested_at >= first_day group by pr.requested_at::date
  ),
  paid_by_day as (
    select
      pr.paid_at::date as day,
      count(*)::bigint as cnt,
      coalesce(sum(pr.quoted_price_pence),0)::bigint as revenue
    from public.promotions pr
    where pr.paid_at >= first_day and pr.payment_status='paid'
    group by pr.paid_at::date
  )
  select
    days.day,
    coalesce(product.sessions,0),
    coalesce(product.signed_in_sessions,0),
    coalesce(profiles_by_day.cnt,0),
    coalesce(pings_by_day.cnt,0),
    coalesce(replies_by_day.cnt,0),
    coalesce(confirmations_by_day.cnt,0),
    coalesce(reports_by_day.cnt,0),
    coalesce(promotion_requests_by_day.cnt,0),
    coalesce(paid_by_day.cnt,0),
    coalesce(paid_by_day.revenue,0)
  from days
  left join product on product.day=days.day
  left join profiles_by_day on profiles_by_day.day=days.day
  left join pings_by_day on pings_by_day.day=days.day
  left join replies_by_day on replies_by_day.day=days.day
  left join confirmations_by_day on confirmations_by_day.day=days.day
  left join reports_by_day on reports_by_day.day=days.day
  left join promotion_requests_by_day on promotion_requests_by_day.day=days.day
  left join paid_by_day on paid_by_day.day=days.day
  order by days.day;
end;
$$;

create or replace function public.ops_health_snapshot()
returns table(
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
  with report_health as (
    select
      count(distinct r.ping_id)::bigint as open_cases,
      count(distinct r.ping_id) filter (where r.created_at < now() - interval '24 hours')::bigint as old_cases
    from public.reports r
    left join public.report_reviews rr on rr.report_id=r.id
    where rr.report_id is null
  ),
  promotion_health as (
    select
      count(*) filter (where pr.status='pending')::bigint as pending_count,
      count(*) filter (where pr.status='active' and pr.ends_at > now())::bigint as active_count,
      count(*) filter (
        where pr.status='active'
          and (pr.payment_status not in ('paid','waived') or pr.ends_at <= now() or p.status <> 'active' or p.expires_at <= now())
      )::bigint as anomaly_count
    from public.promotions pr
    left join public.pings p on p.id=pr.ping_id
  ),
  push_health as (
    select
      count(*) filter (where a.last_attempt_at >= now() - interval '24 hours')::bigint as attempts,
      count(*) filter (where a.delivered_at >= now() - interval '24 hours')::bigint as delivered,
      count(*) filter (
        where a.last_attempt_at >= now() - interval '24 hours'
          and a.delivered_at is null
          and a.last_error is not null
      )::bigint as failed
    from public.push_delivery_attempts a
    where a.last_attempt_at >= now() - interval '24 hours'
       or a.delivered_at >= now() - interval '24 hours'
  )
  select
    (select count(*) from public.pings p where p.status='active' and p.expires_at > now()),
    report_health.open_cases,
    report_health.old_cases,
    promotion_health.pending_count,
    promotion_health.active_count,
    promotion_health.anomaly_count,
    (select count(*) from public.push_subscriptions ps where ps.disabled_at is null),
    (select count(*) from public.notifications n where n.created_at >= now() - interval '24 hours'),
    push_health.attempts,
    push_health.delivered,
    push_health.failed
  from report_health
  cross join promotion_health
  cross join push_health;
end;
$$;

revoke all on function public.ops_product_summary(integer) from public, anon;
grant execute on function public.ops_product_summary(integer) to authenticated;
revoke all on function public.ops_daily_metrics(integer) from public, anon;
grant execute on function public.ops_daily_metrics(integer) to authenticated;
revoke all on function public.ops_health_snapshot() from public, anon;
grant execute on function public.ops_health_snapshot() to authenticated;

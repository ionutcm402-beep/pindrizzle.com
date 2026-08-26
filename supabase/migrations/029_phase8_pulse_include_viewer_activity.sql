create or replace function public.retention_nearby_activity_pulse(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_meters integer default 1609
)
returns table (
  unusually_active boolean,
  recent_pings integer,
  baseline_pings integer,
  distinct_authors integer,
  leading_category public.ping_category,
  leading_category_count integer,
  window_minutes integer
)
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography as location
  ),
  visible as (
    select p.*
    from public.pings p
    cross join viewer v
    where p.status = 'active'
      and p.expires_at > now()
      and st_dwithin(p.location, v.location, least(greatest(radius_meters, 250), 8047))
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = p.user_id)
           or (b.blocker_id = p.user_id and b.blocked_id = auth.uid())
      )
  ),
  recent as (
    select * from visible where created_at >= now() - interval '30 minutes'
  ),
  baseline as (
    select * from visible
    where created_at < now() - interval '30 minutes'
      and created_at >= now() - interval '120 minutes'
  ),
  recent_stats as (
    select count(*)::integer as cnt, count(distinct user_id)::integer as authors from recent
  ),
  baseline_stats as (
    select count(*)::integer as cnt from baseline
  ),
  category_rank as (
    select category, count(*)::integer as cnt
    from recent
    group by category
    order by count(*) desc, category::text
    limit 1
  )
  select
    (
      rs.cnt >= 3
      and rs.authors >= 2
      and rs.cnt >= greatest(3, ceil((bs.cnt::numeric / 3.0) * 1.8)::integer)
    ) as unusually_active,
    rs.cnt,
    bs.cnt,
    rs.authors,
    cr.category,
    coalesce(cr.cnt, 0),
    30
  from recent_stats rs
  cross join baseline_stats bs
  left join category_rank cr on true;
$$;

revoke all on function public.retention_nearby_activity_pulse(double precision, double precision, integer) from public, anon;
grant execute on function public.retention_nearby_activity_pulse(double precision, double precision, integer) to authenticated;

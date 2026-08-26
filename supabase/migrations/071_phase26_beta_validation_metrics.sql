-- Phase 26: privacy-light beta validation metrics.
-- One event per browser session per milestone. No IP, coordinate or user timeline data is added.

alter table public.product_events
  drop constraint if exists product_events_event_type_check;

alter table public.product_events
  add constraint product_events_event_type_check check (
    event_type = any (array[
      'session_start'::text,
      'feed_view'::text,
      'map_view'::text,
      'search_view'::text,
      'place_view'::text,
      'alerts_view'::text,
      'you_view'::text,
      'promote_view'::text,
      'business_view'::text,
      'ping_open'::text,
      'onboarding_complete'::text,
      'onboarding_skip'::text,
      'return_visit'::text,
      'location_enabled'::text,
      'quiet_feed_seen'::text,
      'quiet_expand_radius'::text,
      'quiet_open_map'::text,
      'quiet_create_ping'::text
    ])
  );

create or replace function public.record_product_event(target_event_type text, browser_session uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if browser_session is null then
    raise exception 'Missing browser session';
  end if;

  if target_event_type not in (
    'session_start','feed_view','map_view','search_view','place_view',
    'alerts_view','you_view','promote_view','business_view','ping_open',
    'onboarding_complete','onboarding_skip','return_visit','location_enabled',
    'quiet_feed_seen','quiet_expand_radius','quiet_open_map','quiet_create_ping'
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
$function$;

create or replace function public.ops_beta_validation_summary(range_days integer default 7)
returns table(
  window_days integer,
  sessions bigint,
  returning_sessions bigint,
  location_enabled_sessions bigint,
  quiet_feed_sessions bigint,
  quiet_recovery_sessions bigint,
  quiet_expand_sessions bigint,
  quiet_map_sessions bigint,
  quiet_create_sessions bigint
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  d integer := least(greatest(coalesce(range_days, 7), 1), 90);
  since_at timestamptz := now() - make_interval(days => d);
begin
  if not public.is_moderator() then
    raise exception 'Operator access required';
  end if;

  return query
  with per_session as (
    select
      pe.browser_session_id,
      bool_or(pe.event_type = 'session_start') as had_session,
      bool_or(pe.event_type = 'return_visit') as returned,
      bool_or(pe.event_type = 'location_enabled') as location_enabled,
      bool_or(pe.event_type = 'quiet_feed_seen') as quiet_seen,
      bool_or(pe.event_type in ('quiet_expand_radius','quiet_open_map','quiet_create_ping')) as quiet_recovered,
      bool_or(pe.event_type = 'quiet_expand_radius') as quiet_expanded,
      bool_or(pe.event_type = 'quiet_open_map') as quiet_map,
      bool_or(pe.event_type = 'quiet_create_ping') as quiet_create
    from public.product_events pe
    where pe.created_at >= since_at
    group by pe.browser_session_id
  )
  select
    d,
    count(*) filter (where had_session)::bigint,
    count(*) filter (where had_session and returned)::bigint,
    count(*) filter (where had_session and location_enabled)::bigint,
    count(*) filter (where quiet_seen)::bigint,
    count(*) filter (where quiet_seen and quiet_recovered)::bigint,
    count(*) filter (where quiet_seen and quiet_expanded)::bigint,
    count(*) filter (where quiet_seen and quiet_map)::bigint,
    count(*) filter (where quiet_seen and quiet_create)::bigint
  from per_session;
end;
$function$;

revoke all on function public.ops_beta_validation_summary(integer) from public;
grant execute on function public.ops_beta_validation_summary(integer) to authenticated;

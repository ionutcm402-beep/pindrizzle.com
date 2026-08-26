create or replace function public.retention_preview_since_last_visit(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_meters integer default 1609
)
returns table (
  previous_visit_at timestamptz,
  first_visit boolean,
  new_pings integer,
  new_replies integer,
  new_confirmations integer,
  new_helpful integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_visit timestamptz;
  since_at timestamptz;
  viewer_location geography;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if radius_meters < 100 or radius_meters > 10000 then
    raise exception 'Invalid radius';
  end if;

  viewer_location := st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography;

  select rv.last_visit_at into prior_visit
  from public.retention_visits rv
  where rv.user_id = auth.uid();

  if prior_visit is null then
    previous_visit_at := null;
    first_visit := true;
    new_pings := 0;
    new_replies := 0;
    new_confirmations := 0;
    new_helpful := 0;
    return next;
    return;
  end if;

  since_at := greatest(prior_visit, now() - interval '7 days');

  select count(*)::integer into new_pings
  from public.pings p
  where p.created_at > since_at
    and p.user_id <> auth.uid()
    and p.status = 'active'
    and p.expires_at > now()
    and st_dwithin(p.location, viewer_location, radius_meters)
    and not public.ping_hidden_for_viewer(p.id, p.user_id);

  select count(*)::integer into new_replies
  from public.comments c
  join public.pings p on p.id = c.ping_id
  where c.created_at > since_at
    and c.user_id <> auth.uid()
    and p.status = 'active'
    and p.expires_at > now()
    and st_dwithin(p.location, viewer_location, radius_meters)
    and not public.ping_hidden_for_viewer(p.id, p.user_id);

  select count(*)::integer into new_confirmations
  from public.confirmations c
  join public.pings p on p.id = c.ping_id
  where c.created_at > since_at
    and c.user_id <> auth.uid()
    and p.status = 'active'
    and p.expires_at > now()
    and st_dwithin(p.location, viewer_location, radius_meters)
    and not public.ping_hidden_for_viewer(p.id, p.user_id);

  select count(*)::integer into new_helpful
  from public.ping_helpful h
  join public.pings p on p.id = h.ping_id
  where h.created_at > since_at
    and h.user_id <> auth.uid()
    and p.status = 'active'
    and p.expires_at > now()
    and st_dwithin(p.location, viewer_location, radius_meters)
    and not public.ping_hidden_for_viewer(p.id, p.user_id);

  previous_visit_at := prior_visit;
  first_visit := false;
  return next;
end;
$$;

revoke all on function public.retention_preview_since_last_visit(double precision, double precision, integer) from public, anon;
grant execute on function public.retention_preview_since_last_visit(double precision, double precision, integer) to authenticated;

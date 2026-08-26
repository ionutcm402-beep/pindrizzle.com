-- Phase 10 launch hardening: store only approximate Ping locations and reduce
-- client table privileges to the operations the current app actually uses.

create or replace function public.create_ping(
  ping_category public.ping_category,
  ping_title text,
  ping_body text,
  ping_lat double precision,
  ping_lng double precision,
  ping_place_label text default null,
  ping_precision public.location_precision default 'approximate'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_id uuid;
  approximate_location geography(point,4326);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if ping_lat is null or ping_lng is null
     or ping_lat < -90 or ping_lat > 90
     or ping_lng < -180 or ping_lng > 180 then
    raise exception 'Invalid Ping location';
  end if;

  -- Ping is intentionally hyperlocal but not an exact-coordinate publishing tool.
  -- Snap the stored point to roughly a neighbourhood-scale grid so direct table
  -- reads cannot recover the browser's original GPS coordinate.
  approximate_location := st_snaptogrid(
    st_setsrid(st_makepoint(ping_lng, ping_lat), 4326),
    0.004
  )::geography;

  insert into public.pings (
    user_id, category, title, body, location, location_precision, place_label
  ) values (
    auth.uid(),
    ping_category,
    ping_title,
    ping_body,
    approximate_location,
    'approximate',
    left(nullif(trim(ping_place_label), ''), 120)
  ) returning id into created_id;

  return created_id;
end;
$$;

revoke all on function public.create_ping(public.ping_category,text,text,double precision,double precision,text,public.location_precision)
  from public, anon;
grant execute on function public.create_ping(public.ping_category,text,text,double precision,double precision,text,public.location_precision)
  to authenticated;

create or replace function public.enforce_approximate_ping_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.location := st_snaptogrid(new.location::geometry, 0.004)::geography;
  new.location_precision := 'approximate';
  return new;
end;
$$;

revoke all on function public.enforce_approximate_ping_location() from public, anon, authenticated;

drop trigger if exists enforce_approximate_ping_location on public.pings;
create trigger enforce_approximate_ping_location
before insert or update of location, location_precision on public.pings
for each row execute function public.enforce_approximate_ping_location();

-- Remove exact coordinates from existing rows as well. This preserves every Ping
-- and its relationships while reducing location precision in-place.
update public.pings
set location = st_snaptogrid(location::geometry, 0.004)::geography,
    location_precision = 'approximate'
where location_precision is distinct from 'approximate'::public.location_precision
   or location::geometry is distinct from st_snaptogrid(location::geometry, 0.004);

-- Pings: public reads are required by Ping detail + Realtime, but client writes
-- are limited to safe creation columns. Resolve/moderation/count changes use RPCs.
revoke all on table public.pings from anon, authenticated;
grant select on table public.pings to anon, authenticated;
grant insert (user_id, category, title, body, location, location_precision, place_label)
  on table public.pings to authenticated;

-- Profiles are public contributor context, but reputation counters are maintained
-- by database triggers/RPCs rather than writable from browser clients.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon, authenticated;

-- Community tables: keep only operations used by the current client. RLS remains
-- the row-level boundary on top of these grants.
revoke all on table public.comments from anon, authenticated;
grant select on table public.comments to anon, authenticated;
grant insert, delete on table public.comments to authenticated;

revoke all on table public.confirmations from anon, authenticated;
grant select on table public.confirmations to anon, authenticated;
grant insert, delete on table public.confirmations to authenticated;

revoke all on table public.blocks from anon, authenticated;
grant select on table public.blocks to authenticated;

revoke all on table public.reports from anon, authenticated;
grant select, insert on table public.reports to authenticated;

revoke all on table public.notifications from anon, authenticated;
grant select, update on table public.notifications to authenticated;

revoke all on table public.notification_preferences from anon, authenticated;
grant select, insert, update on table public.notification_preferences to authenticated;

-- New public objects should be opt-in rather than automatically browser-writable.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, truncate, references, trigger on tables
  from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

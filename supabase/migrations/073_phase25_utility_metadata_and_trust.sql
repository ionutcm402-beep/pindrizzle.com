-- Phase 25.5: deal context, flexible expiry and trust freshness.

alter table public.pings
  add column if not exists deal_source text,
  add column if not exists deal_kind text,
  add column if not exists merchant_name text,
  add column if not exists last_confirmed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pings_deal_source_check') then
    alter table public.pings add constraint pings_deal_source_check
      check (deal_source is null or deal_source in ('spotted','business'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pings_deal_kind_check') then
    alter table public.pings add constraint pings_deal_kind_check
      check (deal_kind is null or deal_kind in ('offer','new_in','restock','clearance','limited_time'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pings_merchant_name_check') then
    alter table public.pings add constraint pings_merchant_name_check
      check (merchant_name is null or char_length(trim(merchant_name)) between 2 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pings_deal_metadata_scope_check') then
    alter table public.pings add constraint pings_deal_metadata_scope_check
      check (
        (category = 'deals'::public.ping_category and deal_source is not null and deal_kind is not null and merchant_name is not null)
        or
        (category <> 'deals'::public.ping_category and deal_source is null and deal_kind is null and merchant_name is null)
      );
  end if;
end $$;

create index if not exists confirmations_ping_created_idx
  on public.confirmations (ping_id, created_at desc);

update public.pings p
set last_confirmed_at = x.last_confirmed_at
from (
  select ping_id, max(created_at) as last_confirmed_at
  from public.confirmations
  group by ping_id
) x
where p.id = x.ping_id
  and p.last_confirmed_at is distinct from x.last_confirmed_at;

create or replace function public.sync_ping_last_confirmed_at()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_id uuid;
begin
  if tg_op = 'DELETE' then
    target_id := old.ping_id;
  else
    target_id := new.ping_id;
  end if;

  update public.pings
  set last_confirmed_at = (
    select max(c.created_at)
    from public.confirmations c
    where c.ping_id = target_id
  )
  where id = target_id;

  return null;
end;
$$;

drop trigger if exists sync_ping_last_confirmed_at on public.confirmations;
create trigger sync_ping_last_confirmed_at
after insert or delete on public.confirmations
for each row execute function public.sync_ping_last_confirmed_at();

create or replace function public.create_ping_v2(
  ping_category public.ping_category,
  ping_title text,
  ping_body text,
  ping_lat double precision,
  ping_lng double precision,
  ping_place_label text default null,
  ping_expires_in_hours integer default 24,
  ping_deal_source text default null,
  ping_deal_kind text default null,
  ping_merchant_name text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  created_id uuid;
  approximate_location geography(point,4326);
  resolved_place text;
  center_lat double precision;
  center_lng double precision;
  cell_key text;
  effective_hours integer;
  clean_source text;
  clean_kind text;
  clean_merchant text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if ping_lat is null or ping_lng is null
     or ping_lat < -90 or ping_lat > 90
     or ping_lng < -180 or ping_lng > 180 then
    raise exception 'Invalid Ping location';
  end if;

  effective_hours := least(greatest(coalesce(ping_expires_in_hours, 24), 1), 168);

  if ping_category = 'deals'::public.ping_category then
    clean_source := coalesce(nullif(trim(ping_deal_source), ''), 'spotted');
    clean_kind := coalesce(nullif(trim(ping_deal_kind), ''), 'offer');
    clean_merchant := left(nullif(trim(ping_merchant_name), ''), 120);
    if clean_source not in ('spotted','business') then raise exception 'Invalid deal source'; end if;
    if clean_kind not in ('offer','new_in','restock','clearance','limited_time') then raise exception 'Invalid deal kind'; end if;
    if clean_merchant is null or char_length(clean_merchant) < 2 then raise exception 'Business or shop name required for Deals'; end if;
  else
    clean_source := null;
    clean_kind := null;
    clean_merchant := null;
  end if;

  approximate_location := st_snaptogrid(
    st_setsrid(st_makepoint(ping_lng, ping_lat), 4326),
    0.004
  )::geography;

  center_lat := floor(ping_lat / 0.004) * 0.004 + 0.002;
  center_lng := floor(ping_lng / 0.004) * 0.004 + 0.002;
  cell_key := to_char(round(center_lat::numeric, 3), 'FM999990.000') || ':' ||
              to_char(round(center_lng::numeric, 3), 'FM999990.000');

  select pc.display_label into resolved_place
  from public.place_cells pc
  where pc.grid_key = cell_key
    and pc.refreshed_at > now() - interval '30 days';

  resolved_place := coalesce(
    left(nullif(trim(resolved_place), ''), 120),
    left(nullif(trim(ping_place_label), ''), 120),
    'Nearby'
  );

  insert into public.pings (
    user_id, category, title, body, location, location_precision, place_label,
    expires_at, deal_source, deal_kind, merchant_name
  ) values (
    auth.uid(), ping_category, ping_title, ping_body, approximate_location,
    'approximate', resolved_place, now() + make_interval(hours => effective_hours),
    clean_source, clean_kind, clean_merchant
  ) returning id into created_id;

  return created_id;
end;
$$;

revoke all on function public.create_ping_v2(public.ping_category,text,text,double precision,double precision,text,integer,text,text,text) from public, anon;
grant execute on function public.create_ping_v2(public.ping_category,text,text,double precision,double precision,text,integer,text,text,text) to authenticated, service_role;

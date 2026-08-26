-- Phase 15: privacy-safe coarse place intelligence.
-- Browser roles cannot read or write this cache directly; the server route uses service_role.

create table if not exists public.place_cells (
  grid_key text primary key,
  center_lat double precision not null check (center_lat between -90 and 90),
  center_lng double precision not null check (center_lng between -180 and 180),
  locality text,
  town text,
  region text,
  country_code text,
  display_label text not null,
  provider text not null default 'openstreetmap_nominatim',
  refreshed_at timestamptz not null default now()
);

alter table public.place_cells enable row level security;
revoke all on table public.place_cells from public, anon, authenticated;

create table if not exists public.place_lookup_state (
  id boolean primary key default true check (id),
  next_allowed_at timestamptz not null default '-infinity'::timestamptz
);

insert into public.place_lookup_state (id, next_allowed_at)
values (true, '-infinity'::timestamptz)
on conflict (id) do nothing;

alter table public.place_lookup_state enable row level security;
revoke all on table public.place_lookup_state from public, anon, authenticated;

create or replace function public.reserve_place_provider_lookup()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean := false;
begin
  update public.place_lookup_state
  set next_allowed_at = now() + interval '1 second'
  where id = true
    and next_allowed_at <= now()
  returning true into allowed;

  return coalesce(allowed, false);
end;
$$;

revoke all on function public.reserve_place_provider_lookup() from public, anon, authenticated;
grant execute on function public.reserve_place_provider_lookup() to service_role;

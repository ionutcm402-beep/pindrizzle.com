create extension if not exists postgis;
create extension if not exists pgcrypto;

create type public.ping_category as enum ('alert','traffic','lost_found','free','help','local');
create type public.ping_status as enum ('active','resolved','expired','removed');
create type public.location_precision as enum ('exact','approximate');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  avatar_url text,
  home_area text,
  helpful_pings integer not null default 0,
  confirmation_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category public.ping_category not null,
  title text not null check (char_length(title) between 4 and 70),
  body text not null check (char_length(body) between 6 and 280),
  location geography(point,4326) not null,
  location_precision public.location_precision not null default 'approximate',
  place_label text,
  status public.ping_status not null default 'active',
  confirmation_count integer not null default 0,
  comment_count integer not null default 0,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pings_location_gix on public.pings using gist(location);
create index pings_active_expires_idx on public.pings(status, expires_at desc);
create index pings_user_created_idx on public.pings(user_id, created_at desc);

create table public.confirmations (
  ping_id uuid not null references public.pings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ping_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  ping_id uuid not null references public.pings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  ping_id uuid references public.pings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  unique (ping_id, reporter_id)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public.nearby_pings(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_meters integer default 1609,
  result_limit integer default 50
)
returns table (
  id uuid,
  user_id uuid,
  category public.ping_category,
  title text,
  body text,
  place_label text,
  confirmation_count integer,
  comment_count integer,
  created_at timestamptz,
  expires_at timestamptz,
  distance_meters double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id, p.user_id, p.category, p.title, p.body, p.place_label,
    p.confirmation_count, p.comment_count, p.created_at, p.expires_at,
    st_distance(p.location, st_setsrid(st_makepoint(viewer_lng, viewer_lat),4326)::geography) as distance_meters
  from public.pings p
  where p.status = 'active'
    and p.expires_at > now()
    and st_dwithin(p.location, st_setsrid(st_makepoint(viewer_lng, viewer_lat),4326)::geography, radius_meters)
  order by p.created_at desc
  limit least(result_limit, 100);
$$;

alter table public.profiles enable row level security;
alter table public.pings enable row level security;
alter table public.confirmations enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;

create policy "profiles are readable" on public.profiles for select using (true);
create policy "users manage own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "active pings are readable" on public.pings for select using (status = 'active' and expires_at > now());
create policy "users create own pings" on public.pings for insert with check (auth.uid() = user_id);
create policy "users update own pings" on public.pings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "confirmations are readable" on public.confirmations for select using (true);
create policy "users confirm as themselves" on public.confirmations for insert with check (auth.uid() = user_id);
create policy "users remove own confirmation" on public.confirmations for delete using (auth.uid() = user_id);
create policy "comments are readable" on public.comments for select using (true);
create policy "users comment as themselves" on public.comments for insert with check (auth.uid() = user_id);
create policy "users delete own comments" on public.comments for delete using (auth.uid() = user_id);
create policy "users create reports" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "users read own reports" on public.reports for select using (auth.uid() = reporter_id);
create policy "users manage own blocks" on public.blocks for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

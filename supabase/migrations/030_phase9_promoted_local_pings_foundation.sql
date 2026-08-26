create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  ping_id uuid not null references public.pings(id) on delete cascade,
  promoter_user_id uuid not null references public.profiles(id) on delete cascade,
  sponsor_name text not null check (char_length(trim(sponsor_name)) between 2 and 80),
  status text not null default 'draft' check (status in ('draft','approved','active','paused','ended','rejected')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  approved_at timestamptz,
  priority smallint not null default 0 check (priority between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_time_window check (ends_at > starts_at)
);

create index if not exists promotions_active_window_idx
  on public.promotions (status, starts_at, ends_at);
create index if not exists promotions_ping_idx on public.promotions (ping_id);
create index if not exists promotions_promoter_idx on public.promotions (promoter_user_id);

alter table public.promotions enable row level security;
revoke all on table public.promotions from anon, authenticated;

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
    and pr.starts_at <= now()
    and pr.ends_at > now()
    and p.status = 'active'
    and p.expires_at > now()
    and st_dwithin(p.location, v.location, greatest(100, least(radius_meters, 8047)))
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

revoke all on function public.nearby_promoted_pings(double precision, double precision, integer, integer) from public;
grant execute on function public.nearby_promoted_pings(double precision, double precision, integer, integer) to anon, authenticated;

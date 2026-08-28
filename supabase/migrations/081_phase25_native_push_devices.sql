-- Pindrizzle native push devices for Capacitor iOS/Android.
-- Kept separate from browser Web Push subscriptions because APNs/FCM tokens are different credentials.

create table if not exists public.native_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios','android')),
  token text not null unique,
  device_label text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz
);

create index if not exists native_push_devices_user_active_idx
  on public.native_push_devices (user_id, last_seen_at desc)
  where disabled_at is null;

alter table public.native_push_devices enable row level security;
revoke all on table public.native_push_devices from anon, authenticated;

create table if not exists public.native_push_delivery_attempts (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  device_id uuid not null references public.native_push_devices(id) on delete cascade,
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  primary key (notification_id, device_id)
);

alter table public.native_push_delivery_attempts enable row level security;
revoke all on table public.native_push_delivery_attempts from anon, authenticated;

create or replace function public.upsert_native_push_device(
  device_platform text,
  device_token text,
  device_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  saved_id uuid;
begin
  if viewer is null then raise exception 'Authentication required'; end if;
  if device_platform not in ('ios','android') then raise exception 'Invalid native platform'; end if;
  if device_token is null or length(trim(device_token)) < 20 or length(device_token) > 4096 then
    raise exception 'Invalid native push token';
  end if;

  insert into public.native_push_devices (user_id, platform, token, device_label, last_seen_at, disabled_at)
  values (viewer, device_platform, trim(device_token), left(nullif(trim(device_label), ''), 180), now(), null)
  on conflict (token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    device_label = excluded.device_label,
    last_seen_at = now(),
    disabled_at = null
  returning id into saved_id;

  update public.native_push_devices
  set disabled_at = now()
  where id in (
    select id from public.native_push_devices
    where user_id = viewer and disabled_at is null
    order by last_seen_at desc
    offset 5
  );

  return saved_id;
end;
$$;

create or replace function public.disable_native_push_device(device_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.native_push_devices
  set disabled_at = now(), last_seen_at = now()
  where user_id = auth.uid() and token = device_token and disabled_at is null;
  return found;
end;
$$;

revoke all on function public.upsert_native_push_device(text,text,text) from public, anon;
grant execute on function public.upsert_native_push_device(text,text,text) to authenticated;
revoke all on function public.disable_native_push_device(text) from public, anon;
grant execute on function public.disable_native_push_device(text) to authenticated;

create or replace function public.my_push_state()
returns table(active_subscriptions integer)
language sql
stable
security definer
set search_path = public
as $$
  select (
    (select count(*) from public.push_subscriptions where user_id = auth.uid() and disabled_at is null)
    +
    (select count(*) from public.native_push_devices where user_id = auth.uid() and disabled_at is null)
  )::integer;
$$;

revoke all on function public.my_push_state() from public, anon;
grant execute on function public.my_push_state() to authenticated;

create or replace function public.enqueue_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  cfg record;
begin
  if not exists (
    select 1 from public.push_subscriptions s where s.user_id = new.user_id and s.disabled_at is null
  ) and not exists (
    select 1 from public.native_push_devices d where d.user_id = new.user_id and d.disabled_at is null
  ) then
    return new;
  end if;

  select * into cfg from public.push_server_config();
  if lower(coalesce(cfg.delivery_enabled, 'false')) <> 'true'
     or coalesce(cfg.webhook_secret, '') = ''
     or coalesce(cfg.push_origin, '') = '' then
    return new;
  end if;

  perform net.http_post(
    url := rtrim(cfg.push_origin, '/') || '/api/push/deliver',
    headers := jsonb_build_object('Content-Type','application/json','x-ping-push-secret',cfg.webhook_secret),
    body := jsonb_build_object('notificationId', new.id)
  );
  return new;
end;
$$;

revoke all on function public.enqueue_push_for_notification() from public, anon, authenticated;

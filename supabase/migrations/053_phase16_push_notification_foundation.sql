-- Phase 16 — Push Notifications
-- Browser subscriptions remain private and are managed only through guarded RPCs.
-- Delivery is feature-gated in Supabase Vault and stays disabled until the Phase 16 UI/server code is merged.

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  device_label text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz
);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id, last_seen_at desc)
  where disabled_at is null;

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;

create table if not exists public.push_delivery_attempts (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  primary key (notification_id, subscription_id)
);

alter table public.push_delivery_attempts enable row level security;
revoke all on table public.push_delivery_attempts from anon, authenticated;

create or replace function public.upsert_push_subscription(
  subscription_endpoint text,
  subscription_p256dh text,
  subscription_auth text,
  subscription_device_label text default null
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
  if viewer is null then
    raise exception 'Authentication required';
  end if;

  if subscription_endpoint is null
     or length(subscription_endpoint) < 20
     or length(subscription_endpoint) > 2000
     or subscription_endpoint !~ '^https://' then
    raise exception 'Invalid push endpoint';
  end if;

  if subscription_p256dh is null or length(subscription_p256dh) < 40 or length(subscription_p256dh) > 300 then
    raise exception 'Invalid push key';
  end if;

  if subscription_auth is null or length(subscription_auth) < 10 or length(subscription_auth) > 200 then
    raise exception 'Invalid push auth secret';
  end if;

  insert into public.push_subscriptions (
    user_id, endpoint, p256dh, auth_secret, device_label, last_seen_at, disabled_at
  ) values (
    viewer,
    subscription_endpoint,
    subscription_p256dh,
    subscription_auth,
    left(nullif(trim(subscription_device_label), ''), 180),
    now(),
    null
  )
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth_secret = excluded.auth_secret,
    device_label = excluded.device_label,
    last_seen_at = now(),
    disabled_at = null
  returning id into saved_id;

  -- Keep a small, practical device cap per account and disable stale extras.
  update public.push_subscriptions
  set disabled_at = now()
  where id in (
    select id
    from public.push_subscriptions
    where user_id = viewer and disabled_at is null
    order by last_seen_at desc
    offset 5
  );

  return saved_id;
end;
$$;

create or replace function public.disable_push_subscription(subscription_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.push_subscriptions
  set disabled_at = now(), last_seen_at = now()
  where user_id = auth.uid()
    and endpoint = subscription_endpoint
    and disabled_at is null;

  return found;
end;
$$;

create or replace function public.my_push_state()
returns table(active_subscriptions integer)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.push_subscriptions
  where user_id = auth.uid()
    and disabled_at is null;
$$;

revoke all on function public.upsert_push_subscription(text,text,text,text) from public, anon;
grant execute on function public.upsert_push_subscription(text,text,text,text) to authenticated;
revoke all on function public.disable_push_subscription(text) from public, anon;
grant execute on function public.disable_push_subscription(text) to authenticated;
revoke all on function public.my_push_state() from public, anon;
grant execute on function public.my_push_state() to authenticated;

create or replace function public.push_server_config()
returns table(
  vapid_public_key text,
  vapid_private_key text,
  webhook_secret text,
  push_origin text,
  vapid_subject text,
  delivery_enabled text
)
language sql
stable
security definer
set search_path = public, vault
as $$
  select
    max(decrypted_secret) filter (where name = 'ping_vapid_public_key'),
    max(decrypted_secret) filter (where name = 'ping_vapid_private_key'),
    max(decrypted_secret) filter (where name = 'ping_push_webhook_secret'),
    max(decrypted_secret) filter (where name = 'ping_push_origin'),
    max(decrypted_secret) filter (where name = 'ping_vapid_subject'),
    max(decrypted_secret) filter (where name = 'ping_push_delivery_enabled')
  from vault.decrypted_secrets
  where name in (
    'ping_vapid_public_key',
    'ping_vapid_private_key',
    'ping_push_webhook_secret',
    'ping_push_origin',
    'ping_vapid_subject',
    'ping_push_delivery_enabled'
  );
$$;

revoke all on function public.push_server_config() from public, anon, authenticated;
grant execute on function public.push_server_config() to service_role;

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
    select 1
    from public.push_subscriptions s
    where s.user_id = new.user_id and s.disabled_at is null
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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ping-push-secret', cfg.webhook_secret
    ),
    body := jsonb_build_object('notificationId', new.id)
  );

  return new;
end;
$$;

revoke all on function public.enqueue_push_for_notification() from public, anon, authenticated;

drop trigger if exists notifications_push_delivery on public.notifications;
create trigger notifications_push_delivery
after insert on public.notifications
for each row execute function public.enqueue_push_for_notification();

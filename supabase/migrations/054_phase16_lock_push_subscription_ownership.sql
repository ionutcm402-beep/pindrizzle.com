-- A browser push endpoint may only be refreshed by the account that registered it.
-- This prevents one signed-in account from claiming another account's endpoint.

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
    p256dh = excluded.p256dh,
    auth_secret = excluded.auth_secret,
    device_label = excluded.device_label,
    last_seen_at = now(),
    disabled_at = null
  where public.push_subscriptions.user_id = viewer
  returning id into saved_id;

  if saved_id is null then
    raise exception 'This browser push subscription belongs to a different account';
  end if;

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

revoke all on function public.upsert_push_subscription(text,text,text,text) from public, anon;
grant execute on function public.upsert_push_subscription(text,text,text,text) to authenticated;

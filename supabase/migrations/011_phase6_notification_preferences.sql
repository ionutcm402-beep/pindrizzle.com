create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  replies_enabled boolean not null default true,
  confirmations_enabled boolean not null default true,
  helpful_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "users read own notification preferences" on public.notification_preferences;
create policy "users read own notification preferences"
on public.notification_preferences for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users insert own notification preferences" on public.notification_preferences;
create policy "users insert own notification preferences"
on public.notification_preferences for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "users update own notification preferences" on public.notification_preferences;
create policy "users update own notification preferences"
on public.notification_preferences for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.notification_preferences to authenticated;

create or replace function public.notification_enabled(recipient uuid, requested_kind public.notification_kind)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case requested_kind
    when 'reply' then coalesce((select replies_enabled from public.notification_preferences where user_id = recipient), true)
    when 'confirmation' then coalesce((select confirmations_enabled from public.notification_preferences where user_id = recipient), true)
    when 'helpful' then coalesce((select helpful_enabled from public.notification_preferences where user_id = recipient), true)
    else true
  end;
$$;

revoke all on function public.notification_enabled(uuid, public.notification_kind) from public;

create or replace function public.notify_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ping_owner uuid;
  recipient uuid;
begin
  select p.user_id into ping_owner from public.pings p where p.id = new.ping_id;
  if ping_owner is null then return new; end if;

  for recipient in
    select distinct candidate from (
      select ping_owner as candidate
      union all
      select c.user_id from public.comments c
      where c.ping_id = new.ping_id and c.id <> new.id
    ) recipients
    where candidate is not null and candidate <> new.user_id
  loop
    if public.notification_enabled(recipient, 'reply')
       and not public.notification_blocked(recipient, new.user_id) then
      insert into public.notifications (user_id, actor_id, ping_id, kind, title, body, event_key)
      values (
        recipient,
        new.user_id,
        new.ping_id,
        'reply',
        case when recipient = ping_owner then 'New reply on your Ping' else 'New reply in a Ping you joined' end,
        left(new.body, 180),
        'reply:' || new.id::text
      )
      on conflict (user_id, event_key) do nothing;
    end if;
  end loop;
  return new;
end;
$$;

create or replace function public.notify_confirmation_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ping_owner uuid;
  ping_title text;
begin
  select p.user_id, p.title into ping_owner, ping_title from public.pings p where p.id = new.ping_id;
  if ping_owner is null or ping_owner = new.user_id then return new; end if;
  if not public.notification_enabled(ping_owner, 'confirmation') then return new; end if;
  if public.notification_blocked(ping_owner, new.user_id) then return new; end if;

  insert into public.notifications (user_id, actor_id, ping_id, kind, title, body, event_key)
  values (
    ping_owner,
    new.user_id,
    new.ping_id,
    'confirmation',
    'Your Ping was confirmed',
    left(coalesce(ping_title, 'A nearby Ping'), 180),
    'confirmation:' || new.ping_id::text || ':' || new.user_id::text
  )
  on conflict (user_id, event_key) do nothing;
  return new;
end;
$$;

create or replace function public.notify_helpful_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ping_owner uuid;
  ping_title text;
begin
  select p.user_id, p.title into ping_owner, ping_title from public.pings p where p.id = new.ping_id;
  if ping_owner is null or ping_owner = new.user_id then return new; end if;
  if not public.notification_enabled(ping_owner, 'helpful') then return new; end if;
  if public.notification_blocked(ping_owner, new.user_id) then return new; end if;

  insert into public.notifications (user_id, actor_id, ping_id, kind, title, body, event_key)
  values (
    ping_owner,
    new.user_id,
    new.ping_id,
    'helpful',
    'Someone marked your Ping Helpful',
    left(coalesce(ping_title, 'A nearby Ping'), 180),
    'helpful:' || new.ping_id::text || ':' || new.user_id::text
  )
  on conflict (user_id, event_key) do nothing;
  return new;
end;
$$;
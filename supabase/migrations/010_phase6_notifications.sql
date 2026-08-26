do $$ begin
  create type public.notification_kind as enum ('reply','confirmation','helpful');
exception when duplicate_object then null;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  ping_id uuid references public.pings(id) on delete cascade,
  kind public.notification_kind not null,
  title text not null,
  body text not null default '',
  event_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
on public.notifications for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications"
on public.notifications for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users delete own notifications" on public.notifications;
create policy "users delete own notifications"
on public.notifications for delete
to authenticated
using (auth.uid() = user_id);

grant select, update, delete on public.notifications to authenticated;

create or replace function public.notification_blocked(recipient uuid, actor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = recipient and b.blocked_id = actor)
       or (b.blocker_id = actor and b.blocked_id = recipient)
  );
$$;

revoke all on function public.notification_blocked(uuid, uuid) from public;

create or replace function public.notify_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ping_owner uuid;
  ping_title text;
  recipient uuid;
begin
  select p.user_id, p.title into ping_owner, ping_title
  from public.pings p where p.id = new.ping_id;

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
    if not public.notification_blocked(recipient, new.user_id) then
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
  select p.user_id, p.title into ping_owner, ping_title
  from public.pings p where p.id = new.ping_id;

  if ping_owner is null or ping_owner = new.user_id then return new; end if;
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
  select p.user_id, p.title into ping_owner, ping_title
  from public.pings p where p.id = new.ping_id;

  if ping_owner is null or ping_owner = new.user_id then return new; end if;
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

drop trigger if exists comments_create_notification on public.comments;
create trigger comments_create_notification
after insert on public.comments
for each row execute function public.notify_comment_activity();

drop trigger if exists confirmations_create_notification on public.confirmations;
create trigger confirmations_create_notification
after insert on public.confirmations
for each row execute function public.notify_confirmation_activity();

drop trigger if exists helpful_create_notification on public.ping_helpful;
create trigger helpful_create_notification
after insert on public.ping_helpful
for each row execute function public.notify_helpful_activity();

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

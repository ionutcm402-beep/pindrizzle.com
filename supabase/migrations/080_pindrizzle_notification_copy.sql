-- Pindrizzle public notification copy.
-- Internal table/function names remain unchanged for compatibility.

create or replace function public.notify_comment_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
        case when recipient = ping_owner then 'New reply on your pin' else 'New reply in a pin you joined' end,
        left(new.body, 180),
        'reply:' || new.id::text
      )
      on conflict (user_id, event_key) do nothing;
    end if;
  end loop;
  return new;
end;
$function$;

create or replace function public.notify_confirmation_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    'Your pin was confirmed',
    left(coalesce(ping_title, 'A nearby pin'), 180),
    'confirmation:' || new.ping_id::text || ':' || new.user_id::text
  )
  on conflict (user_id, event_key) do nothing;
  return new;
end;
$function$;

create or replace function public.notify_followed_ping_outcome()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  follower uuid;
  owner_id uuid;
  ping_title text;
  outcome_title text;
  outcome_body text;
begin
  if old.status = new.status then
    return new;
  end if;

  if new.status not in ('resolved','removed') then
    return new;
  end if;

  owner_id := new.user_id;
  ping_title := coalesce(new.title, 'A pin you follow');

  if new.status = 'resolved' then
    outcome_title := 'A pin you follow was resolved';
    outcome_body := left(ping_title, 180);
  else
    outcome_title := 'A pin you follow was removed';
    outcome_body := left(ping_title, 180);
  end if;

  for follower in
    select f.user_id
    from public.ping_follows f
    where f.ping_id = new.id
  loop
    if follower <> owner_id and not public.notification_blocked(follower, owner_id) then
      insert into public.notifications (user_id, actor_id, ping_id, kind, title, body, event_key)
      values (
        follower,
        case when new.status = 'resolved' then owner_id else null end,
        new.id,
        'follow_update',
        outcome_title,
        outcome_body,
        'follow-outcome:' || new.id::text || ':' || new.status::text
      )
      on conflict (user_id, event_key) do nothing;
    end if;
  end loop;

  return new;
end;
$function$;

create or replace function public.notify_helpful_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    'Someone marked your pin Helpful',
    left(coalesce(ping_title, 'A nearby pin'), 180),
    'helpful:' || new.ping_id::text || ':' || new.user_id::text
  )
  on conflict (user_id, event_key) do nothing;
  return new;
end;
$function$;

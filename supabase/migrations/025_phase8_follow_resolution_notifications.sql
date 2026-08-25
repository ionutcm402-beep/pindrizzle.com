create or replace function public.notify_followed_ping_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  ping_title := coalesce(new.title, 'A Ping you follow');

  if new.status = 'resolved' then
    outcome_title := 'A Ping you follow was resolved';
    outcome_body := left(ping_title, 180);
  else
    outcome_title := 'A Ping you follow was removed';
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
$$;

revoke all on function public.notify_followed_ping_outcome() from public, anon, authenticated;

drop trigger if exists followed_ping_outcome_notification on public.pings;
create trigger followed_ping_outcome_notification
after update of status on public.pings
for each row execute function public.notify_followed_ping_outcome();

do $$ begin
  alter publication supabase_realtime add table public.ping_follows;
exception when duplicate_object then null;
end $$;

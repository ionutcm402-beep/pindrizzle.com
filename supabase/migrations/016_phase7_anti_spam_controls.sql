create or replace function public.enforce_ping_rate_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*)
    from public.pings p
    where p.user_id = new.user_id
      and p.created_at > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'Too many Pings in a short time. Please wait a few minutes.';
  end if;

  if (
    select count(*)
    from public.pings p
    where p.user_id = new.user_id
      and p.created_at > now() - interval '24 hours'
  ) >= 30 then
    raise exception 'Daily Ping limit reached. Please try again tomorrow.';
  end if;

  if exists (
    select 1
    from public.pings p
    where p.user_id = new.user_id
      and lower(trim(p.title)) = lower(trim(new.title))
      and lower(trim(p.body)) = lower(trim(new.body))
      and p.created_at > now() - interval '15 minutes'
  ) then
    raise exception 'This Ping looks like a recent duplicate.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_ping_rate_limits() from public, anon, authenticated;

drop trigger if exists enforce_ping_rate_limits on public.pings;
create trigger enforce_ping_rate_limits
before insert on public.pings
for each row execute function public.enforce_ping_rate_limits();

create or replace function public.enforce_comment_rate_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*)
    from public.comments c
    where c.user_id = new.user_id
      and c.created_at > now() - interval '5 minutes'
  ) >= 15 then
    raise exception 'Too many replies in a short time. Please wait a few minutes.';
  end if;

  if (
    select count(*)
    from public.comments c
    where c.user_id = new.user_id
      and c.created_at > now() - interval '24 hours'
  ) >= 100 then
    raise exception 'Daily reply limit reached. Please try again tomorrow.';
  end if;

  if exists (
    select 1
    from public.comments c
    where c.user_id = new.user_id
      and c.ping_id = new.ping_id
      and lower(trim(c.body)) = lower(trim(new.body))
      and c.created_at > now() - interval '60 seconds'
  ) then
    raise exception 'This reply looks like a duplicate.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_comment_rate_limits() from public, anon, authenticated;

drop trigger if exists enforce_comment_rate_limits on public.comments;
create trigger enforce_comment_rate_limits
before insert on public.comments
for each row execute function public.enforce_comment_rate_limits();

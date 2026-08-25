alter type public.notification_kind add value if not exists 'follow_update';

create table if not exists public.ping_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  ping_id uuid not null references public.pings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, ping_id)
);

create index if not exists ping_follows_user_created_idx on public.ping_follows(user_id, created_at desc);
create index if not exists ping_follows_ping_idx on public.ping_follows(ping_id);

alter table public.ping_follows enable row level security;

drop policy if exists "users read own follows" on public.ping_follows;
create policy "users read own follows"
on public.ping_follows for select
to authenticated
using (auth.uid() = user_id);

revoke all on table public.ping_follows from anon, authenticated;
grant select on table public.ping_follows to authenticated;

create or replace function public.ping_follow_state(target_ping_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.ping_follows f
    where f.user_id = auth.uid() and f.ping_id = target_ping_id
  );
$$;

revoke all on function public.ping_follow_state(uuid) from public, anon;
grant execute on function public.ping_follow_state(uuid) to authenticated;

create or replace function public.toggle_follow_ping(target_ping_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  ping_state public.ping_status;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select p.user_id, p.status into owner_id, ping_state
  from public.pings p
  where p.id = target_ping_id;

  if owner_id is null then
    raise exception 'Ping not found';
  end if;

  if owner_id = auth.uid() then
    raise exception 'You cannot follow your own Ping';
  end if;

  if exists (
    select 1 from public.ping_follows f
    where f.user_id = auth.uid() and f.ping_id = target_ping_id
  ) then
    delete from public.ping_follows
    where user_id = auth.uid() and ping_id = target_ping_id;
    return false;
  end if;

  if ping_state <> 'active' then
    raise exception 'Only active Pings can be followed';
  end if;

  if public.ping_hidden_for_viewer(target_ping_id, owner_id) then
    raise exception 'This Ping is not available to follow';
  end if;

  insert into public.ping_follows(user_id, ping_id)
  values (auth.uid(), target_ping_id)
  on conflict do nothing;

  return true;
end;
$$;

revoke all on function public.toggle_follow_ping(uuid) from public, anon;
grant execute on function public.toggle_follow_ping(uuid) to authenticated;

create or replace function public.my_followed_pings()
returns table (
  id uuid,
  title text,
  body text,
  category public.ping_category,
  status public.ping_status,
  place_label text,
  confirmation_count integer,
  comment_count integer,
  created_at timestamptz,
  expires_at timestamptz,
  followed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.title, p.body, p.category, p.status, p.place_label,
    p.confirmation_count, p.comment_count, p.created_at, p.expires_at,
    f.created_at as followed_at
  from public.ping_follows f
  join public.pings p on p.id = f.ping_id
  where f.user_id = auth.uid()
    and not public.ping_hidden_for_viewer(p.id, p.user_id)
  order by f.created_at desc;
$$;

revoke all on function public.my_followed_pings() from public, anon;
grant execute on function public.my_followed_pings() to authenticated;

create or replace function public.resolve_own_ping(target_ping_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.pings
  set status = 'resolved', updated_at = now()
  where id = target_ping_id
    and user_id = auth.uid()
    and status = 'active';

  if not found then
    raise exception 'Only your active Ping can be resolved';
  end if;

  return true;
end;
$$;

revoke all on function public.resolve_own_ping(uuid) from public, anon;
grant execute on function public.resolve_own_ping(uuid) to authenticated;

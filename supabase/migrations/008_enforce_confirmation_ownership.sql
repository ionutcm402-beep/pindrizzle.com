create or replace function public.confirm_ping(target_ping_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_count integer;
  target_owner uuid;
  target_status public.ping_status;
  target_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select user_id, status, expires_at
  into target_owner, target_status, target_expires
  from public.pings
  where id = target_ping_id;

  if target_owner is null then
    raise exception 'Ping not found';
  end if;

  if target_owner = auth.uid() then
    raise exception 'You cannot confirm your own Ping';
  end if;

  if target_status <> 'active' or target_expires <= now() then
    raise exception 'This Ping is no longer active';
  end if;

  insert into public.confirmations (ping_id, user_id)
  values (target_ping_id, auth.uid())
  on conflict (ping_id, user_id) do nothing;

  select count(*)::integer into current_count
  from public.confirmations
  where ping_id = target_ping_id;

  return coalesce(current_count, 0);
end;
$$;

revoke all on function public.confirm_ping(uuid) from public, anon;
grant execute on function public.confirm_ping(uuid) to authenticated;

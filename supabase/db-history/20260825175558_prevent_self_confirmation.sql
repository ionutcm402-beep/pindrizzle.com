-- Historical record only.
-- Applied to the live Supabase project as migration 20260825175558 / prevent_self_confirmation.
-- Do not auto-apply this file; newer migrations may supersede this function definition.

create or replace function public.confirm_ping(target_ping_id uuid)
returns integer
language plpgsql
set search_path = public
as $$
declare
  current_count integer;
  ping_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select user_id into ping_owner
  from public.pings
  where id = target_ping_id;

  if ping_owner is null then
    raise exception 'Ping not found';
  end if;

  if ping_owner = auth.uid() then
    raise exception 'You cannot confirm your own Ping';
  end if;

  insert into public.confirmations (ping_id, user_id)
  values (target_ping_id, auth.uid())
  on conflict (ping_id, user_id) do nothing;

  select count(*)::integer into current_count
  from public.confirmations
  where ping_id = target_ping_id;

  update public.pings
  set confirmation_count = current_count,
      updated_at = now()
  where id = target_ping_id;

  return coalesce(current_count, 0);
end;
$$;

revoke all on function public.confirm_ping(uuid) from public;
grant execute on function public.confirm_ping(uuid) to authenticated;

create or replace function public.toggle_block_user(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_created_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if target_user_id is null or target_user_id = auth.uid() then
    raise exception 'Invalid user';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    raise exception 'User not found';
  end if;

  select b.created_at into existing_created_at
  from public.blocks b
  where b.blocker_id = auth.uid() and b.blocked_id = target_user_id;

  if existing_created_at is not null then
    if existing_created_at > now() - interval '3 seconds' then
      return true;
    end if;

    delete from public.blocks
    where blocker_id = auth.uid() and blocked_id = target_user_id;
    return false;
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (auth.uid(), target_user_id)
  on conflict (blocker_id, blocked_id) do nothing;
  return true;
end;
$$;

revoke all on function public.toggle_block_user(uuid) from public, anon;
grant execute on function public.toggle_block_user(uuid) to authenticated;

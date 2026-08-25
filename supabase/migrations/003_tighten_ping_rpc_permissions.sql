revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.sync_ping_confirmation_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_ping_id uuid;
begin
  affected_ping_id := coalesce(new.ping_id, old.ping_id);
  update public.pings
  set confirmation_count = (
    select count(*)::integer
    from public.confirmations
    where ping_id = affected_ping_id
  ), updated_at = now()
  where id = affected_ping_id;
  return coalesce(new, old);
end;
$$;

revoke all on function public.sync_ping_confirmation_count() from public, anon, authenticated;

drop trigger if exists sync_confirmation_count on public.confirmations;
create trigger sync_confirmation_count
after insert or delete on public.confirmations
for each row execute procedure public.sync_ping_confirmation_count();

create or replace function public.confirm_ping(target_ping_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
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

create or replace function public.sync_expired_promotions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  update public.promotions
  set status = 'ended',
      updated_at = now()
  where status = 'active'
    and ends_at is not null
    and ends_at <= now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.sync_expired_promotions() from public, anon;
grant execute on function public.sync_expired_promotions() to authenticated;

-- public_release_stage() is intentionally exposed to anon/authenticated clients,
-- while direct access to app_release_state remains revoked. Run the read through
-- the function owner's privileges so callers do not need table SELECT rights.
create or replace function public.public_release_stage()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select stage from public.app_release_state where id = true;
$$;

revoke all on function public.public_release_stage() from public;
grant execute on function public.public_release_stage() to anon, authenticated;

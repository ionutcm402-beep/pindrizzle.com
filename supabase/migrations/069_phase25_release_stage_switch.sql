create table if not exists public.app_release_state (
  id boolean primary key default true check (id),
  stage text not null default 'closed_beta' check (stage in ('closed_beta','public')),
  updated_at timestamptz not null default now()
);

insert into public.app_release_state (id, stage)
values (true, 'closed_beta')
on conflict (id) do nothing;

alter table public.app_release_state enable row level security;

revoke all on public.app_release_state from public, anon, authenticated;

drop policy if exists "release stage is readable" on public.app_release_state;
create policy "release stage is readable"
on public.app_release_state for select
using (id = true);

create or replace function public.public_release_stage()
returns text
language sql stable
set search_path = public, pg_temp
as $$
  select stage from public.app_release_state where id = true;
$$;

revoke all on function public.public_release_stage() from public;
grant execute on function public.public_release_stage() to anon, authenticated;

create or replace function public.enforce_closed_beta_participation()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  release_stage text := coalesce((select stage from public.app_release_state where id = true), 'closed_beta');
begin
  if release_stage = 'closed_beta'
     and auth.role() = 'authenticated'
     and not exists(
       select 1 from public.beta_access
       where user_id = auth.uid() and revoked_at is null
     ) then
    raise exception 'Closed beta invite required' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_closed_beta_participation() from public, anon, authenticated;

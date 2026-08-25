create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, home_area)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(coalesce(new.email, 'Local'), '@', 1), 'Local'),
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.create_ping(
  ping_category public.ping_category,
  ping_title text,
  ping_body text,
  ping_lat double precision,
  ping_lng double precision,
  ping_place_label text default null,
  ping_precision public.location_precision default 'approximate'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.pings (
    user_id, category, title, body, location, location_precision, place_label
  ) values (
    auth.uid(),
    ping_category,
    ping_title,
    ping_body,
    st_setsrid(st_makepoint(ping_lng, ping_lat), 4326)::geography,
    ping_precision,
    ping_place_label
  ) returning id into created_id;

  return created_id;
end;
$$;

create or replace function public.confirm_ping(target_ping_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.confirmations (ping_id, user_id)
  values (target_ping_id, auth.uid())
  on conflict (ping_id, user_id) do nothing;

  update public.pings p
  set confirmation_count = (
    select count(*)::integer from public.confirmations c where c.ping_id = target_ping_id
  ), updated_at = now()
  where p.id = target_ping_id
  returning p.confirmation_count into new_count;

  return coalesce(new_count, 0);
end;
$$;

grant execute on function public.create_ping(public.ping_category,text,text,double precision,double precision,text,public.location_precision) to authenticated;
grant execute on function public.confirm_ping(uuid) to authenticated;

create or replace function public.my_pings()
returns table(
  id uuid,
  category public.ping_category,
  title text,
  body text,
  place_label text,
  status public.ping_status,
  confirmation_count integer,
  comment_count integer,
  created_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz,
  has_open_promotion boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.category,
    p.title,
    p.body,
    p.place_label,
    p.status,
    p.confirmation_count,
    p.comment_count,
    p.created_at,
    p.expires_at,
    p.updated_at,
    exists(
      select 1
      from public.promotions pr
      where pr.ping_id = p.id
        and pr.promoter_user_id = auth.uid()
        and pr.status in ('pending', 'approved', 'active', 'paused')
    ) as has_open_promotion
  from public.pings p
  where auth.uid() is not null
    and p.user_id = auth.uid()
    and p.status <> 'removed'
  order by
    case p.status
      when 'active' then 0
      when 'resolved' then 1
      when 'expired' then 2
      else 3
    end,
    p.created_at desc;
$$;

revoke all on function public.my_pings() from public, anon;
grant execute on function public.my_pings() to authenticated;

create or replace function public.remove_own_ping(target_ping_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  current_status public.ping_status;
begin
  if me is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.status
  into current_status
  from public.pings p
  where p.id = target_ping_id
    and p.user_id = me
  for update;

  if not found then
    raise exception 'Ping not found' using errcode = 'P0002';
  end if;

  if current_status = 'removed' then
    return true;
  end if;

  if exists(
    select 1
    from public.promotions pr
    where pr.ping_id = target_ping_id
      and pr.promoter_user_id = me
      and pr.status in ('pending', 'approved', 'active', 'paused')
  ) then
    raise exception 'This Ping has a promotion in progress. Finish the promotion before deleting it.' using errcode = '55000';
  end if;

  update public.pings
  set status = 'removed', updated_at = now()
  where id = target_ping_id
    and user_id = me;

  return true;
end;
$$;

revoke all on function public.remove_own_ping(uuid) from public, anon;
grant execute on function public.remove_own_ping(uuid) to authenticated;

create or replace function public.my_pings()
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
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    p.id,
    p.title,
    p.body,
    p.category,
    case
      when p.status = 'active' and p.expires_at <= now() then 'expired'::public.ping_status
      else p.status
    end as status,
    p.place_label,
    p.confirmation_count,
    p.comment_count,
    p.created_at,
    p.expires_at
  from public.pings p
  where p.user_id = auth.uid()
  order by p.created_at desc;
end;
$$;

revoke all on function public.my_pings() from public, anon, authenticated;
grant execute on function public.my_pings() to authenticated;

create or replace function public.remove_own_ping(target_ping_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ping_owner uuid;
  ping_state public.ping_status;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select p.user_id, p.status
  into ping_owner, ping_state
  from public.pings p
  where p.id = target_ping_id
  for update;

  if not found or ping_owner <> auth.uid() then
    raise exception 'Only your Ping can be removed';
  end if;

  if ping_state = 'removed' then
    return true;
  end if;

  update public.promotions
  set status = 'ended', updated_at = now()
  where ping_id = target_ping_id
    and status in ('active', 'paused')
    and ends_at is not null
    and ends_at <= now();

  if exists (
    select 1
    from public.promotions pr
    where pr.ping_id = target_ping_id
      and pr.payment_status in ('paid', 'disputed')
      and pr.status in ('active', 'paused')
      and (pr.ends_at is null or pr.ends_at > now())
  ) then
    raise exception 'This Ping has a paid promotion still in progress';
  end if;

  update public.promotions
  set status = 'ended',
      pending_checkout_session_id = null,
      pending_checkout_expires_at = null,
      checkout_claim_token = null,
      checkout_claim_expires_at = null,
      updated_at = now()
  where ping_id = target_ping_id
    and payment_status not in ('paid', 'disputed')
    and status in ('draft', 'pending', 'approved', 'active', 'paused');

  update public.pings
  set status = 'removed', updated_at = now()
  where id = target_ping_id
    and user_id = auth.uid();

  return true;
end;
$$;

revoke all on function public.remove_own_ping(uuid) from public, anon, authenticated;
grant execute on function public.remove_own_ping(uuid) to authenticated;

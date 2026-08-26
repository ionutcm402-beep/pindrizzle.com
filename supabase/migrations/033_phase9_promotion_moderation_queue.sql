alter table public.promotions
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists review_notes text;

create or replace function public.moderation_promotion_history()
returns table (
  promotion_id uuid,
  ping_id uuid,
  ping_title text,
  ping_body text,
  ping_status text,
  promoter_user_id uuid,
  promoter_name text,
  sponsor_name text,
  promotion_status text,
  target_radius_meters integer,
  duration_hours integer,
  quoted_price_pence integer,
  currency text,
  payment_status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_name text,
  review_notes text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  return query
  select
    pr.id,
    pr.ping_id,
    p.title,
    p.body,
    p.status::text,
    pr.promoter_user_id,
    coalesce(promoter.display_name, 'Neighbour'),
    pr.sponsor_name,
    pr.status,
    pr.target_radius_meters,
    pr.duration_hours,
    pr.quoted_price_pence,
    pr.currency,
    pr.payment_status,
    pr.requested_at,
    pr.reviewed_at,
    coalesce(reviewer.display_name, ''),
    pr.review_notes
  from public.promotions pr
  join public.pings p on p.id = pr.ping_id
  left join public.profiles promoter on promoter.id = pr.promoter_user_id
  left join public.profiles reviewer on reviewer.id = pr.reviewed_by
  order by
    case when pr.status = 'pending' then 0 else 1 end,
    pr.requested_at desc;
end;
$$;

revoke all on function public.moderation_promotion_history() from public;
grant execute on function public.moderation_promotion_history() to authenticated;

create or replace function public.moderate_promotion_request(
  target_promotion_id uuid,
  moderation_action text,
  moderation_notes text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  current_status text;
begin
  if me is null or not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  if moderation_action not in ('approve','reject') then
    raise exception 'Unsupported promotion moderation action';
  end if;

  select pr.status into current_status
  from public.promotions pr
  where pr.id = target_promotion_id
  for update;

  if not found then
    raise exception 'Promotion request not found';
  end if;

  if current_status <> 'pending' then
    raise exception 'Only pending promotion requests can be reviewed';
  end if;

  if moderation_action = 'approve' then
    update public.promotions
    set status = 'approved',
        approved_at = now(),
        reviewed_at = now(),
        reviewed_by = me,
        review_notes = nullif(trim(coalesce(moderation_notes,'')), ''),
        updated_at = now()
    where id = target_promotion_id;
    return 'approved';
  end if;

  update public.promotions
  set status = 'rejected',
      approved_at = null,
      reviewed_at = now(),
      reviewed_by = me,
      review_notes = nullif(trim(coalesce(moderation_notes,'')), ''),
      updated_at = now()
  where id = target_promotion_id;

  return 'rejected';
end;
$$;

revoke all on function public.moderate_promotion_request(uuid,text,text) from public;
grant execute on function public.moderate_promotion_request(uuid,text,text) to authenticated;
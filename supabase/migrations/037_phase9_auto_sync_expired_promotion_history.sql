create or replace function public.my_promotion_requests()
returns table(
  promotion_id uuid,
  ping_id uuid,
  ping_title text,
  sponsor_name text,
  status text,
  target_radius_meters integer,
  duration_hours integer,
  quoted_price_pence integer,
  currency text,
  payment_status text,
  requested_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_expired_promotions();
  return query
  select
    pr.id,
    pr.ping_id,
    p.title,
    pr.sponsor_name,
    pr.status,
    pr.target_radius_meters,
    pr.duration_hours,
    pr.quoted_price_pence,
    pr.currency,
    pr.payment_status,
    pr.requested_at,
    pr.starts_at,
    pr.ends_at
  from public.promotions pr
  join public.pings p on p.id = pr.ping_id
  where pr.promoter_user_id = auth.uid()
  order by pr.requested_at desc;
end;
$$;

create or replace function public.moderation_promotion_history()
returns table(
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
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  perform public.sync_expired_promotions();

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

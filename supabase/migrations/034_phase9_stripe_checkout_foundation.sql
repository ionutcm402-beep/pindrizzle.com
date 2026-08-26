alter table public.promotions
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at timestamptz;

create unique index if not exists promotions_stripe_checkout_session_uidx
  on public.promotions(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create or replace function public.prepare_promotion_checkout(target_promotion_id uuid)
returns table (
  promotion_id uuid,
  ping_id uuid,
  ping_title text,
  sponsor_name text,
  quoted_price_pence integer,
  currency text,
  duration_hours integer,
  target_radius_meters integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Authentication required'; end if;

  return query
  select
    pr.id,
    pr.ping_id,
    p.title,
    pr.sponsor_name,
    pr.quoted_price_pence,
    pr.currency,
    pr.duration_hours,
    pr.target_radius_meters
  from public.promotions pr
  join public.pings p on p.id = pr.ping_id
  where pr.id = target_promotion_id
    and pr.promoter_user_id = me
    and pr.status = 'approved'
    and pr.payment_status = 'unpaid'
    and pr.quoted_price_pence is not null
    and pr.quoted_price_pence > 0
    and pr.currency = 'GBP'
    and p.status = 'active'
    and p.expires_at >= now() + make_interval(hours => pr.duration_hours) + interval '35 minutes';

  if not found then
    raise exception 'This promotion is not ready for checkout or the Ping no longer has enough time left';
  end if;
end;
$$;

revoke all on function public.prepare_promotion_checkout(uuid) from public, anon;
grant execute on function public.prepare_promotion_checkout(uuid) to authenticated;

create or replace function public.finalize_promotion_payment(
  target_promotion_id uuid,
  checkout_session_id text,
  payment_intent_id text,
  amount_total integer,
  paid_currency text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  pr public.promotions%rowtype;
  p public.pings%rowtype;
begin
  if coalesce(trim(checkout_session_id),'') = '' then raise exception 'Missing checkout session'; end if;

  select * into pr from public.promotions where id = target_promotion_id for update;
  if not found then raise exception 'Promotion not found'; end if;

  if pr.payment_status = 'paid' then
    if pr.stripe_checkout_session_id = checkout_session_id then return true; end if;
    raise exception 'Promotion was already paid by a different checkout';
  end if;

  if pr.status <> 'approved' or pr.payment_status <> 'unpaid' then
    raise exception 'Promotion is not awaiting payment';
  end if;
  if lower(coalesce(paid_currency,'')) <> 'gbp' then raise exception 'Unexpected payment currency'; end if;
  if amount_total is distinct from pr.quoted_price_pence then raise exception 'Payment amount does not match quote'; end if;

  select * into p from public.pings where id = pr.ping_id for update;
  if not found or p.status <> 'active' then raise exception 'Ping is no longer active'; end if;
  if p.expires_at < now() + make_interval(hours => pr.duration_hours) then
    raise exception 'Ping no longer has enough time for this promotion';
  end if;

  update public.promotions
  set payment_status = 'paid',
      status = 'active',
      stripe_checkout_session_id = checkout_session_id,
      stripe_payment_intent_id = nullif(payment_intent_id,''),
      paid_at = now(),
      starts_at = now(),
      ends_at = now() + make_interval(hours => pr.duration_hours),
      updated_at = now()
  where id = target_promotion_id;

  return true;
end;
$$;

revoke all on function public.finalize_promotion_payment(uuid,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.finalize_promotion_payment(uuid,text,text,integer,text) to service_role;

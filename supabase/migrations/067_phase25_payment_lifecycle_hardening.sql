alter table public.promotions
  add column if not exists pending_checkout_session_id text,
  add column if not exists pending_checkout_expires_at timestamptz,
  add column if not exists checkout_claim_token uuid,
  add column if not exists checkout_claim_expires_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists disputed_at timestamptz,
  add column if not exists payment_issue_note text;

alter table public.promotions drop constraint if exists promotions_payment_status_check;
alter table public.promotions
  add constraint promotions_payment_status_check
  check (payment_status in ('unpaid','paid','refunded','disputed','waived'));

alter table public.promotions drop constraint if exists promotions_payment_issue_note_check;
alter table public.promotions
  add constraint promotions_payment_issue_note_check
  check (payment_issue_note is null or char_length(payment_issue_note) <= 500);

create unique index if not exists promotions_checkout_session_unique_idx
  on public.promotions(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create unique index if not exists promotions_payment_intent_unique_idx
  on public.promotions(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create index if not exists promotions_pending_checkout_expiry_idx
  on public.promotions(pending_checkout_expires_at)
  where pending_checkout_session_id is not null;

create table if not exists public.promotion_payment_events (
  stripe_event_id text primary key,
  promotion_id uuid references public.promotions(id) on delete set null,
  event_type text not null check (event_type in ('checkout.completed','refund','dispute.created','dispute.closed')),
  stripe_payment_intent_id text,
  amount integer check (amount is null or amount >= 0),
  currency text,
  outcome text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.promotion_payment_events enable row level security;
revoke all on table public.promotion_payment_events from public, anon, authenticated;
grant select, insert, update on table public.promotion_payment_events to service_role;
create index if not exists promotion_payment_events_promotion_created_idx
  on public.promotion_payment_events(promotion_id, created_at desc)
  where promotion_id is not null;
create index if not exists promotion_payment_events_payment_intent_idx
  on public.promotion_payment_events(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create or replace function public.claim_promotion_checkout(target_promotion_id uuid, claim_token uuid)
returns table(
  checkout_action text,
  existing_session_id text,
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
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  pr public.promotions%rowtype;
  p public.pings%rowtype;
begin
  if me is null then raise exception 'Authentication required'; end if;
  if claim_token is null then raise exception 'Checkout claim token is required'; end if;

  select * into pr from public.promotions where id = target_promotion_id for update;
  if not found or pr.promoter_user_id <> me then raise exception 'Promotion not found'; end if;
  if pr.status <> 'approved' or pr.payment_status <> 'unpaid' or pr.quoted_price_pence is null or pr.quoted_price_pence <= 0 or pr.currency <> 'GBP' then
    raise exception 'This promotion is not ready for payment';
  end if;

  select * into p from public.pings where id = pr.ping_id;
  if not found or p.status <> 'active' or p.expires_at < now() + make_interval(hours => pr.duration_hours) + interval '35 minutes' then
    raise exception 'This Ping no longer has enough time for the promotion';
  end if;

  if pr.pending_checkout_session_id is not null and pr.pending_checkout_expires_at > now() + interval '30 seconds' then
    return query select 'existing'::text, pr.pending_checkout_session_id, pr.id, pr.ping_id, p.title, pr.sponsor_name,
      pr.quoted_price_pence, pr.currency, pr.duration_hours, pr.target_radius_meters;
    return;
  end if;

  if pr.checkout_claim_token is not null
     and pr.checkout_claim_expires_at > now()
     and pr.checkout_claim_token <> claim_token then
    raise exception 'Checkout is already starting. Please try again in a moment';
  end if;

  update public.promotions
  set pending_checkout_session_id = null,
      pending_checkout_expires_at = null,
      checkout_claim_token = claim_token,
      checkout_claim_expires_at = now() + interval '90 seconds',
      updated_at = now()
  where id = pr.id;

  return query select 'claimed'::text, null::text, pr.id, pr.ping_id, p.title, pr.sponsor_name,
    pr.quoted_price_pence, pr.currency, pr.duration_hours, pr.target_radius_meters;
end;
$$;

create or replace function public.register_promotion_checkout(
  target_promotion_id uuid,
  claim_token uuid,
  checkout_session_id text,
  checkout_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  pr public.promotions%rowtype;
begin
  if me is null then raise exception 'Authentication required'; end if;
  if coalesce(trim(checkout_session_id),'') = '' then raise exception 'Checkout session is required'; end if;
  if checkout_expires_at <= now() or checkout_expires_at > now() + interval '1 hour' then raise exception 'Invalid checkout expiry'; end if;

  select * into pr from public.promotions where id = target_promotion_id for update;
  if not found or pr.promoter_user_id <> me then raise exception 'Promotion not found'; end if;
  if pr.status <> 'approved' or pr.payment_status <> 'unpaid' then raise exception 'Promotion is no longer awaiting payment'; end if;
  if pr.checkout_claim_token is distinct from claim_token or pr.checkout_claim_expires_at <= now() then
    raise exception 'Checkout claim expired';
  end if;

  update public.promotions
  set pending_checkout_session_id = checkout_session_id,
      pending_checkout_expires_at = checkout_expires_at,
      checkout_claim_token = null,
      checkout_claim_expires_at = null,
      updated_at = now()
  where id = target_promotion_id;
  return true;
end;
$$;

create or replace function public.release_promotion_checkout_claim(target_promotion_id uuid, claim_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Authentication required'; end if;
  update public.promotions
  set checkout_claim_token = null,
      checkout_claim_expires_at = null,
      updated_at = now()
  where id = target_promotion_id
    and promoter_user_id = me
    and checkout_claim_token = claim_token
    and payment_status = 'unpaid';
  return found;
end;
$$;

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
  if coalesce(trim(payment_intent_id),'') = '' then raise exception 'Missing payment intent'; end if;

  select * into pr from public.promotions where id = target_promotion_id for update;
  if not found then raise exception 'Promotion not found'; end if;

  if pr.payment_status = 'paid' then
    if pr.stripe_checkout_session_id = checkout_session_id and pr.stripe_payment_intent_id = payment_intent_id then return true; end if;
    raise exception 'Promotion was already paid by a different checkout';
  end if;

  if pr.status <> 'approved' or pr.payment_status <> 'unpaid' then raise exception 'Promotion is not awaiting payment'; end if;
  if lower(coalesce(paid_currency,'')) <> 'gbp' then raise exception 'Unexpected payment currency'; end if;
  if amount_total is distinct from pr.quoted_price_pence then raise exception 'Payment amount does not match quote'; end if;
  if pr.pending_checkout_session_id is not null and pr.pending_checkout_session_id <> checkout_session_id then
    raise exception 'Unexpected checkout session';
  end if;

  select * into p from public.pings where id = pr.ping_id for update;
  if not found or p.status <> 'active' then raise exception 'Ping is no longer active'; end if;
  if p.expires_at < now() + make_interval(hours => pr.duration_hours) then raise exception 'Ping no longer has enough time for this promotion'; end if;

  update public.promotions
  set payment_status = 'paid',
      status = 'active',
      stripe_checkout_session_id = checkout_session_id,
      stripe_payment_intent_id = payment_intent_id,
      paid_at = now(),
      starts_at = now(),
      ends_at = now() + make_interval(hours => pr.duration_hours),
      pending_checkout_session_id = null,
      pending_checkout_expires_at = null,
      checkout_claim_token = null,
      checkout_claim_expires_at = null,
      payment_issue_note = null,
      updated_at = now()
  where id = target_promotion_id;

  return true;
end;
$$;

create or replace function public.record_promotion_payment_event(
  stripe_event_id text,
  event_kind text,
  payment_intent_id text,
  event_amount integer,
  event_currency text,
  event_outcome text default null,
  event_details jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pr public.promotions%rowtype;
  ping_active boolean := false;
  inserted_event boolean := false;
begin
  if coalesce(trim(stripe_event_id),'') = '' or stripe_event_id !~ '^evt_' then raise exception 'Invalid Stripe event id'; end if;
  if event_kind not in ('checkout.completed','refund','dispute.created','dispute.closed') then raise exception 'Unsupported payment event'; end if;
  if coalesce(trim(payment_intent_id),'') = '' then raise exception 'Payment intent is required'; end if;
  if event_amount is not null and event_amount < 0 then raise exception 'Invalid payment amount'; end if;

  insert into public.promotion_payment_events(stripe_event_id,event_type,stripe_payment_intent_id,amount,currency,outcome,details)
  values (stripe_event_id,event_kind,payment_intent_id,event_amount,lower(nullif(trim(coalesce(event_currency,'')),'')),nullif(trim(coalesce(event_outcome,'')),''),coalesce(event_details,'{}'::jsonb))
  on conflict (stripe_event_id) do nothing;
  get diagnostics inserted_event = row_count;
  if not inserted_event then return 'duplicate'; end if;

  select * into pr from public.promotions where stripe_payment_intent_id = payment_intent_id for update;
  if not found then return 'unmatched'; end if;

  update public.promotion_payment_events set promotion_id = pr.id where stripe_event_id = record_promotion_payment_event.stripe_event_id;

  if event_kind = 'refund' and event_outcome = 'full' then
    update public.promotions
    set payment_status = 'refunded',
        status = case when status in ('active','paused') then 'ended' else status end,
        refunded_at = coalesce(refunded_at, now()),
        payment_issue_note = 'Stripe payment fully refunded',
        updated_at = now()
    where id = pr.id;
    return 'refunded';
  end if;

  if event_kind = 'dispute.created' then
    update public.promotions
    set payment_status = case when payment_status = 'paid' then 'disputed' else payment_status end,
        status = case when status = 'active' then 'paused' else status end,
        disputed_at = coalesce(disputed_at, now()),
        payment_issue_note = 'Stripe dispute opened',
        updated_at = now()
    where id = pr.id;
    return 'disputed';
  end if;

  if event_kind = 'dispute.closed' and event_outcome = 'won' then
    select exists(select 1 from public.pings p where p.id = pr.ping_id and p.status = 'active' and p.expires_at > now()) into ping_active;
    update public.promotions
    set payment_status = case when payment_status = 'disputed' then 'paid' else payment_status end,
        status = case when status = 'paused' and ends_at > now() and ping_active then 'active' when status = 'paused' then 'ended' else status end,
        payment_issue_note = 'Stripe dispute closed in promoter favour',
        updated_at = now()
    where id = pr.id;
    return 'dispute_won';
  end if;

  if event_kind = 'dispute.closed' and event_outcome = 'lost' then
    update public.promotions
    set payment_status = 'disputed',
        status = case when status in ('active','paused') then 'ended' else status end,
        payment_issue_note = 'Stripe dispute lost',
        updated_at = now()
    where id = pr.id;
    return 'dispute_lost';
  end if;

  return 'recorded';
end;
$$;

revoke execute on function public.claim_promotion_checkout(uuid,uuid) from public, anon;
revoke execute on function public.register_promotion_checkout(uuid,uuid,text,timestamptz) from public, anon;
revoke execute on function public.release_promotion_checkout_claim(uuid,uuid) from public, anon;
grant execute on function public.claim_promotion_checkout(uuid,uuid) to authenticated;
grant execute on function public.register_promotion_checkout(uuid,uuid,text,timestamptz) to authenticated;
grant execute on function public.release_promotion_checkout_claim(uuid,uuid) to authenticated;

revoke execute on function public.finalize_promotion_payment(uuid,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.finalize_promotion_payment(uuid,text,text,integer,text) to service_role;
revoke execute on function public.record_promotion_payment_event(text,text,text,integer,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.record_promotion_payment_event(text,text,text,integer,text,text,jsonb) to service_role;

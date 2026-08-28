drop function if exists public.record_promotion_payment_event(text,text,text,integer,text,text,jsonb);

create function public.record_promotion_payment_event(
  p_stripe_event_id text,
  p_event_kind text,
  p_payment_intent_id text,
  p_event_amount integer,
  p_event_currency text,
  p_event_outcome text default null,
  p_event_details jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pr public.promotions%rowtype;
  ping_active boolean := false;
  inserted_count bigint := 0;
begin
  if coalesce(trim(p_stripe_event_id),'') = '' or p_stripe_event_id !~ '^evt_' then raise exception 'Invalid Stripe event id'; end if;
  if p_event_kind not in ('checkout.completed','refund','dispute.created','dispute.closed') then raise exception 'Unsupported payment event'; end if;
  if coalesce(trim(p_payment_intent_id),'') = '' then raise exception 'Payment intent is required'; end if;
  if p_event_amount is not null and p_event_amount < 0 then raise exception 'Invalid payment amount'; end if;

  insert into public.promotion_payment_events(stripe_event_id,event_type,stripe_payment_intent_id,amount,currency,outcome,details)
  values (p_stripe_event_id,p_event_kind,p_payment_intent_id,p_event_amount,lower(nullif(trim(coalesce(p_event_currency,'')),'')),nullif(trim(coalesce(p_event_outcome,'')),''),coalesce(p_event_details,'{}'::jsonb))
  on conflict on constraint promotion_payment_events_pkey do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return 'duplicate'; end if;

  select * into pr from public.promotions where stripe_payment_intent_id = p_payment_intent_id for update;
  if not found then return 'unmatched'; end if;

  update public.promotion_payment_events set promotion_id = pr.id where stripe_event_id = p_stripe_event_id;

  if p_event_kind = 'refund' and p_event_outcome = 'full' then
    update public.promotions
    set payment_status = 'refunded',
        status = case when status in ('active','paused') then 'ended' else status end,
        refunded_at = coalesce(refunded_at, now()),
        payment_issue_note = 'Stripe payment fully refunded',
        updated_at = now()
    where id = pr.id;
    return 'refunded';
  end if;

  if p_event_kind = 'dispute.created' then
    update public.promotions
    set payment_status = case when payment_status = 'paid' then 'disputed' else payment_status end,
        status = case when status = 'active' then 'paused' else status end,
        disputed_at = coalesce(disputed_at, now()),
        payment_issue_note = 'Stripe dispute opened',
        updated_at = now()
    where id = pr.id;
    return 'disputed';
  end if;

  if p_event_kind = 'dispute.closed' and p_event_outcome = 'won' then
    select exists(select 1 from public.pings p where p.id = pr.ping_id and p.status = 'active' and p.expires_at > now()) into ping_active;
    update public.promotions
    set payment_status = case when payment_status = 'disputed' then 'paid' else payment_status end,
        status = case when status = 'paused' and ends_at > now() and ping_active then 'active' when status = 'paused' then 'ended' else status end,
        payment_issue_note = 'Stripe dispute closed in promoter favour',
        updated_at = now()
    where id = pr.id;
    return 'dispute_won';
  end if;

  if p_event_kind = 'dispute.closed' and p_event_outcome = 'lost' then
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

revoke execute on function public.record_promotion_payment_event(text,text,text,integer,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.record_promotion_payment_event(text,text,text,integer,text,text,jsonb) to service_role;

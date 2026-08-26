alter table public.promotions add column if not exists baseline_confirmation_count integer, add column if not exists baseline_comment_count integer;

create table if not exists public.promotion_events (
  id bigint generated always as identity primary key,
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  event_type text not null check (event_type in ('impression','open')),
  browser_session_id uuid not null,
  created_at timestamptz not null default now(),
  unique (promotion_id, event_type, browser_session_id)
);

alter table public.promotion_events enable row level security;
revoke all on table public.promotion_events from public, anon, authenticated;
revoke all on sequence public.promotion_events_id_seq from public, anon, authenticated;

create or replace function public.capture_promotion_start_baseline()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    select p.confirmation_count, p.comment_count into new.baseline_confirmation_count, new.baseline_comment_count
    from public.pings p where p.id = new.ping_id;
  end if;
  return new;
end; $$;

drop trigger if exists capture_promotion_start_baseline on public.promotions;
create trigger capture_promotion_start_baseline before update on public.promotions
for each row execute function public.capture_promotion_start_baseline();

update public.promotions pr
set baseline_confirmation_count = p.confirmation_count, baseline_comment_count = p.comment_count
from public.pings p
where p.id = pr.ping_id and pr.status = 'active'
  and (pr.baseline_confirmation_count is null or pr.baseline_comment_count is null);

create or replace function public.record_promotion_event(target_promotion_id uuid, event_kind text, browser_session uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare owner_id uuid;
begin
  if target_promotion_id is null or browser_session is null then return false; end if;
  if event_kind not in ('impression','open') then return false; end if;
  select pr.promoter_user_id into owner_id
  from public.promotions pr join public.pings p on p.id = pr.ping_id
  where pr.id = target_promotion_id and pr.status = 'active'
    and pr.payment_status in ('paid','waived') and pr.starts_at <= now() and pr.ends_at > now()
    and p.status = 'active' and p.expires_at > now();
  if owner_id is null then return false; end if;
  if auth.uid() is not null and auth.uid() = owner_id then return false; end if;
  insert into public.promotion_events (promotion_id, event_type, browser_session_id)
  values (target_promotion_id, event_kind, browser_session)
  on conflict (promotion_id, event_type, browser_session_id) do nothing;
  return true;
end; $$;

revoke all on function public.record_promotion_event(uuid,text,uuid) from public;
grant execute on function public.record_promotion_event(uuid,text,uuid) to anon, authenticated;

create or replace function public.my_promotion_dashboard()
returns table(
  promotion_id uuid, ping_id uuid, ping_title text, sponsor_name text, status text,
  target_radius_meters integer, duration_hours integer, quoted_price_pence integer, currency text,
  payment_status text, requested_at timestamptz, approved_at timestamptz, paid_at timestamptz,
  starts_at timestamptz, ends_at timestamptz, review_notes text,
  impression_sessions bigint, open_sessions bigint, confirmation_gain integer, reply_gain integer,
  minutes_remaining integer
)
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Authentication required'; end if;
  perform public.sync_expired_promotions();
  return query
  select pr.id, pr.ping_id, p.title, pr.sponsor_name, pr.status, pr.target_radius_meters,
    pr.duration_hours, pr.quoted_price_pence, pr.currency, pr.payment_status, pr.requested_at,
    pr.approved_at, pr.paid_at, pr.starts_at, pr.ends_at, pr.review_notes,
    count(pe.id) filter (where pe.event_type = 'impression')::bigint,
    count(pe.id) filter (where pe.event_type = 'open')::bigint,
    greatest(0, p.confirmation_count - coalesce(pr.baseline_confirmation_count, p.confirmation_count))::integer,
    greatest(0, p.comment_count - coalesce(pr.baseline_comment_count, p.comment_count))::integer,
    greatest(0, floor(extract(epoch from (pr.ends_at - now())) / 60))::integer
  from public.promotions pr
  join public.pings p on p.id = pr.ping_id
  left join public.promotion_events pe on pe.promotion_id = pr.id
  where pr.promoter_user_id = me
  group by pr.id, p.id
  order by pr.requested_at desc;
end; $$;

revoke all on function public.my_promotion_dashboard() from public, anon;
grant execute on function public.my_promotion_dashboard() to authenticated;

create index if not exists promotion_events_created_at_idx on public.promotion_events (created_at desc);

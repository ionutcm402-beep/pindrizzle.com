create or replace function public.ping_author_context(target_ping_id uuid)
returns table (
  display_name text,
  helpful_pings integer,
  confirmations integer,
  member_since timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(nullif(trim(pr.display_name), ''), 'Neighbour') as display_name,
    greatest(coalesce(pr.helpful_pings, 0), 0)::integer as helpful_pings,
    greatest(coalesce(pr.confirmation_count, 0), 0)::integer as confirmations,
    pr.created_at as member_since
  from public.pings p
  join public.profiles pr on pr.id = p.user_id
  where p.id = target_ping_id
    and p.status = 'active'
    and p.expires_at > now()
    and not public.ping_hidden_for_viewer(p.id, p.user_id)
  limit 1;
$$;

revoke all on function public.ping_author_context(uuid) from public;
grant execute on function public.ping_author_context(uuid) to anon, authenticated;

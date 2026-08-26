-- Phase 10 final privacy/dead-RPC cleanup.

-- Public profile reads only need contributor identity/trust fields. Keep legacy
-- home_area and other nonessential profile columns out of browser Data API reads.
revoke select on table public.profiles from anon, authenticated;
grant select (id, display_name, helpful_pings, confirmation_count, created_at)
  on table public.profiles to anon, authenticated;

-- Current clients use toggle_block_user(). Retire the older duplicated block
-- mutation entry points so there is one guarded block/unblock RPC surface.
revoke all on function public.block_user(uuid) from public, anon, authenticated;
revoke all on function public.unblock_user(uuid) from public, anon, authenticated;

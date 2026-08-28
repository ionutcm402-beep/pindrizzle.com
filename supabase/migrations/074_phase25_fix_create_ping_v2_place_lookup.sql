-- Phase 25.5: allow create_ping_v2 to resolve internal place labels without exposing place_cells.
-- The RPC still requires auth.uid(), sets user_id from auth.uid(), and all existing
-- closed-beta, rate-limit, privacy-snap and table constraints continue to apply.

alter function public.create_ping_v2(
  public.ping_category,
  text,
  text,
  double precision,
  double precision,
  text,
  integer,
  text,
  text,
  text
) security definer;

alter function public.create_ping_v2(
  public.ping_category,
  text,
  text,
  double precision,
  double precision,
  text,
  integer,
  text,
  text,
  text
) set search_path = public, pg_temp;

revoke all on function public.create_ping_v2(
  public.ping_category,
  text,
  text,
  double precision,
  double precision,
  text,
  integer,
  text,
  text,
  text
) from public, anon;

grant execute on function public.create_ping_v2(
  public.ping_category,
  text,
  text,
  double precision,
  double precision,
  text,
  integer,
  text,
  text,
  text
) to authenticated, service_role;

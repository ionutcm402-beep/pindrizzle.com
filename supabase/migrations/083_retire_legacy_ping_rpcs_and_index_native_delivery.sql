-- Applied to Supabase as migration 20260828213350
-- retire_legacy_ping_rpcs_and_index_native_delivery
--
-- Keep current public website entry points unchanged while reducing legacy API
-- surface and adding the missing FK-supporting index reported by the advisor.

create index if not exists native_push_delivery_attempts_device_id_idx
  on public.native_push_delivery_attempts (device_id);

-- create_ping_v4 is the canonical create endpoint. It calls v3 internally as
-- the SECURITY DEFINER owner, so browser roles do not need direct v2/v3 access.
revoke execute on function public.create_ping_v2(
  public.ping_category,text,text,double precision,double precision,text,integer,text,text,text
) from public, anon, authenticated;

revoke execute on function public.create_ping_v3(
  public.ping_category,text,text,double precision,double precision,text,integer,text,text,text,
  text,text,text,numeric,text,text,text
) from public, anon, authenticated;

-- update_own_ping_v2 is the canonical edit endpoint and invokes the older
-- update function internally as the SECURITY DEFINER owner.
revoke execute on function public.update_own_ping(
  uuid,text,text,integer,text,text,text,text,text,text,numeric,text,text,text
) from public, anon, authenticated;

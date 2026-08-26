-- Phase 10 post-merge lock: report submission now uses report_ping() exclusively.
-- Keep authenticated users able to read their own reports through existing RLS,
-- but remove direct browser INSERT access and its compatibility policy.

revoke insert on table public.reports from authenticated;

drop policy if exists "users create reports" on public.reports;

revoke all on function public.report_ping(uuid,text,text) from public, anon;
grant execute on function public.report_ping(uuid,text,text) to authenticated;

-- Phase 10 launch hardening: reports are submitted through report_ping(),
-- which validates the target/reason/rate limit and hides the Ping for the reporter.
-- Keep direct reads of a user's own reports, but remove direct browser inserts.

revoke insert on table public.reports from authenticated;

drop policy if exists "users create reports" on public.reports;

revoke all on function public.report_ping(uuid,text,text) from public, anon;
grant execute on function public.report_ping(uuid,text,text) to authenticated;

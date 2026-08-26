-- Keep production main compatible until the Phase 10 code that uses report_ping()
-- is explicitly approved and merged. The existing report validation trigger and RLS
-- continue to enforce reporter ownership/reason/rate limits on direct inserts.

grant insert on table public.reports to authenticated;

drop policy if exists "users create reports" on public.reports;
create policy "users create reports"
on public.reports
for insert
to authenticated
with check ((select auth.uid()) = reporter_id);

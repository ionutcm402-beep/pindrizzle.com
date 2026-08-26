drop policy if exists "users read own compliance requests" on public.compliance_requests;
drop policy if exists "moderators read compliance requests" on public.compliance_requests;

create policy "read own or moderate compliance requests"
  on public.compliance_requests
  for select
  to authenticated
  using ((select auth.uid()) = user_id or public.is_moderator());

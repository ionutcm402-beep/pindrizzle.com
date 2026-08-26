create index if not exists beta_access_invite_id_idx on public.beta_access(invite_id) where invite_id is not null;
create index if not exists beta_invites_created_by_idx on public.beta_invites(created_by) where created_by is not null;

drop policy if exists "users read own beta access" on public.beta_access;
drop policy if exists "moderators read beta access" on public.beta_access;
create policy "beta access readable by owner or moderator"
on public.beta_access for select to authenticated
using (user_id = (select auth.uid()) or public.is_moderator());

drop policy if exists "users read own beta feedback" on public.beta_feedback;
drop policy if exists "moderators read beta feedback" on public.beta_feedback;
create policy "beta feedback readable by owner or moderator"
on public.beta_feedback for select to authenticated
using (user_id = (select auth.uid()) or public.is_moderator());

-- Phase 10 performance hardening: simplify client-facing RLS and add covering
-- indexes for foreign keys used by community, notification and moderation flows.

-- Profiles are read-only to browser clients in Phase 10. Reputation/profile
-- mutations are database-owned, so the old broad ALL policy is no longer needed.
drop policy if exists "users manage own profile" on public.profiles;

-- Ping creation remains authenticated and owner-bound. Direct Ping updates are
-- no longer granted to clients; resolve/moderation/count updates use RPCs/triggers.
drop policy if exists "users create own pings" on public.pings;
create policy "users create own pings"
on public.pings for insert
to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "users update own pings" on public.pings;

-- Confirmations.
drop policy if exists "users confirm as themselves" on public.confirmations;
create policy "users confirm as themselves"
on public.confirmations for insert
to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "users remove own confirmation" on public.confirmations;
create policy "users remove own confirmation"
on public.confirmations for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Replies.
drop policy if exists "users comment as themselves" on public.comments;
create policy "users comment as themselves"
on public.comments for insert
to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "users delete own comments" on public.comments;
create policy "users delete own comments"
on public.comments for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Reports.
drop policy if exists "users create reports" on public.reports;
create policy "users create reports"
on public.reports for insert
to authenticated
with check ((select auth.uid()) = reporter_id);
drop policy if exists "users read own reports" on public.reports;
create policy "users read own reports"
on public.reports for select
to authenticated
using ((select auth.uid()) = reporter_id);

-- Block table is read-only from clients; writes go through guarded RPCs.
drop policy if exists "users manage own blocks" on public.blocks;
create policy "users read own blocks"
on public.blocks for select
to authenticated
using ((select auth.uid()) = blocker_id);

-- Notification rows are read/marked-read by their owner. No direct deletes.
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
on public.notifications for select
to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications"
on public.notifications for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "users delete own notifications" on public.notifications;

-- Notification preferences.
drop policy if exists "users read own notification preferences" on public.notification_preferences;
create policy "users read own notification preferences"
on public.notification_preferences for select
to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "users insert own notification preferences" on public.notification_preferences;
create policy "users insert own notification preferences"
on public.notification_preferences for insert
to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "users update own notification preferences" on public.notification_preferences;
create policy "users update own notification preferences"
on public.notification_preferences for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Safety/follow reads.
drop policy if exists "users read own hidden pings" on public.ping_hides;
create policy "users read own hidden pings"
on public.ping_hides for select
to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "users read own follows" on public.ping_follows;
create policy "users read own follows"
on public.ping_follows for select
to authenticated
using ((select auth.uid()) = user_id);

-- Cover common foreign-key lookups and cascade/moderation paths.
create index if not exists blocks_blocked_id_idx on public.blocks(blocked_id);
create index if not exists comments_ping_id_idx on public.comments(ping_id);
create index if not exists comments_user_id_idx on public.comments(user_id);
create index if not exists confirmations_user_id_idx on public.confirmations(user_id);
create index if not exists notifications_actor_id_idx on public.notifications(actor_id);
create index if not exists notifications_ping_id_idx on public.notifications(ping_id);
create index if not exists ping_helpful_user_id_idx on public.ping_helpful(user_id);
create index if not exists ping_hides_ping_id_idx on public.ping_hides(ping_id);
create index if not exists promotions_reviewed_by_idx on public.promotions(reviewed_by);
create index if not exists report_reviews_reviewed_by_idx on public.report_reviews(reviewed_by);
create index if not exists reports_reporter_id_idx on public.reports(reporter_id);

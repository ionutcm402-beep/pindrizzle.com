revoke all on function public.notification_blocked(uuid, uuid) from public, anon, authenticated;
revoke all on function public.notification_enabled(uuid, public.notification_kind) from public, anon, authenticated;
revoke all on function public.notify_comment_activity() from public, anon, authenticated;
revoke all on function public.notify_confirmation_activity() from public, anon, authenticated;
revoke all on function public.notify_helpful_activity() from public, anon, authenticated;

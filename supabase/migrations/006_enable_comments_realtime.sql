-- Phase 4: keep open Ping conversations live for all viewers.
-- Safe to apply once on projects where comments are not already in supabase_realtime.
alter publication supabase_realtime add table public.comments;

-- Phase 4: make Ping map react to live changes.
-- Supabase Realtime will broadcast INSERT/UPDATE/DELETE events for public.pings.
alter publication supabase_realtime add table public.pings;

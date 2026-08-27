-- Phase 25.5: expand Ping's real-time local utility categories.
-- Kept separate from the metadata migration because PostgreSQL enum values
-- should be committed before later DDL/functions reference the new values.

alter type public.ping_category add value if not exists 'deals';
alter type public.ping_category add value if not exists 'parking';
alter type public.ping_category add value if not exists 'events';
alter type public.ping_category add value if not exists 'outages';

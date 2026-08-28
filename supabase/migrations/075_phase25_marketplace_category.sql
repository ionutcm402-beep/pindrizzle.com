-- Phase 25.5: add one broad Marketplace category.
-- Property, vehicles and parking-space listings are structured subtypes so the
-- top-level Ping category list stays useful instead of becoming fragmented.

alter type public.ping_category add value if not exists 'marketplace';

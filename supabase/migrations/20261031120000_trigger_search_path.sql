-- Supabase security advisor (2026-10-31): trigger functions without a fixed search_path. Neither body
-- references a schema object, so an empty search_path changes nothing but closes the lint.
alter function v1.immutable() set search_path = '';
alter function v1.snapshot_guard() set search_path = '';

-- RIO Level 1 · 1/5 — add the administrator role.
--
-- Kept in its own migration: Postgres cannot use a newly added enum value in
-- the same transaction that adds it. Only an existing admin (or the database
-- owner, for the very first admin — see docs/level-1/SETUP.md) can grant it.

alter type public.user_role add value if not exists 'admin';

-- 007: grandfather EXISTING installs to Spanish (ADR-009 / WP-017). Fresh
-- installs insert nothing here → the app default (en) applies. "Existing" =
-- the DB already carries user data by the time this migration runs (matches
-- table exists since 002, meta since 001), so the EXISTS checks are false on
-- a brand-new database and true on an upgrade.
INSERT OR IGNORE INTO meta (key, value)
SELECT 'settings.locale', 'es'
WHERE EXISTS (SELECT 1 FROM matches)
   OR EXISTS (SELECT 1 FROM meta WHERE key = 'settings.riotId')
   OR EXISTS (SELECT 1 FROM meta WHERE key = 'settings.theme');

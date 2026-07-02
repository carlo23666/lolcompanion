-- 001: meta table. Stores schema bookkeeping and app-level key/values.
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

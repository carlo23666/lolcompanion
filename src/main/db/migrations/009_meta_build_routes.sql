-- 009: coherent Master+ build routes (WP-021).
--
-- Item frequency and average slot cannot tell whether two items belong to the
-- same build. Store the observed starter + ordered finished-item sequence so
-- the engine selects a real route before applying contextual adjustments.
-- `route` is a canonical comma-separated list of positive item ids.
ALTER TABLE meta_matches ADD COLUMN hasRoute INTEGER NOT NULL DEFAULT 0;

CREATE TABLE meta_build_routes (
  patch TEXT NOT NULL,
  champion TEXT NOT NULL,
  role TEXT NOT NULL,
  starterId INTEGER NOT NULL DEFAULT 0,
  route TEXT NOT NULL,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (patch, champion, role, starterId, route)
);

CREATE INDEX idx_meta_build_routes_lookup
  ON meta_build_routes (patch, champion, role, games DESC);

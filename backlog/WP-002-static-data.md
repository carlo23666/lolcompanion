# WP-002 — Static data manager (Data Dragon)

## Objective
Local, patch-versioned cache of items/champions/runes exposing the queries the engine needs.

## Scope
- `src/main/staticdata/`: fetch latest version from ddragon versions.json; download `item.json`, `champion.json` (+ per-champion on demand), `runesReforged.json` for `es_ES`; cache under app userData dir by patch; serve from cache when offline.
- zod schemas for the three files.
- Derived structures with tests:
  - Item graph: buildsFrom/buildsInto, total & recipe gold, purchasable flags, SR-only filter.
  - Gold efficiency helper: stat value table (per AD/AP/armor/MR/HP/AS point) → item efficiency %.
  - Champion base stats + growth (stat at level N).
- Damage-type classification table `src/main/staticdata/champion-damage-profile.json` (hand-curated: physical/magic/mixed per champion — small, static, fine to curate).

## Acceptance criteria
- [ ] Cold start downloads + caches; second start serves from cache with no network (test with fetch mocked).
- [ ] Item graph tests: e.g. Infinity Edge components & totals correct for current patch; boots upgrade chain resolves.
- [ ] Stat-at-level test matches known values for 2 champions.

## Out of scope
CommunityDragon (only if a needed field is missing — note in worklog). Asset/images download beyond item+champ icons.

## Review checklist
Patch pinning correct; no re-download per launch; derived math unit-tested, not eyeballed.

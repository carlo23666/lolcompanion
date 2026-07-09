# WP-019 — Meta-seed refreshed every release

## Why (owner request, 2026-07-09)
Owner wants each release to ship a **fresh aggregated Master+ base** so new users start strong from minute one and their local crawler pulls new games on top. The pipeline already exists — [`export-meta-seed.mjs`](../scripts/export-meta-seed.mjs) → GitHub release asset → first-run download-if-empty ([`meta-seed.ts`](../src/main/meta-seed.ts)) → local crawl on top — but the seed is only refreshed **manually**: [`release.yml`](../.github/workflows/release.yml) carries the *previous* release's `meta-seed.json.gz` over unless the owner remembers to run `npm run meta:export` and re-upload it. Make refreshing a one-command, hard-to-forget step, and surface how fresh the base is.

**Scope reality:** CI cannot crawl (no Riot key in CI, the key is secret, a large crawl takes weeks). The fresh seed must come from the owner's locally-crawled DB. This WP automates **export + upload from the owner's machine**, not crawling (that's WP-020).

## Scope
- **`npm run meta:publish <tag>`** (new script): runs the existing export, then `gh release upload <tag> dist/meta-seed.json.gz --clobber` to attach the fresh seed to the draft release `release.yml` created. One command, run post-tag / pre-publish.
- **Release flow doc**: update `release.yml`'s header + the release doc so the sequence is explicit: tag → CI draft → `npm run meta:publish <tag>` → smoke test → publish. Keep the "carry over previous seed" fallback for releases where the local aggregates aren't worth refreshing.
- **Freshness surfaced**: the seed already carries `patch` + `exportedAt`. Show the active base's patch + age in Ajustes → meta section ("Base Master+: parche X · actualizada hace N días", or "sin base" when empty). Import already logs it; persist patch/exportedAt so the UI can read it.
- **Staleness guard**: `meta:export` warns (or refuses with `--force`) when the newest local patch ≠ the current Data Dragon patch, so an old-patch seed isn't shipped silently. Release log warns if the carried-over seed is ≥1 patch behind live.

## Acceptance
- [ ] `npm run meta:publish <tag>` exports current local aggregates and uploads `meta-seed.json.gz` to the given draft release (idempotent via `--clobber`).
- [ ] `release.yml` + release doc describe tag → draft → `meta:publish` → smoke → publish; the carry-over fallback still works when `meta:publish` is skipped.
- [ ] Ajustes shows the active base patch + export date (or "sin base").
- [ ] `meta:export` warns when the newest local patch isn't the current patch.
- [ ] `npm run check` green; worklog entry. (No Riot policy change — aggregates + public match ids only, as today.)

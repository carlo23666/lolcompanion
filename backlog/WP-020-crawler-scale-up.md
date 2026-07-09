# WP-020 — Meta crawler scale-up (more current-patch volume per cycle)

## Why (owner request, 2026-07-09)
Owner wants a much bigger Master+ base — asked for ~1,000,000 games. Two hard realities reshape the target:
1. **Rate limits.** A personal key does ~2,000 games/h → 1M ≈ **500 h ≈ 3 weeks nonstop**. Not a one-shot job.
2. **Patch rotation.** Builds/win-rates shift every ~2 weeks and the engine anchors to the *current* patch, so a giant historical pile is mostly dead weight.

**Reframe the goal:** crawl the **current patch as hard as feasible each cycle** (tens-to-hundreds of thousands of games over the ~2-week window — far more than enough for stable per-champion/role signal) and make the crawler robust enough to run unattended for days. This feeds WP-019 (ship the freshest seed each release).

## Scope
- **Resumable / checkpointed crawl.** Persist the crawl frontier (seed players, seen match ids, per-region cursors) so a restart resumes instead of re-fetching; dedup against `meta_matches` (match ids already stored).
- **Breadth beyond the owner's games.** Seed from the full apex ladders (league-v4 Challenger/GM/Master queues) on the owner's platform (optionally 1–2 more regions), so volume isn't capped by the owner's own match count. Aggregates stay region-agnostic (or tag region) — build/win-rate meta is largely cross-region.
- **Throughput within limits.** Keep the existing token-bucket limiter (20/1s, 100/120s, honor `Retry-After`); parallelize match + timeline fetches within budget. Measure and expose games/hour + current-patch total (extend the Ajustes meta section, which already shows a count, with rate + optional ETA-to-target).
- **Patch-scoping.** On a new patch the crawler targets it; old-patch aggregates are retained but the seed export always ships the newest patch (already true). Optional: prune very old patches to cap DB size.
- **Guardrails (Riot policy).** Aggregates only — no player identities, no raw game storage beyond match ids + aggregates; no key logging; stay within the limiter. No change to what leaves the machine.

## Acceptance
- [ ] Crawler resumes after a restart without re-fetching already-aggregated matches (checkpoint + dedup verified in a test).
- [ ] Seeds from apex ladders, not only the owner's matches; demonstrably accumulates current-patch games well beyond the owner's own game count.
- [ ] Ajustes meta section shows current-patch total + games/hour (+ optional ETA to a target).
- [ ] Stays within rate limits (limiter unchanged; honors `Retry-After`); no key/identity leakage (reviewed).
- [ ] `npm run check` green; fixtures for resume/dedup + apex-ladder seed parsing; worklog entry.

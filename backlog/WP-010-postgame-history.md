# WP-010 — Post-game auto-ingestion + history view

## Objective
Close the loop: every finished game lands in the DB automatically and is browsable.

## Scope
- On `postGame` phase: schedule fetch of the just-finished match (match-v5 + timeline) with retry (Riot needs ~1-3 min to publish); link to the live_session row.
- Historial view: match list (champ, KDA, CS/min, result, duration, patch), filterable by champion; detail drawer with final build + per-minute gold curve (simple sparkline) from timeline.
- Personal aggregates header: winrate + CS/min by champion (last 20).

## Acceptance criteria
- [ ] Finish a real game → appears in Historial without manual action within 5 min.
- [ ] Aggregates verified against a hand-computed fixture set.
- [ ] Works offline for already-stored matches.

## Out of scope
Deep analytics, benchmarks vs elo (phase 3 backlog).

## Review checklist
Retry/backoff on unpublished match; session↔match linking correct; queries via repos.

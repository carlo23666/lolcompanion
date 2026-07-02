# WP-009 — Recommendation panel + curated baselines

BLOCKED BY ADR-006 (owner champion pool) — request the list before starting.

## Objective
Ship the core feature: next-purchase recommendation with explanation, live.

## Scope
- `baselines/pool.json`: per owner champion+role → ordered core build, situational slots, rune page(s). Curated by owner+reviewer, schema-validated.
- Engine integration: baseline sequence + WP-007 rule adjustments → concrete "next buy" (component-level, gold-aware) + situational swaps.
- Live view: recommendation card — item icon, name, cost vs current gold, top-3 reasons in Spanish; history of past recommendations this game (so owner can audit afterwards).
- Persist emitted recommendations into live_sessions for later backtesting (WP-011).

## Acceptance criteria
- [ ] For every pool champion, a full mock game (fixtures) produces a coherent purchase sequence — snapshot tests.
- [ ] Owner plays ≥3 real games: recommendations judged useful/plausible, feedback captured in worklog for threshold tuning.
- [ ] Recommendation latency from snapshot < 50ms (engine is sync; measure).

## Out of scope
Champ select recommendations, rune import (phase 2).

## Review checklist
Baselines schema-validated; recommendations always explained; stored for audit; no hardcoded patch assumptions (item IDs resolved via static data).

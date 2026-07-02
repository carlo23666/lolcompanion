# WP-011 — Backtesting harness

## Objective
Validate and tune the engine against reality: replay own timelines through the engine.

## Scope
- `src/main/backtest/`: reconstruct approximate GameState at each timeline frame (minute granularity; items from purchase events, levels from XP, real gold from frames) → run engine → compare recommendation vs actual next purchase.
- Metrics: top-1/top-3 agreement rate overall, by champion, by game phase; list of biggest disagreements with context.
- CLI: `npm run backtest -- --champion X --last 50` printing a report; also dump JSON to `reports/`.
- Document known reconstruction gaps (e.g., enemy items only known via purchase events — acceptable).

## Acceptance criteria
- [ ] Runs over ≥100 stored matches without errors; report generated.
- [ ] Reviewer receives the first report; thresholds in WP-007 get one tuning pass driven by findings (documented).
- [ ] Reconstruction sanity test: gold at frame N matches timeline exactly (it's the source), items match final build for 5 spot-checked matches.

## Out of scope
ML training. Automated threshold optimization.

## Review checklist
Agreement metric definition sensible (component vs completed item handling); disagreement samples inspectable; no engine changes smuggled in beyond tuning constants.

# INBOX — discovered work
Builder sessions append here instead of expanding scope. Reviewer triages into WPs.

- (WP-002) Per-champion Data Dragon detail files (`champion/<Name>.json`, spell data) not needed yet; add fetch-on-demand when a rule needs spell info.
- (WP-002) Verify damage profiles for post-2025 champions: Locke, Yunara, Zaahen (guessed physical/physical/mixed).
- (WP-002) Gold-per-stat table is static constants; consider deriving from basic items of the cached patch at load time.
- (WP-004) Replace synthetic match/timeline fixtures with real recorded (anonymized) responses after the first owner sync.
- (WP-004) Parse `X-Method-Rate-Limit` headers to size per-method buckets dynamically instead of conservative constants.
- (WP-009) **ADR-006 pending**: replace the placeholder `src/main/engine/baselines/pool.json` with the owner's real champion pool (10-15 champs+roles). Schema tests will validate it.
- (WP-010) Post-game session linking could cross-check `live_sessions.championName` against the match's owner champion before linking (guards against linking a remake/aborted session).
- (WP-007) Owner idea from first real game (2026-07-02): a team-damage-diversification rule — when the OWN team is heavily one damage type (e.g. 2+ AP allies), suggest the owner covers the other type where his champion allows it. Doesn't exist in v1 (rules only react to the ENEMY comp); needs a spec + thresholds.
- (WP-009) Owner feedback from first real game: with the champion not in `pool.json` the card shows nothing early-game. Consider a neutral fallback (e.g. component/spike suggestions only) or an explicit "champion sin baseline" hint so it doesn't read as broken. Real fix is ADR-006 (owner pool).

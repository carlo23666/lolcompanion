# INBOX — discovered work
Builder sessions append here instead of expanding scope. Reviewer triages into WPs.

- (WP-002) Per-champion Data Dragon detail files (`champion/<Name>.json`, spell data) not needed yet; add fetch-on-demand when a rule needs spell info.
- (WP-002) Verify damage profiles for post-2025 champions: Locke, Yunara, Zaahen (guessed physical/physical/mixed).
- (WP-002) Gold-per-stat table is static constants; consider deriving from basic items of the cached patch at load time.
- (WP-004) Replace synthetic match/timeline fixtures with real recorded (anonymized) responses after the first owner sync.
- (WP-004) Parse `X-Method-Rate-Limit` headers to size per-method buckets dynamically instead of conservative constants.
- (WP-009) **ADR-006 pending**: replace the placeholder `src/main/engine/baselines/pool.json` with the owner's real champion pool (10-15 champs+roles). Schema tests will validate it.

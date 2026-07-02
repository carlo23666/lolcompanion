# INBOX — discovered work
Builder sessions append here instead of expanding scope. Reviewer triages into WPs.

- (WP-002) Per-champion Data Dragon detail files (`champion/<Name>.json`, spell data) not needed yet; add fetch-on-demand when a rule needs spell info.
- ~~(WP-002) Verify damage profiles for post-2025 champions: Locke, Yunara, Zaahen (guessed physical/physical/mixed).~~ RESOLVED 2026-07-02: verified against 28 stored real builds — Locke=magic, Zaahen=physical, Yunara=physical. Locke's wrong guess showed up as 0% backtest agreement (engine pushed AD anti-tank items at an AP champion).
- (WP-002) Gold-per-stat table is static constants; consider deriving from basic items of the cached patch at load time.
- (WP-004) Replace synthetic match/timeline fixtures with real recorded (anonymized) responses after the first owner sync.
- (WP-004) Parse `X-Method-Rate-Limit` headers to size per-method buckets dynamically instead of conservative constants.
- (WP-009) **ADR-006 pending**: replace the placeholder `src/main/engine/baselines/pool.json` with the owner's real champion pool (10-15 champs+roles). Schema tests will validate it.
- (WP-010) Post-game session linking could cross-check `live_sessions.championName` against the match's owner champion before linking (guards against linking a remake/aborted session).
- (WP-007) Owner idea from first real game (2026-07-02): a team-damage-diversification rule — when the OWN team is heavily one damage type (e.g. 2+ AP allies), suggest the owner covers the other type where his champion allows it. Doesn't exist in v1 (rules only react to the ENEMY comp); needs a spec + thresholds.
- (WP-009) Owner feedback from first real game: with the champion not in `pool.json` the card shows nothing early-game. Consider a neutral fallback (e.g. component/spike suggestions only) or an explicit "champion sin baseline" hint so it doesn't read as broken. Real fix is ADR-006 (owner pool).
- (owner request 2026-07-02) Feature ideas for reviewer triage, all derivable from own data / screen-visible info (Riot-compliant):
  - Live "curva personal": compare live CS/gold/KDA at minute X vs the owner's own average on that champion (history is already stored).
  - Enemy power-spike alerts from VISIBLE info only: completed 2nd/3rd item, levels 6/11/16.
  - Data-driven baselines: derive per-champion core order + situationals from the owner's own stored matches (feeds ADR-006 curation).
  - Post-game report: engine recommendations vs actual buys for the finished game (WP-011 harness reused live).
  - Death/tilt analytics in Historial: deaths by phase, winrate by session length / consecutive games.
  - Champ select (phase 2): enemy comp damage-profile preview + ban suggestions from own loss history.
- (owner request 2026-07-02) Visual identity WP: current UI is generic Tailwind dark. Owner wants a distinctive look + animations. Direction to spec: hextech-inspired palette (deep navy + gold), champion-splash banner in Live, animated recommendation card (enter animation + glow pulse on top-pick change), animated counters and sparklines. Prefer CSS/Tailwind animations (zero-dep); framer-motion only with an ADR note.

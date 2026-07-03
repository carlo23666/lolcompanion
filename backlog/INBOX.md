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
- (WP-010, real-usage gap 2026-07-02) Owner closed the League client right after the game ended → LCU dropped, session machine went inGame→idle without ever reporting `postGame` → PostGameIngestor never armed and the match only arrives via manual sync. Add a catch-up: on app start (or on regaining API context), fetch the latest few matchIds and ingest any missing ones newer than the newest stored match.
- (owner request 2026-07-02) Feature ideas for reviewer triage, all derivable from own data / screen-visible info (Riot-compliant):
  - Live "curva personal": compare live CS/gold/KDA at minute X vs the owner's own average on that champion (history is already stored).
  - Enemy power-spike alerts from VISIBLE info only: completed 2nd/3rd item, levels 6/11/16.
  - Data-driven baselines: derive per-champion core order + situationals from the owner's own stored matches (feeds ADR-006 curation).
  - Post-game report: engine recommendations vs actual buys for the finished game (WP-011 harness reused live).
  - Death/tilt analytics in Historial: deaths by phase, winrate by session length / consecutive games.
  - Champ select (phase 2): enemy comp damage-profile preview + ban suggestions from own loss history.
- (owner request 2026-07-02) Visual identity WP: current UI is generic Tailwind dark. Owner wants a distinctive look + animations. Direction to spec: hextech-inspired palette (deep navy + gold), champion-splash banner in Live, animated recommendation card (enter animation + glow pulse on top-pick change), animated counters and sparklines. Prefer CSS/Tailwind animations (zero-dep); framer-motion only with an ADR note.

## Owner playtest feedback 2026-07-03 (real game + practice tool)

Bugs:
- (WP-009 bug) **Next-buy stalls on boots with Magical Footwear**: owner ran the Magical Footwear rune (boots not purchasable until ~min 12-15); `nextBuyRecommendation` pinned boots as the first unfinished core item and recommended them the whole time, never advancing to later core items or components. Fix direction: read the active player's runes from Live Client (`fullRunes`, screen-visible, own player — compliant) and, when Magical Footwear is equipped and boots aren't granted yet, skip the boots slot and target the next core item instead.
- (WP-009 bug) **Engine goes silent once core is complete**: pool cores are only 3-4 items, so `nextBuyRecommendation` returns null well before a full build. Observed twice: (a) 6 slots full with a Doran's still held → no "sell Doran's + buy X" recommendation; (b) owner sold the Doran's leaving a free slot + gold → still nothing. Needs an endgame layer: after core, recommend situational picks (rules already score them) to fill slots 5-6, and an explicit `sell` action for starter/early items when slots are full. May need a `sell`/`replace` action variant in `Recommendation`.
- (WP-010 bug) **Post-game report shows a stale match after Practice Tool**: Practice Tool/custom games never appear in Riot match history, so the live session never links and `ReportService.lastReport` silently falls back to the most recent *linked* session (an older game). Fix direction: record `gameMode` on the live session; for non-matchmade modes show "sin informe para este tipo de partida" instead of falling back.

Feature requests (all screen-visible/own-data → compliant):
- **Overlay v2 — Hexi in game**: owner wants the mascot rendered in the overlay, delivering messages/recommendations there (speech-bubble style). Also: overlay discoverability is poor — it's off by default behind Ajustes and invisible in exclusive fullscreen; consider a first-run hint and a phase-change toast.
- **Report card v2 — richer metrics**: deaths vs owner's own average for that champ/role, vision score (in match-v5 participant data), build-order score (actual buy order vs engine recommendations over the session), build-vs-enemy-comp score (reuse rules engine on final state), and a short overall-game summary/recommendations. → 2026-07-03: deaths/vision/summary/adherence SHIPPED; still open: build-order score (needs purchase timestamps vs recommendation timestamps) and build-vs-enemy-comp score.
- **Objective-window notifications**: on visible enemy deaths (Live Client event feed) while a major objective is up/spawning soon (timers already tracked), notify e.g. "el jungla enemigo ha muerto y el dragón está libre". Ally/team position is NOT available from the API, so scope to death + objective timers only.
- **UI restyle round 2**: owner finds the hextech pass barely visible and the sidebar layout "not pro". Wants selectable color schemes (theme setting) and a rethought navigation layout; animations need to be more noticeable.

Declined (Riot policy — hard rule 1, do NOT promote to a WP):
- Enemy flash/summoner-cooldown timers (manual, ally-ping-derived, or otherwise) were requested and declined: enemy cooldown tracking of any kind is banned by Riot (March 2025), regardless of data source.

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
- ~~(WP-010, real-usage gap 2026-07-02) Owner closed the client right after the game → match only arrived via manual sync.~~ RESOLVED 2026-07-06: `catchUpMissedMatches` on app start (10s delay) ingests the newest 5 missing matches.
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

- (owner question 2026-07-04) **Meta-stats crawler (the op.gg approach)**: no free meta API exists — aggregate ourselves via the Riot API like every stats site did originally. Background crawler within app rate limits (~2k matches/h, seeded from players in the owner's own matches → same region/elo), SQLite aggregates: champion+role+patch winrate/pickrate, and matchup tables scoped to the owner's pool champions only (keeps required volume small). Blend into pick suggestions as a third signal tier: personal record → own-elo aggregate → class heuristics, each labeled in reasons. Prereq: register a personal (non-expiring) API key. Needs: crawl scheduler with resume/dedup, respect for the existing limiter, patch-scoped invalidation.

- ~~(real-usage observation 2026-07-04) **Loading-screen payloads spam the log**~~ RESOLVED 2026-07-06: distinct `loading` state ("Cargando partida…" in Live), validation errors report once per streak.

## 2026-07-06 (release 1.0 session)

- **Overlay expand-on-Tab**: requested; not implementable cleanly — Electron `globalShortcut` would STEAL the Tab key from the game, and polling global key state needs a native input-hook dependency (e.g. uiohook-napi, would need an Electron-ABI build + policy review for input monitoring). Shipped hover-to-expand + 📌 pin instead. Revisit only with an explicit ADR.
- **Coach extension ideas**: the Ollama coach only narrates post-game reports; candidates: champ-select draft commentary (facts already in ChampSelectInsights), a weekly "estado de tu clima competitivo" from StatsService, streaming responses for faster perceived latency (`stream: true`).
- **Meta-baseline order**: the meta fallback build uses final-item frequency as build ORDER — real order needs purchase-timestamp aggregation in the crawler (meta_champion_items has no order data). Worth a migration when the crawler next evolves.
- **Sound settings don't reach the overlay window** (it never plays sounds today anyway); if overlay sounds ever land, configureSounds must run there too.

Declined (Riot policy — hard rule 1, do NOT promote to a WP):
- Enemy flash/summoner-cooldown timers (manual, ally-ping-derived, or otherwise) were requested and declined: enemy cooldown tracking of any kind is banned by Riot (March 2025), regardless of data source.

- (2026-07-07) In-game splash backdrop uses sanitized display name; add a championName->ddragon-id map (Wukong->MonkeyKing etc.) so it never 404s.
- (2026-07-07) Anime/Estrella is the first LIGHT theme; hardcoded emerald/rose/sky utilities look fine but deserve a dedicated light-surface contrast pass.
- (2026-07-07) Per-mascot coach voice flavor (Sombra dry/edgy, Yuki genki) on top of buildPersona(name).

- (2026-07-07) Champ select pick suggestions still rank by OWN winrate first with Master+ as a +/-0.15 blend; the in-game engine is now Master+-first — consider the same inversion in champselect if the owner confirms.

- (2026-07-07) Owner proposed password-encrypted bundled API key as a "license" for friends. Declined (shared personal-key use violates Riot ToS + per-key rate limit collapses with N users; cipher only protects the repo copy, not post-install use). The RIGHT version of his idea for phase 2 / monetization: small proxy backend holding a Riot PRODUCTION key, friends authenticate with owner-issued revocable tokens (the "license"), server enforces per-user quotas. Needs ADR revisiting ADR-002 (zero-cost/no-backend) + Riot production key application (ADR-007).

## 2026-07-08 (owner planning session: exclusivity + go-public track)

- (WP candidate, engine bug-class) **Item mutual exclusivity in recommendations**: engine can recommend two items that can't be owned together (e.g. two Lifeline items like Maw + Shieldbow) or an item conflicting with one already owned. Data Dragon has NO structured "Limited to 1 X" field (only prose in `description` HTML). Design agreed: curated `item-exclusivity.json` in `src/main/staticdata/` (precedent: champion-damage-profile.json) with groups + maxOwnable, validated against the cached patch at load (warn on unknown ids); optional description-text "Limited" scan as a patch-drift canary; pure filter pass in the engine dropping candidates that conflict with owned items or with a higher-scored candidate in the same group; fixture tests (Maw+Shieldbow both triggered → one survives).
- (owner request 2026-07-08) **Landing website**: static page on GitHub Pages/Cloudflare Pages (free). Content: pitch, screenshots/GIF, download buttons → GitHub Releases, FAQ, Riot compliance boilerplate + "ban-safe / official APIs only" section (trust is the main conversion lever). Suggested: `site/` folder in-repo, deployed via GitHub Action. Custom domain later (~10€/yr, only cost).
- (owner question 2026-07-08) **Payments ladder** (must re-check Riot monetization policy at product registration): (1) donations now (Ko-fi/GitHub Sponsors), (2) freemium subscription later via a merchant-of-record (Paddle / Lemon Squeezy — they handle EU VAT, critical for a solo dev in Spain) gating premium features (meta-crawler insights, advanced reports); license validation can live in the same proxy backend as the production key (see 2026-07-07 entry). Avoid ads.
- (2026-07-08) **Go-public gaps** (each likely its own WP): code signing (Windows OV cert or Azure Trusted Signing ~$10/mo, macOS notarization 99€/yr — breaks zero-cost, needs ADR; unsigned = SmartScreen kills installs); first-run onboarding wizard (region, account, pool picker UI — supersedes hand-edited pool.json, ties into ADR-006); i18n decision (ES-only launch vs wrapping strings for EN now); opt-in crash reporting (Sentry free tier + privacy note — the 1.4.x crash was only visible via updater.log); CI release pipeline (check + build + sign + publish, so a bad manual release can't ship to auto-updating users); consider public repo or public compliance doc for trust.

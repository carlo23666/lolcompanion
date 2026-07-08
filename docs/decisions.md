# Architecture Decision Records

## ADR-001 — Stack: Electron + TypeScript (ACCEPTED, 2026-07-02)
Chosen over Tauri/Rust for ecosystem maturity around the LCU (`league-connect`, `lcu-events`), more reference code to compare against, and owner productivity. Cost accepted: higher RAM footprint (~300MB). Mitigation: keep renderer lean, no heavy frameworks beyond React.

## ADR-002 — Local-first, no backend in phase 1 (ACCEPTED)
All data sources are local (LCU, :2999) or free (Riot personal key, Data Dragon). SQLite for persistence. A backend (Cloudflare Workers + D1) only enters if the app is ever distributed. Zero-cost constraint.

## ADR-003 — Live game data via Live Client Data API only (ACCEPTED)
Spectator-V5 was deactivated for LoL (Oct 2025). Port 2999 is the only compliant real-time source and covers the use case (own game). No fallback needed.

## ADR-004 — Rules engine before ML (ACCEPTED)
Phase 1 recommendations are deterministic rules over GameState + item math from Data Dragon, each with mandatory human-readable reasons. ML/win-probability models deferred to phase 3, gated on having a validated backtesting harness (WP-011).

## ADR-005 — Panel first, overlay later (REVISED 2026-07-02)
Phase 1 renders recommendations in the app window (second monitor / alt-tab). REVISED at owner request: an EXPERIMENTAL overlay shipped early — small transparent always-on-top frameless window (`src/main/overlay.ts` + `?overlay=1` renderer entry) showing the compact top recommendation + latest spike alert, toggled in Ajustes, shown only during `inGame`. Known limitation (accepted): invisible over exclusive-fullscreen League; owner must play windowed/borderless. The full overlay WP (game-anchored positioning, click-through modes) remains phase 2.

## ADR-006 — Owner champion pool (ACCEPTED v1, 2026-07-02 — data-derived)
The curated baseline builds (WP-009) need the owner's champion pool. Resolved by DERIVING it from the owner's own 200 ingested matches instead of hand-curation: per champion, the most frequent completed-item purchase order becomes `core`, high-frequency off-core completions become `situational`. v1 pool: Kai'Sa, Samira, Twitch, Jinx, Ezreal (BOTTOM) + Graves (JUNGLE). Effect measured by backtest over the same 100 matches: top-1 15.0%→39.5%, top-3 19.9%→49.8% (early phase 60/67%). Owner refines entries by hand as his builds evolve; behavioral tests use an injected fixed pool so editing pool.json never breaks the suite. Ezreal is thin (4 games) — treat as provisional.

## ADR-007 — Distribution ambition: public track (REVISED 2026-07-08, was OPEN)
Original assumption (personal use only) is superseded: friends already install via GitHub Releases + auto-update, and the owner wants public discovery. Accepted now, all zero-cost: landing site on GitHub Pages (`site/`, WP-013), CI draft-release pipeline gated by `npm run check` and the manual packaged smoke test (WP-014), BYO personal API key remains the onboarding path. Explicitly deferred (each breaks zero-cost or needs owner accounts): code signing (Windows OV cert or Azure Trusted Signing ~10 USD/month; unsigned + SmartScreen warning accepted meanwhile), crash reporting (Sentry free tier, needs DSN + opt-in), first-run onboarding wizard, EN localization (site and app stay Spanish-only for launch).

## ADR-008 — OPEN: managed API key via proxy backend + monetization
Direction agreed 2026-07-08 (supersedes ADR-002's "no backend" WHEN accepted): a minimal proxy (Cloudflare Workers free tier) holding a Riot PRODUCTION key serves only the Riot Web API surface (match-v5/account-v1 — Live Client and LCU stay local), caches immutable match data forever, and authenticates installs with owner-issued revocable tokens; personal-key mode remains as fallback. Monetization ladder rides the same infra: donations first (Ko-fi/GitHub Sponsors), later an optional premium tier via a merchant of record (Paddle/Lemon Squeezy — handles EU VAT) validated by the proxy. Blocked on owner actions, in order: (1) register the product + apply for the production key at the Riot Developer Portal (re-read monetization policy there), (2) Cloudflare account, (3) payment accounts. No code until (1) is granted.

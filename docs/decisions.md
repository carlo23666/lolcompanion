# Architecture Decision Records

## ADR-001 — Stack: Electron + TypeScript (ACCEPTED, 2026-07-02)
Chosen over Tauri/Rust for ecosystem maturity around the LCU (`league-connect`, `lcu-events`), more reference code to compare against, and owner productivity. Cost accepted: higher RAM footprint (~300MB). Mitigation: keep renderer lean, no heavy frameworks beyond React.

## ADR-002 — Local-first, no backend in phase 1 (ACCEPTED)
All phase-1 processing is local (LCU, :2999, Data Dragon and direct Riot Web API access in private development installs). SQLite owns persistence. A backend only enters if public distribution needs a managed production API key. Zero-cost remains a hard constraint; see ADR-010 for credential and marketing boundaries.

## ADR-003 — Live game data via Live Client Data API only (ACCEPTED)
Spectator-V5 was deactivated for LoL (Oct 2025). Port 2999 is the documented local real-time source used for the player's own game and covers the use case. No fallback needed.

## ADR-004 — Rules engine before ML (ACCEPTED)
Phase 1 recommendations are deterministic rules over GameState + item math from Data Dragon, each with mandatory human-readable reasons. ML/win-probability models deferred to phase 3, gated on having a validated backtesting harness (WP-011).

## ADR-005 — Panel first, overlay later (REVISED 2026-07-02)
Phase 1 renders recommendations in the app window (second monitor / alt-tab). REVISED at owner request: an EXPERIMENTAL overlay shipped early — small transparent always-on-top frameless window (`src/main/overlay.ts` + `?overlay=1` renderer entry) showing the compact top recommendation + latest spike alert, toggled in Ajustes, shown only during `inGame`. Known limitation (accepted): invisible over exclusive-fullscreen League; owner must play windowed/borderless. The full overlay WP (game-anchored positioning, click-through modes) remains phase 2.

## ADR-006 — Owner champion pool (ACCEPTED v1, 2026-07-02 — data-derived)
The curated baseline builds (WP-009) need the owner's champion pool. Resolved by DERIVING it from the owner's own 200 ingested matches instead of hand-curation: per champion, the most frequent completed-item purchase order becomes `core`, high-frequency off-core completions become `situational`. v1 pool: Kai'Sa, Samira, Twitch, Jinx, Ezreal (BOTTOM) + Graves (JUNGLE). Effect measured by backtest over the same 100 matches: top-1 15.0%→39.5%, top-3 19.9%→49.8% (early phase 60/67%). Owner refines entries by hand as his builds evolve; behavioral tests use an injected fixed pool so editing pool.json never breaks the suite. Ezreal is thin (4 games) — treat as provisional.

## ADR-007 — Distribution ambition: public track (REVISED 2026-07-08, was OPEN)
Original assumption (personal use only) is superseded: friends already install via GitHub Releases + auto-update, and the owner wants public discovery. Accepted now, all zero-cost: landing site on GitHub Pages (`site/`, WP-013), CI draft-release pipeline gated by `npm run check` and the manual packaged smoke test (WP-014). The former BYO-personal-key public onboarding assumption is superseded by ADR-010. Explicitly deferred (each breaks zero-cost or needs owner accounts): code signing, crash reporting, and first-run onboarding.

## ADR-008 — OPEN: managed API key via proxy backend + monetization
Direction agreed 2026-07-08 (supersedes ADR-002's "no backend" WHEN accepted): a minimal proxy (Cloudflare Workers free tier) holding a Riot PRODUCTION key serves only the Riot Web API surface (match-v5/account-v1 — Live Client and LCU stay local), caches immutable match data forever, and authenticates installs with owner-issued revocable tokens; personal-key mode remains as fallback. Monetization ladder rides the same infra: donations first (Ko-fi/GitHub Sponsors), later an optional premium tier via a merchant of record (Paddle/Lemon Squeezy — handles EU VAT) validated by the proxy. Blocked on owner actions, in order: (1) register the product + apply for the production key at the Riot Developer Portal (re-read monetization policy there), (2) Cloudflare account, (3) payment accounts. No code until (1) is granted.

## ADR-009 — App localization: English default, Spanish second (ACCEPTED 2026-07-08, supersedes the ES-only convention)
Owner wants public reach (ADR-007), so the ES-only rule in CLAUDE.md ("All user-facing strings in Spanish") is retired. Every user-facing string now flows through a zero-dep message catalog in `src/shared/i18n/` (`en.ts` is the source-of-truth key set; `es.ts` must satisfy the same keys — TypeScript enforces completeness). A locale-bound `Translator` (`t(key, params)`) is:
- **threaded as an explicit parameter into the pure engine** (rules, nextbuy, meta-items, exclusivity, champselect, weaknesses) — NOT a module global, so the "pure and synchronous" invariant holds and tests stay isolated. The engine entry points default `t` to the Spanish translator for back-compat, but the live/main path passes the translator resolved from the `locale` setting;
- **provided to the renderer via a React context** (`LocaleProvider` / `useT`), loaded from settings like the theme is.

Default locale is **en**; existing installs are migrated to **es** on first run after upgrade (a settings-row default keyed on "has this install run before") so current users see no change. Locale is a normal setting in Ajustes/Settings. Rationale for threading over structured-reason-data: emitting `{key, params}` from the engine instead of `reasons: string[]` would change the `Recommendation` contract stored in `live_recommendations`, crossing IPC, reports and every test — far larger blast radius for no user benefit, since the render happens in-process anyway. WP-017 tracks the rollout; CLAUDE.md updated in lockstep.

## ADR-010 — Riot integration and public-distribution boundaries (ACCEPTED 2026-07-13)

- The documented Live Client Data API is the only live-game payload source. Riot Web API and Data Dragon are used directly. LCU is an **unsupported** local client interface; it stays isolated behind `src/main/lcu/`, must degrade gracefully, and is never described as an official or approved API.
- Live outputs are decision support: a primary option, contextual alternatives, evidence and confidence. The product must not market itself as dictating a mandatory action. No cooldown tracking, de-anonymization, memory access, packet inspection or replay reverse engineering.
- Personal/development Riot API keys are for the owner's private testing only. They are not the onboarding credential for a publicly distributed consumer product. Public match-history sync is blocked on product registration plus a production key (or an approved zero-cost proxy design); local Live Client features remain usable without a key.
- Marketing must not promise that an account cannot be sanctioned or use blanket “Riot-compliant/approved sources” claims. It states the exact data boundaries, the unsupported LCU status and the normal third-party-app disclaimer instead.

References: [Riot general policies](https://developer.riotgames.com/policies/general), [League client/API documentation](https://developer.riotgames.com/docs/lol), [Developer Portal keys and products](https://developer.riotgames.com/docs/portal).

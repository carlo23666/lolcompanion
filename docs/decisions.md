# Architecture Decision Records

## ADR-001 — Stack: Electron + TypeScript (ACCEPTED, 2026-07-02)
Chosen over Tauri/Rust for ecosystem maturity around the LCU (`league-connect`, `lcu-events`), more reference code to compare against, and owner productivity. Cost accepted: higher RAM footprint (~300MB). Mitigation: keep renderer lean, no heavy frameworks beyond React.

## ADR-002 — Local-first, no backend in phase 1 (ACCEPTED)
All data sources are local (LCU, :2999) or free (Riot personal key, Data Dragon). SQLite for persistence. A backend (Cloudflare Workers + D1) only enters if the app is ever distributed. Zero-cost constraint.

## ADR-003 — Live game data via Live Client Data API only (ACCEPTED)
Spectator-V5 was deactivated for LoL (Oct 2025). Port 2999 is the only compliant real-time source and covers the use case (own game). No fallback needed.

## ADR-004 — Rules engine before ML (ACCEPTED)
Phase 1 recommendations are deterministic rules over GameState + item math from Data Dragon, each with mandatory human-readable reasons. ML/win-probability models deferred to phase 3, gated on having a validated backtesting harness (WP-011).

## ADR-005 — Panel first, overlay later (ACCEPTED, provisional)
Phase 1 renders recommendations in the app window (second monitor / alt-tab). Transparent always-on-top overlay is phase 2 (WP-012+). Rationale: overlay adds windowing complexity and fullscreen-exclusive limitations without changing the engine. REVISIT if owner plays single-monitor fullscreen — say so and we reprioritize.

## ADR-006 — Owner champion pool (ACCEPTED v1, 2026-07-02 — data-derived)
The curated baseline builds (WP-009) need the owner's champion pool. Resolved by DERIVING it from the owner's own 200 ingested matches instead of hand-curation: per champion, the most frequent completed-item purchase order becomes `core`, high-frequency off-core completions become `situational`. v1 pool: Kai'Sa, Samira, Twitch, Jinx, Ezreal (BOTTOM) + Graves (JUNGLE). Effect measured by backtest over the same 100 matches: top-1 15.0%→39.5%, top-3 19.9%→49.8% (early phase 60/67%). Owner refines entries by hand as his builds evolve; behavioral tests use an injected fixed pool so editing pool.json never breaks the suite. Ezreal is thin (4 games) — treat as provisional.

## ADR-007 — OPEN: distribution ambition
Assumed personal use only (personal API key, no code signing, no auto-update). If this changes: production key application, signing certs (NOT zero-cost), backend. Decision can be deferred until after phase 2.

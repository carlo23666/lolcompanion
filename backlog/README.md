# Backlog — execution order

One WP per Claude Code session. Do them in order; dependencies noted.

| WP | Title | Depends on | Status |
|----|-------|-----------|--------|
| 000 | Repo bootstrap (electron-vite, TS strict, tooling) | — | TODO |
| 001 | Live Client connector + payload recorder | 000 | TODO |
| 002 | Static data manager (Data Dragon) | 000 | TODO |
| 003 | SQLite store + migrations | 000 | TODO |
| 004 | Riot API client + rate limiter + history ingestion | 002, 003 | TODO |
| 005 | LCU connector + session phase state machine | 000 | TODO |
| 006 | GameState normalizer + diff engine | 001, 002 | TODO |
| 007 | Rules engine v1 (damage split, antiheal, defensive triggers) | 006 | TODO |
| 008 | UI shell + live panel | 006 | TODO |
| 009 | Recommendation panel + curated baselines (needs ADR-006: champ pool) | 007, 008 | TODO |
| 010 | Post-game auto-ingestion + history view | 004 | TODO |
| 011 | Backtesting harness (engine vs own timelines) | 007, 010 | TODO |

Phase 2 (draft, to be spec'd after WP-011 review): overlay window, LCU champ select recommendations, rune auto-import.

Discovered work → `INBOX.md`. The reviewer triages it into WPs.

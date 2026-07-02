# WP-005 — LCU connector + session phase state machine

## Objective
Know at all times which phase the player is in and expose champ select data.

## Scope
- `src/main/lcu/` wrapping league-connect: credential discovery, WebSocket connect, auto-reconnect on client restart. Nothing outside this dir imports league-connect.
- Subscribe to gameflow phase + champ select session events; map to internal phases: `idle | clientOpen | champSelect | inGame | postGame`.
- `src/main/session/`: state machine combining LCU phase + WP-001 port-2999 availability (source of truth for inGame). Emits `session:phase` over IPC.
- Champ select: expose picked/banned champions + own assigned position via `session:champselect` (champion IDs only — NO player identities, respect anonymity by design: do not read or forward name fields).
- Only approved LCU endpoints; list used endpoints in `docs/lcu-endpoints.md` for the dev-portal app registration.

## Acceptance criteria
- [ ] Full cycle test by owner: launch client → lobby → champ select → game → post-game; phases logged correctly, including client kill mid-cycle (reconnects).
- [ ] Champ select payload validated with zod fixture test (record one real session).
- [ ] App remains fully functional with LoL client never opened.

## Out of scope
Rune import, any recommendation in champ select (phase 2).

## Review checklist
No identity fields forwarded from champ select; league-connect isolated; endpoint list documented; reconnect tested.

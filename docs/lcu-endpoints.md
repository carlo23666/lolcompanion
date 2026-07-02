# LCU endpoints used

For the dev-portal app registration. All read-only; no identity fields are
forwarded beyond the main process (champ select payloads are sanitized by
`src/shared/schemas/lcu.ts`, which strips everything except champion ids,
cell ids, positions, bans and timer phase).

| Endpoint | Access | Purpose |
|----------|--------|---------|
| `/lol-gameflow/v1/gameflow-phase` | GET + WS subscription | Session phase state machine (`idle/clientOpen/champSelect/inGame/postGame`) |
| `/lol-champ-select/v1/session` | WS subscription | Picked/banned champion ids + own assigned position during champ select |

Planned for phase 2 (not yet used): `/lol-perks/v1/pages` (rune import).

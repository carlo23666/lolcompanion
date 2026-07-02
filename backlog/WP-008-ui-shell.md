# WP-008 — UI shell + live panel

## Objective
Real app UI: navigation + live game panel consuming GameState.

## Scope
- Layout: sidebar (Live, Historial, Ajustes), dark theme, Spanish UI.
- Live view: session phase banner; in game → team compositions with items (icons from Data Dragon cache), own gold/stats, enemy damage split + tankiness gauges, objectives taken. Updates on `live:snapshot`.
- Empty/idle states designed (not blank screens): idle, clientOpen, champSelect placeholder.
- Ajustes: riotId + region, sync button (wires WP-004), recording toggle.
- Component tests for the live view with fixture GameStates (vitest + testing-library).

## Acceptance criteria
- [ ] Owner plays one game with the panel on second monitor: no crashes, updates ≤3s behind game, readable at a glance.
- [ ] All phases render a designed state.
- [ ] No renderer imports from main; data flows only via typed IPC.

## Out of scope
Recommendations UI (WP-009), history view (WP-010), overlay.

## Review checklist
IPC typing respected; icons served from local cache not CDN at runtime; renderer stays pure.

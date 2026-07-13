# WP-022 — Adult Spanish voice, clean session resets, bottom overlay, theme concepts

## Why

Owner playtesting found awkward or childish Spanish copy (for example, "¿Qué te pego?",
self-introductions and "ligeramente friki" coach direction), over-explained defensive draft
advice, an alert from a previous debug snapshot, and an intrusive right-edge coach animation
with visible scrollbars. The owner also wants Dark and Sakura personalization back, but asked
to approve visual concepts and mascots before implementation.

## Scope

- Audit and rewrite Spanish draft, mascot, live-alert, home and local-coach language toward a
  concise, current, adult voice: friendly, confident and slightly dry, without role-play,
  childish catchphrases, filler introductions or decorative emoji in generated advice.
- Simplify defensive champ-select advice to identify the relevant defensive need and compatible
  item route. Do not lecture the player about not buying tank items; the live engine decides the
  actual timing and item from visible state.
- Introduce an explicit normalized-game reset signal. Clear renderer alerts, enemy-role caches
  and transient coach bubbles whenever a snapshot source/session resets, independently of game
  clock direction. Make replay and forced-scenario sources mutually exclusive.
- Replace the right-edge walk-in coach with a stable bottom overlay dock designed for the space
  between the ability bar and minimap. Hexi remains present; recommendations stay compact and
  alerts/tips use a temporary upward speech bubble. The overlay must remain click-through except
  for its small draggable control and must never show browser scrollbars.
- Produce high-fidelity Dark and Sakura theme concepts with original mascots for owner approval.
  Do not re-enable either theme in product settings in this WP.

## Acceptance criteria

- [x] No Spanish display or coach-prompt string contains "¿Qué te pego?", "ligeramente friki",
      a Hexi self-introduction, or copy that treats the user like a child.
- [x] Heavy-AD/AP draft advice says what defensive profile is relevant and names compatible
      options/components without the "no compres armadura/RM de tanque" lecture.
- [x] Local-coach prompts explicitly forbid self-introductions, mascot role-play, emoji, filler,
      invented champions/items/events, and imperative certainty from incomplete state.
- [x] `gamestate:reset` clears live alerts, role caches and transient overlay speech even when
      the next snapshot clock is not lower than the previous one.
- [x] Starting a replay stops any active scenario; starting a scenario stops any replay and
      begins from a reset processor.
- [x] Overlay uses a persistent bottom dock, temporary upward speech bubble, hidden overflow and
      no right-edge enter/leave lifecycle.
- [x] Renderer/main regression tests cover reset behaviour, source switching and the revised
      overlay/copy contracts.
- [x] Dark and Sakura concept PNGs exist with distinct adult visual identities and original
      mascots; themes remain unavailable until owner approval.
- [x] `npm run check` passes, visual QA is completed, and `docs/worklog.md` records the result.
- [x] No Riot policy hard rule is violated; no dependency or paid service is added.

## Out of scope

- Shipping Dark/Sakura theme CSS, selectors, production mascot sprites or a theme migration.
- Inferring exact screen geometry from League, reading input state, or changing Riot API inputs.
- Enemy cooldown tracking, hidden-state inference or any non-approved data source.

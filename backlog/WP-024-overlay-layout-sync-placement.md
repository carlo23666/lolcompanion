# WP-024 — Overlay layout, live theme sync and HUD placement

## Why

The speech layer can overlap the persistent purchase dock, the separate overlay window keeps a
stale identity after the main window previews a new theme, and one fixed 420×220 placement cannot
fit every League HUD scale or resolution.

## Scope

- Separate transient speech and the persistent dock in normal layout flow so they never overlap or
  create internal scrollbars.
- Synchronize theme changes from Settings to every open renderer immediately, including before the
  owner presses Save; saved themes must still load correctly on a new overlay window.
- Add a persistent 70–150% overlay scale control, keep the existing drag handle, remember moved
  coordinates, clamp restored windows to the current display and expose a reset-position action.
- Keep click-through behavior outside the dock and preserve the Riot-policy/data boundaries.

## Acceptance criteria

- [x] Speech sits above the dock with a visible gap at every supported scale and long text is
  clamped without scrollbars.
- [x] Rift/Dark/Sakura changes update the live overlay theme and companion immediately.
- [x] Settings expose localized scale and reset-position controls; scale persists across restarts.
- [x] The overlay can be dragged, remembers its position and returns on-screen after resolution or
  monitor changes.
- [x] Pure placement/scale logic and renderer behavior have regression tests.
- [x] `npm run check` passes and the development app remains open for owner testing.

## Out of scope

- Reading League HUD scale or minimap geometry from unsupported sources.
- Per-champion layouts, multiple simultaneous overlays or exclusive-fullscreen support.

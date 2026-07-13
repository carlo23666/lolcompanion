# WP-025 — Reliable native overlay drag handle

## Why

The visible drag hint receives mouse input but selects its text instead of moving the native
Electron overlay window.

## Scope

- Replace the tiny inline drag style with an explicit, full-width native Electron drag region.
- Prevent text/image selection while interacting with the overlay.
- Keep recommendation content click-through outside the dock and preserve scaling/theme behavior.
- Add a renderer regression test for the drag-region contract.

## Acceptance criteria

- [x] Dragging the grip moves the native overlay and does not select text or images.
- [x] The grip is large enough to acquire reliably without covering recommendation content.
- [x] Existing overlay layout, scale and theme tests remain green.
- [x] `npm run check` passes and the development app is reopened for owner testing.

## Out of scope

- Reading League input, global hotkeys or native input-hook dependencies.
- Arbitrary resize handles; authored resizing remains the existing percentage scale control.

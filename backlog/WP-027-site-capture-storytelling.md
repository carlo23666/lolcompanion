# WP-027 — Site capture storytelling and in-game overlay placement

## Why

The draft section currently repeats the same screenshot at two crops, while the compact overlay
example lacks the in-game HUD context needed to understand its intended placement.

## Scope

- Replace the duplicate draft capture with one current Dark screenshot and a distinct visual
  explanation of the pick/composition/build decision flow.
- Make the theme used by each product capture explicit across the landing page.
- Use the owner-provided gameplay capture as the backdrop for a compact-overlay placement example
  between the real ability bar and minimap.
- Preserve the current expanded overlay presentation, bilingual content and static zero-cost Pages
  architecture.
- Validate EN/ES desktop and mobile layouts and leave the updated site open locally.

## Acceptance criteria

- [x] The draft section contains no duplicate screenshot and communicates three distinct outputs.
- [x] Product captures identify Rift/Hexi, Dark/Sombra or Sakura/Kohaku consistently.
- [x] The compact overlay is visibly placed in an in-game HUD without covering the minimap or skills.
- [x] The owner-provided gameplay backdrop is stored locally and cropped around the relevant HUD strip.
- [x] EN/ES pages have no broken assets, console errors or horizontal overflow at desktop/mobile sizes.
- [x] `npm run check` passes and the staged site remains open for review.

## Out of scope

- Interactive theme switching or recapturing every screen in all three themes.
- Publishing, pushing, merging, analytics, new runtime dependencies or changes to the desktop app.

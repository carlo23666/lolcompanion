/**
 * English message catalog — the SOURCE OF TRUTH for i18n keys (ADR-009).
 * Adding a key here makes it required in es.ts (TypeScript enforces it).
 * Interpolation: `{name}` tokens are replaced from the params object.
 * Keys grow per WP-017 slice; keep them grouped and dotted by area.
 */
export const en = {
  // --- Settings / language ---
  'settings.language': 'Language',
  'settings.language.hint': 'Applies instantly across the app.',

  // --- App shell / navigation ---
  'nav.live': 'Live',
  'nav.history': 'History',
  'nav.settings': 'Settings'
} as const

import type { Catalog } from './types'

/**
 * Spanish catalog. Must define every key in en.ts — the `Catalog` type makes
 * a missing key a compile error, so translations can never silently drift.
 */
export const es: Catalog = {
  // --- Settings / language ---
  'settings.language': 'Idioma',
  'settings.language.hint': 'Se aplica al instante en toda la app.',

  // --- App shell / navigation ---
  'nav.live': 'Live',
  'nav.history': 'Historial',
  'nav.settings': 'Ajustes'
}

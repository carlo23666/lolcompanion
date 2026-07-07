/**
 * The app's three visual identities. Each is a FULL identity: palette,
 * display face, corner language, ambient atmosphere and chrome variant (all
 * CSS-var / data-theme driven in main.css + Shell.tsx) and its own mascot.
 * Single source of truth for renderer AND main (the coach's persona name
 * follows the active theme).
 *
 *  - neon   — "Neón Grieta": void navy + Bitxo pink + coin gold, rift aurora.
 *  - abismo — "Abismo": abyss black + blood crimson, knife-sharp, icon rail.
 *  - anime  — "Estrella": light pastel Star-Guardian kawaii, floating chrome.
 */
export interface AppTheme {
  id: string
  label: string
  hint: string
  /** Mascot + AI persona name for this identity. */
  mascot: string
}

export const THEMES: AppTheme[] = [
  {
    id: 'neon',
    label: 'Neón Grieta',
    hint: 'azul vacío · rosa + oro · mascota Bitxo (ajolote píxel)',
    mascot: 'Bitxo'
  },
  {
    id: 'abismo',
    label: 'Abismo',
    hint: 'negro abisal · carmesí · mascota Sombra (gato negro)',
    mascot: 'Sombra'
  },
  {
    id: 'anime',
    label: 'Estrella',
    hint: 'pastel guardiana estelar · rosa + oro · mascota Yuki (chibi)',
    mascot: 'Yuki'
  }
]

export const DEFAULT_THEME = 'neon'

/** Pre-2.0 ids collapse onto the closest identity. */
const LEGACY_THEME_MAP: Record<string, string> = {
  hextech: 'neon',
  void: 'neon',
  noche: 'abismo',
  recreativa: 'neon',
  sakura: 'anime',
  cabina: 'neon'
}

export function normalizeTheme(theme: string | null | undefined): string {
  if (theme == null || theme === '') return DEFAULT_THEME
  const mapped = LEGACY_THEME_MAP[theme] ?? theme
  return THEMES.some((entry) => entry.id === mapped) ? mapped : DEFAULT_THEME
}

export function mascotNameFor(theme: string | null | undefined): string {
  const id = normalizeTheme(theme)
  return THEMES.find((entry) => entry.id === id)?.mascot ?? 'Bitxo'
}

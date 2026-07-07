/**
 * The app's single visual identity: "Neón Grieta" — void-navy esports base,
 * Bitxo-pink brand glow + coin gold, phase-reactive rift aurora. Palette,
 * typography and illumination live in main.css; this module is the source of
 * truth for the identity id and the mascot/persona name used by renderer AND
 * main (the coach speaks as the mascot).
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
    hint: 'azul vacío · rosa Bitxo + oro · mascota Bitxo (ajolote píxel)',
    mascot: 'Bitxo'
  }
]

export const DEFAULT_THEME = 'neon'

/** Every pre-2.0 theme collapses onto the one identity. */
const LEGACY_THEME_MAP: Record<string, string> = {
  hextech: 'neon',
  void: 'neon',
  noche: 'neon',
  recreativa: 'neon',
  sakura: 'neon',
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

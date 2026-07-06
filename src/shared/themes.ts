/**
 * The app's three visual identities. Each is a FULL identity: palette,
 * typography, corner/panel language (all CSS-var driven in main.css) and its
 * own mascot. Single source of truth for renderer AND main (the coach's
 * persona name follows the active theme).
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
    id: 'recreativa',
    label: 'Recreativa',
    hint: 'salón arcade: píxeles, fichas doradas y CRT teal',
    mascot: 'Bitxo'
  },
  {
    id: 'sakura',
    label: 'Tinta y sakura',
    hint: 'cuaderno de dojo: índigo tinta, rosa sakura, sellos dorados',
    mascot: 'Kumo'
  },
  {
    id: 'cabina',
    label: 'Cabina',
    hint: 'consola de vuelo: instrumentos ámbar sobre verde abisal',
    mascot: 'Byte'
  }
]

export const DEFAULT_THEME = 'recreativa'

/** Pre-1.1 themes map onto the closest new identity. */
const LEGACY_THEME_MAP: Record<string, string> = {
  hextech: 'recreativa',
  void: 'sakura',
  noche: 'cabina'
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

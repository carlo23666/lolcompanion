import type { MessageKey } from './i18n'

/** Complete visual identities shared by the main window, overlay and local coach. */
export interface AppTheme {
  id: string
  labelKey: MessageKey
  hintKey: MessageKey
  mascot: string
}

export const THEMES: AppTheme[] = [
  {
    id: 'rift',
    labelKey: 'theme.rift.label',
    hintKey: 'theme.rift.hint',
    mascot: 'Hexi'
  },
  {
    id: 'dark',
    labelKey: 'theme.dark.label',
    hintKey: 'theme.dark.hint',
    mascot: 'Sombra'
  },
  {
    id: 'sakura',
    labelKey: 'theme.sakura.label',
    hintKey: 'theme.sakura.hint',
    mascot: 'Kohaku'
  }
]

export const DEFAULT_THEME = 'rift'

const LEGACY_THEME_MAP: Record<string, string> = {
  neon: 'rift',
  hextech: 'rift',
  void: 'rift',
  recreativa: 'rift',
  cabina: 'rift',
  abismo: 'dark',
  noche: 'dark',
  anime: 'sakura'
}

export function normalizeTheme(theme: string | null | undefined): string {
  if (theme == null || theme === '') return DEFAULT_THEME
  const normalized = LEGACY_THEME_MAP[theme] ?? theme
  return THEMES.some((entry) => entry.id === normalized) ? normalized : DEFAULT_THEME
}

export function mascotNameFor(theme: string | null | undefined): string {
  const normalized = normalizeTheme(theme)
  return THEMES.find((entry) => entry.id === normalized)?.mascot ?? 'Hexi'
}

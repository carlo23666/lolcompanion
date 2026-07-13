import { useEffect, useRef, useState } from 'react'
import type { SessionPhase } from '@shared/session'
import type { MessageKey } from '@shared/i18n'
import { DEFAULT_THEME, mascotNameFor, normalizeTheme } from '@shared/themes'
import { useT } from '../i18n'

export type Mood = 'sleepy' | 'idle' | 'hyped' | 'focused' | 'thinking' | 'celebrate' | 'alert'

const MOOD_BY_PHASE: Record<SessionPhase, Mood> = {
  idle: 'sleepy',
  clientOpen: 'idle',
  champSelect: 'thinking',
  inGame: 'focused',
  postGame: 'celebrate'
}

const PHRASE_KEYS: Record<SessionPhase, readonly MessageKey[]> = {
  idle: ['mascot.idle.1', 'mascot.idle.2', 'mascot.idle.3'],
  clientOpen: ['mascot.clientOpen.1', 'mascot.clientOpen.2', 'mascot.clientOpen.3'],
  champSelect: ['mascot.champSelect.1', 'mascot.champSelect.2', 'mascot.champSelect.3'],
  inGame: ['mascot.inGame.1', 'mascot.inGame.2', 'mascot.inGame.3'],
  postGame: ['mascot.postGame.1', 'mascot.postGame.2', 'mascot.postGame.3']
}

export function useTheme(): string {
  const [theme, setTheme] = useState(() =>
    normalizeTheme(document.documentElement.dataset['theme'])
  )
  useEffect(() => {
    const onChange = (event: Event): void => {
      setTheme(normalizeTheme((event as CustomEvent<string>).detail))
    }
    window.addEventListener('app-theme', onChange)
    return () => window.removeEventListener('app-theme', onChange)
  }, [])
  return theme || DEFAULT_THEME
}

export function useMascotName(): string {
  return mascotNameFor(useTheme())
}

/**
 * Authored bitmap poses from a project-owned sheet per identity. Expression
 * comes from six drawn poses; CSS only adds presence/weight and honours
 * `prefers-reduced-motion`.
 */
export function CompanionSprite(props: {
  mood: Mood
  alerting?: boolean
  className?: string
}): React.JSX.Element {
  const theme = useTheme()
  const name = mascotNameFor(theme)
  const mood = props.alerting === true ? 'alert' : props.mood === 'hyped' ? 'celebrate' : props.mood
  return (
    <span
      role="img"
      aria-label={`${name}, ${mood}`}
      className={`companion-sprite ${props.className ?? 'h-16 w-16'} ${props.alerting === true ? 'companion-alert-ring' : ''}`}
      data-mood={mood}
      data-mascot={theme}
    />
  )
}

export default function Mascot(props: {
  phase: SessionPhase
  reactKey?: number
}): React.JSX.Element {
  const t = useT()
  const mood = MOOD_BY_PHASE[props.phase]
  const [bubble, setBubble] = useState<string | null>(null)
  const [alerting, setAlerting] = useState(false)
  const phraseIndex = useRef(0)

  useEffect(() => {
    const keys = PHRASE_KEYS[props.phase]
    phraseIndex.current = (phraseIndex.current + 1) % keys.length
    const key = keys[phraseIndex.current]
    setBubble(key === undefined ? null : t(key))
    const timer = setTimeout(() => setBubble(null), 4200)
    return () => clearTimeout(timer)
  }, [props.phase, t])

  useEffect(() => {
    if (props.reactKey === undefined || props.reactKey === 0) return
    setAlerting(true)
    setBubble(t('mascot.alert'))
    const timer = setTimeout(() => {
      setAlerting(false)
      setBubble(null)
    }, 2800)
    return () => clearTimeout(timer)
  }, [props.reactKey, t])

  return (
    <div className="mascot-dock relative flex items-end gap-2">
      <CompanionSprite mood={mood} alerting={alerting} className="h-20 w-20" />
      {bubble !== null && (
        <div className="mascot-bubble alert-in absolute bottom-[88%] left-1/2 z-50 mb-1.5 w-max max-w-48 -translate-x-1/2 rounded-xl px-3 py-2 text-center text-[11px] leading-snug text-slate-200 shadow-2xl">
          {bubble}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { SessionPhase } from '@shared/session'
import { DEFAULT_THEME, mascotNameFor, normalizeTheme } from '@shared/themes'

export type Mood = 'sleepy' | 'idle' | 'hyped' | 'focused'

const MOOD_BY_PHASE: Record<SessionPhase, Mood> = {
  idle: 'sleepy',
  clientOpen: 'idle',
  champSelect: 'hyped',
  inGame: 'focused',
  postGame: 'idle'
}

const PHRASES: Record<SessionPhase, string[]> = {
  idle: ['Zzz…', 'Abre el cliente cuando quieras', 'Modo reposo'],
  clientOpen: ['¡Lista la cola!', '¿Jugamos?', 'Calentando…'],
  champSelect: ['¡Buen pick!', 'Mira sus picks 👀', '¡A por todas!'],
  inGame: ['Concentración…', 'Farmea tranquilo, yo vigilo', 'Ojo al minimapa'],
  postGame: ['GG', 'Analizando la partida…', '¿Otra?']
}

/**
 * Active theme id, live: applyTheme() (App.tsx) dispatches 'app-theme' on
 * every change. One identity today, but the hook stays — it is the single
 * place the renderer learns about identity switches.
 */
export function useTheme(): string {
  const [theme, setTheme] = useState(
    () => normalizeTheme(document.documentElement.dataset['theme']) || DEFAULT_THEME
  )
  useEffect(() => {
    const onChange = (event: Event): void => {
      setTheme(normalizeTheme((event as CustomEvent<string>).detail))
    }
    window.addEventListener('app-theme', onChange)
    return () => window.removeEventListener('app-theme', onChange)
  }, [])
  return theme
}

/** The identity's mascot/persona name. */
export function useMascotName(): string {
  return mascotNameFor(useTheme())
}

/* ----- Bitxo: pixel axolotl coach, real 2-frame sprite walk ----- */

const BITXO_COLORS: Record<string, string> = {
  p: '#ffa7c9', // body pink
  d: '#d96a9b', // limbs / outline
  g: '#ff5d8f', // gill fronds (brand pink)
  E: '#2b2140', // eye
  w: '#ffffff', // eye shine
  c: '#ff6b8a', // cheek blush
  b: '#ffd1e3', // belly
  t: '#e989b1' // tail
}

// 16×13 cells, side view facing right. Frames differ in legs + tail flick.
const BITXO_FRAME_A = [
  '................',
  '.............g.g',
  '............gg.g',
  '....pppppppppgg.',
  '..t.ppppppppppp.',
  '.ttpppppppEwppp.',
  '.ttpppppppppcp..',
  '..tppppbbbbbpp..',
  '...ppbbbbbbbp...',
  '....dd....dd....',
  '....d......d....',
  '................',
  '................'
]
const BITXO_FRAME_B = [
  '................',
  '.............g.g',
  '..t.........gg.g',
  '..t.pppppppppgg.',
  '.ttppppppppppp..',
  '.tppppppppEwppp.',
  '..tppppppppppcp.',
  '...pppppbbbbbp..',
  '....pbbbbbbbp...',
  '.....dd...dd....',
  '......d.....d...',
  '................',
  '................'
]

function PixelFrame(props: { map: string[]; className: string }): React.JSX.Element {
  return (
    <g className={props.className}>
      {props.map.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === '.' ? null : (
            <rect
              key={`${String(x)}-${String(y)}`}
              x={x * 4}
              y={y * 4}
              width="4"
              height="4"
              fill={BITXO_COLORS[cell] ?? BITXO_COLORS['p']}
            />
          )
        )
      )}
    </g>
  )
}

function BitxoSprite(props: { mood: Mood }): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 52" style={{ imageRendering: 'pixelated' }} data-mood={props.mood}>
      <PixelFrame map={BITXO_FRAME_A} className="px-a" />
      <PixelFrame map={BITXO_FRAME_B} className="px-b" />
      {/* Coach headband when locked in. */}
      {props.mood === 'focused' && (
        <g>
          <rect x="34" y="13" width="26" height="3" fill="#f2c14e" />
          <rect x="30" y="14" width="5" height="2" fill="#f2c14e" />
          <rect x="27" y="17" width="4" height="2" fill="#e0a93a" />
        </g>
      )}
      {/* Hype sparkles. */}
      {props.mood === 'hyped' && (
        <g fill="#ffd47e">
          <rect x="24" y="4" width="3" height="3" />
          <rect x="58" y="24" width="3" height="3" />
          <rect x="16" y="12" width="2" height="2" />
        </g>
      )}
      {props.mood === 'sleepy' && (
        <text x="50" y="10" fontSize="8" fill="#8188ac">
          z
        </text>
      )}
    </svg>
  )
}

/**
 * Bitxo, the pixel axolotl coach (SVG, CSS-animated frame swap). Exported as
 * HexiSprite so every existing call site keeps working.
 */
export function HexiSprite(props: {
  mood: Mood
  alerting?: boolean
  className?: string
}): React.JSX.Element {
  const name = useMascotName()
  const alerting = props.alerting ?? false
  const mood = alerting ? 'hyped' : props.mood
  return (
    <span
      role="img"
      aria-label={`${name}, la mascota`}
      className={`hexi inline-block ${props.className ?? 'h-16 w-16'} ${alerting ? 'gold-pulse' : ''}`}
      data-mood={mood}
    >
      <BitxoSprite mood={mood} />
    </span>
  )
}

/**
 * Mascot in the navigation: mood follows the session phase; speaks a short
 * phrase on phase change and reacts when a spike alert lands.
 */
export default function Mascot(props: {
  phase: SessionPhase
  /** Increment to make the mascot react (e.g. new spike alert). */
  reactKey?: number
}): React.JSX.Element {
  const mood = MOOD_BY_PHASE[props.phase]
  const [bubble, setBubble] = useState<string | null>(null)
  const [alerting, setAlerting] = useState(false)
  const phraseIndex = useRef(0)

  useEffect(() => {
    const phrases = PHRASES[props.phase]
    phraseIndex.current = (phraseIndex.current + 1) % phrases.length
    setBubble(phrases[phraseIndex.current] ?? null)
    const timer = setTimeout(() => setBubble(null), 4500)
    return () => clearTimeout(timer)
  }, [props.phase])

  useEffect(() => {
    if (props.reactKey === undefined || props.reactKey === 0) return
    setAlerting(true)
    setBubble('¡Ojo! ⚠')
    const timer = setTimeout(() => {
      setAlerting(false)
      setBubble(null)
    }, 3000)
    return () => clearTimeout(timer)
  }, [props.reactKey])

  return (
    <div className="neon-dock relative flex items-center gap-2" aria-hidden>
      <HexiSprite mood={mood} alerting={alerting} className="h-14 w-14" />
      {bubble !== null && (
        <div className="pixel-bubble alert-in absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-44 -translate-x-1/2 rounded-lg border border-indigo-800/70 bg-slate-900 px-2 py-1.5 text-center text-slate-300 shadow-lg">
          {bubble}
        </div>
      )}
    </div>
  )
}

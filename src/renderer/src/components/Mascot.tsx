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
 * every change so mascots swap instantly with the identity.
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

/** The active identity's mascot/persona name (Bitxo · Kumo · Byte). */
export function useMascotName(): string {
  return mascotNameFor(useTheme())
}

/* ----- Bitxo (recreativa): pixel axolotl, real 2-frame sprite walk ----- */

const BITXO_COLORS: Record<string, string> = {
  p: '#f7a8c4', // body pink
  d: '#d96a9b', // limbs / outline
  g: '#ff6b8a', // gills
  E: '#2b2140', // eye
  b: '#fbc6db', // belly
  t: '#e989b1' // tail
}

// 14×12 cells, side view facing right. Frames differ in legs + tail tip.
const BITXO_FRAME_A = [
  '..............',
  '..........g.g.',
  '.........gg...',
  '....pppppppp..',
  '..tppppppppp..',
  '.ttpppppEpppp.',
  '..tppppppppp..',
  '...pbbbbbbpp..',
  '....dd...dd...',
  '....d.....d...',
  '..............',
  '..............'
]
const BITXO_FRAME_B = [
  '..............',
  '..........g.g.',
  '.........gg...',
  '....pppppppp..',
  '.tpppppppppp..',
  '.tppppppEpppp.',
  '.ttppppppppp..',
  '...pbbbbbbpp..',
  '.....dd..dd...',
  '......d...d...',
  '.....d.....d..',
  '..............'
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
    <svg viewBox="0 0 56 48" style={{ imageRendering: 'pixelated' }} data-mood={props.mood}>
      <PixelFrame map={BITXO_FRAME_A} className="px-a" />
      <PixelFrame map={BITXO_FRAME_B} className="px-b" />
      {props.mood === 'sleepy' && (
        <text x="44" y="10" fontSize="8" fill="#8188ac">
          z
        </text>
      )}
    </svg>
  )
}

/* ----- Kumo (sakura): brush-stroke kitsune spirit ----- */

function KumoSprite(props: { mood: Mood }): React.JSX.Element {
  const closed = props.mood === 'sleepy'
  return (
    <svg viewBox="0 0 64 52" data-mood={props.mood}>
      <path
        className="kumo-tail"
        d="M14 38 Q0 42 2 26 Q8 32 14 28 Q12 34 18 36 Z"
        fill="#f2a7c3"
      />
      <ellipse cx="30" cy="36" rx="16" ry="11" fill="#f4efea" />
      <circle cx="44" cy="26" r="10" fill="#f4efea" />
      {/* ears with sakura inner */}
      <path d="M38 19 l-3 -9 7 5 z" fill="#f4efea" />
      <path d="M39 17.5 l-1.5 -4.5 3.5 2.5 z" fill="#f2a7c3" />
      <path d="M49 19 l3 -9 -7 5 z" fill="#f4efea" />
      <path d="M48 17.5 l1.5 -4.5 -3.5 2.5 z" fill="#f2a7c3" />
      {/* face */}
      {closed ? (
        <path d="M45 26 q2 1.5 4 0" stroke="#632840" strokeWidth="1.2" fill="none" />
      ) : (
        <g className="hexi-eye">
          <circle cx="46" cy="25" r="1.6" fill="#632840" />
        </g>
      )}
      <path d="M52 29 q2 0.5 3 2" stroke="#d9b36c" strokeWidth="1.2" fill="none" />
      {/* gold seal on the haunch */}
      <circle cx="26" cy="36" r="3.4" fill="none" stroke="#d9b36c" strokeWidth="1" />
      <path d="M24.5 36 h3 M26 34.5 v3" stroke="#d9b36c" strokeWidth="0.8" />
    </svg>
  )
}

/* ----- Byte (cabina): copilot drone ----- */

function ByteSprite(props: { mood: Mood }): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 52" data-mood={props.mood}>
      <ellipse cx="32" cy="24" rx="17" ry="12" fill="#16292c" stroke="#9bd1e5" strokeWidth="1.6" />
      {/* visor */}
      <rect x="21" y="19" width="22" height="9" rx="4.5" fill="#0a1517" stroke="#ffb454" strokeWidth="1" />
      <rect
        className="byte-eye"
        x="24"
        y="22"
        width="4"
        height="3"
        fill={props.mood === 'sleepy' ? '#587873' : '#ffb454'}
      />
      {/* antennae + landing struts */}
      <path d="M32 12 v-5 m0 0 l3 -2" stroke="#9bd1e5" strokeWidth="1.4" fill="none" />
      <circle cx="35.5" cy="4.5" r="1.5" fill="#ffb454" />
      <path d="M17 33 l-5 7 M47 33 l5 7" stroke="#9bd1e5" strokeWidth="1.6" />
      {/* status lights */}
      <circle cx="45" cy="30" r="1.3" fill={props.mood === 'hyped' ? '#ffb454' : '#9bd1e5'} />
    </svg>
  )
}

/**
 * The active identity's mascot (SVG, CSS animated): Bitxo the pixel axolotl,
 * Kumo the kitsune spirit or Byte the copilot drone. Exported as HexiSprite
 * so every existing call site keeps working.
 */
export function HexiSprite(props: {
  mood: Mood
  alerting?: boolean
  className?: string
}): React.JSX.Element {
  const theme = useTheme()
  const name = mascotNameFor(theme)
  const alerting = props.alerting ?? false
  const mood = alerting ? 'hyped' : props.mood
  return (
    <span
      role="img"
      aria-label={`${name}, la mascota`}
      className={`hexi inline-block ${props.className ?? 'h-16 w-16'} ${alerting ? 'gold-pulse' : ''}`}
      data-mood={mood}
    >
      {theme === 'sakura' ? (
        <KumoSprite mood={mood} />
      ) : theme === 'cabina' ? (
        <ByteSprite mood={mood} />
      ) : (
        <BitxoSprite mood={mood} />
      )}
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
    <div className="relative flex items-center gap-2" aria-hidden>
      <HexiSprite mood={mood} alerting={alerting} className="h-10 w-10" />
      {bubble !== null && (
        <div className="alert-in absolute top-full right-0 z-50 mt-1 w-max max-w-44 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-center text-[10px] text-slate-300 shadow-lg">
          {bubble}
        </div>
      )}
    </div>
  )
}

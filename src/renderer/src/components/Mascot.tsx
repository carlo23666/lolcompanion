import { useEffect, useRef, useState } from 'react'
import type { SessionPhase } from '@shared/session'
import type { MessageKey } from '@shared/i18n'
import { DEFAULT_THEME, mascotNameFor, normalizeTheme } from '@shared/themes'
import { useT } from '../i18n'

export type Mood = 'sleepy' | 'idle' | 'hyped' | 'focused'

const MOOD_BY_PHASE: Record<SessionPhase, Mood> = {
  idle: 'sleepy',
  clientOpen: 'idle',
  champSelect: 'hyped',
  inGame: 'focused',
  postGame: 'idle'
}

const PHRASE_KEYS: Record<SessionPhase, readonly MessageKey[]> = {
  idle: ['mascot.idle.1', 'mascot.idle.2', 'mascot.idle.3'],
  clientOpen: ['mascot.clientOpen.1', 'mascot.clientOpen.2', 'mascot.clientOpen.3'],
  champSelect: ['mascot.champSelect.1', 'mascot.champSelect.2', 'mascot.champSelect.3'],
  inGame: ['mascot.inGame.1', 'mascot.inGame.2', 'mascot.inGame.3'],
  postGame: ['mascot.postGame.1', 'mascot.postGame.2', 'mascot.postGame.3']
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

/* ----- Sombra (abismo): black cat, blood-crimson eyes ----- */

function SombraSprite(props: { mood: Mood }): React.JSX.Element {
  const mood = props.mood
  const eye = (cx: number): React.JSX.Element =>
    mood === 'sleepy' ? (
      <path
        d={`M${String(cx - 2.4)} 22 q2.4 1.8 4.8 0`}
        stroke="#e3244a"
        strokeWidth="1.1"
        fill="none"
      />
    ) : mood === 'focused' ? (
      <rect
        className="cat-eye-glow"
        x={cx - 2.2}
        y={20.9}
        width="4.4"
        height="1.6"
        fill="#e3244a"
        color="#e3244a"
      />
    ) : (
      <g className="hexi-eye">
        <ellipse
          className="cat-eye-glow"
          cx={cx}
          cy={21.8}
          rx={mood === 'hyped' ? 2.4 : 2}
          ry={mood === 'hyped' ? 2.6 : 1.7}
          fill="#e3244a"
          color="#e3244a"
        />
        <rect x={cx - 0.5} y={20.4} width="1" height="2.8" fill="#0c0c13" />
      </g>
    )
  return (
    <svg viewBox="0 0 64 52" data-mood={mood}>
      {/* tail curls around the body, swaying slow and predatory */}
      <path
        className="cat-tail"
        d="M16 44 Q6 42 8 32 Q9 27 14 26 Q11 31 13 35 Q15 40 22 42 Z"
        fill="#0c0c13"
      />
      {/* body + chest */}
      <ellipse cx="30" cy="38" rx="14" ry="11" fill="#0c0c13" />
      <ellipse cx="34" cy="41" rx="7" ry="7.5" fill="#16161f" />
      {/* head */}
      <circle cx="42" cy="22" r="10" fill="#0c0c13" />
      <path d="M35 15 l-2.5 -8.5 7.5 4.5 z" fill="#0c0c13" />
      <path d="M36 14 l-1.2 -4.5 3.8 2.4 z" fill="#520d1e" />
      <path d="M49 15 l2.5 -8.5 -7.5 4.5 z" fill="#0c0c13" />
      <path d="M48 14 l1.2 -4.5 -3.8 2.4 z" fill="#520d1e" />
      {eye(38.5)}
      {eye(45.5)}
      {/* whiskers */}
      <path d="M50 25 h5 M50 27 l4.5 1.5" stroke="#555571" strokeWidth="0.7" fill="none" />
      {/* crimson collar + tag */}
      <path d="M35 30 q7 3.5 14 0 l-0.5 2.5 q-6.5 3 -13 0 z" fill="#921530" />
      <circle cx="42" cy="33.5" r="1.6" fill="#d8b86a" />
      {mood === 'sleepy' && (
        <text x="53" y="10" fontSize="8" fill="#555571">
          z
        </text>
      )}
    </svg>
  )
}

/* ----- Yuki (anime): chibi star-guardian coach ----- */

function YukiSprite(props: { mood: Mood }): React.JSX.Element {
  const mood = props.mood
  const eye = (cx: number): React.JSX.Element =>
    mood === 'sleepy' ? (
      <path
        d={`M${String(cx - 2.5)} 25 q2.5 2 5 0`}
        stroke="#5a3566"
        strokeWidth="1.3"
        fill="none"
      />
    ) : mood === 'hyped' ? (
      <path
        d={`M${String(cx)} 22.2 l1 2 2.2 0.3 -1.6 1.6 0.4 2.2 -2 -1.1 -2 1.1 0.4 -2.2 -1.6 -1.6 2.2 -0.3 z`}
        fill="#c9821e"
      />
    ) : (
      <g className="hexi-eye">
        <ellipse cx={cx} cy={25} rx="2.4" ry={mood === 'focused' ? 2.2 : 3} fill="#5a3566" />
        <circle cx={cx + 0.8} cy={24} r="0.9" fill="#fff" />
      </g>
    )
  return (
    <svg viewBox="0 0 64 52" data-mood={mood}>
      {/* twin tails (bob against the float) */}
      <path className="yuki-hair-l" d="M20 15 Q10 22 13 36 Q18 31 20 22 Z" fill="#f7a8cc" />
      <path className="yuki-hair-r" d="M44 15 Q54 22 51 36 Q46 31 44 22 Z" fill="#f7a8cc" />
      {/* hair cap + face */}
      <circle cx="32" cy="20" r="13" fill="#f7a8cc" />
      <circle cx="32" cy="24" r="10.5" fill="#ffe3d2" />
      {/* bangs */}
      <path d="M22 20 q3 -6 10 -6 q7 0 10 6 l-3 3 -2.5 -3 -2.5 3 -2 -3 -2.5 3 -2.5 -3 z" fill="#f7a8cc" />
      {/* star clips */}
      <path d="M21 16 l0.8 1.6 1.8 0.2 -1.3 1.3 0.3 1.8 -1.6 -0.9 -1.6 0.9 0.3 -1.8 -1.3 -1.3 1.8 -0.2 z" fill="#ffd77e" />
      {eye(27.5)}
      {eye(36.5)}
      {/* blush + mouth */}
      <circle cx="24.5" cy="27.5" r="1.6" fill="#ff9db0" opacity="0.55" />
      <circle cx="39.5" cy="27.5" r="1.6" fill="#ff9db0" opacity="0.55" />
      <path
        d={mood === 'hyped' ? 'M30 30 q2 2.4 4 0' : 'M30.5 30 q1.5 1.4 3 0'}
        stroke="#c04476"
        strokeWidth="1"
        fill="none"
      />
      {/* focused: determined brows */}
      {mood === 'focused' && (
        <path d="M25 20.5 l4.5 1 M39 20.5 l-4.5 1" stroke="#5a3566" strokeWidth="1.1" />
      )}
      {/* chibi body: white uniform with pink trim + star brooch */}
      <path d="M26 34 h12 q2 6 -1 10 h-10 q-3 -4 -1 -10 z" fill="#ffffff" stroke="#f06ba6" strokeWidth="1" />
      <path d="M26.5 42 q5.5 2.5 11 0 l1 2.5 q-6.5 3 -13 0 z" fill="#f06ba6" />
      <path d="M32 36 l0.9 1.8 2 0.3 -1.5 1.4 0.4 2 -1.8 -1 -1.8 1 0.4 -2 -1.5 -1.4 2 -0.3 z" fill="#ffd77e" />
      {mood === 'sleepy' && (
        <text x="50" y="10" fontSize="8" fill="#ad7495">
          z
        </text>
      )}
    </svg>
  )
}

/**
 * The active identity's mascot (SVG, CSS animated): Bitxo the pixel axolotl,
 * Sombra the black cat or Yuki the chibi star guardian. Exported as
 * HexiSprite so every existing call site keeps working.
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
      {theme === 'abismo' ? (
        <SombraSprite mood={mood} />
      ) : theme === 'anime' ? (
        <YukiSprite mood={mood} />
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
  const t = useT()
  const mood = MOOD_BY_PHASE[props.phase]
  const [bubble, setBubble] = useState<string | null>(null)
  const [alerting, setAlerting] = useState(false)
  const phraseIndex = useRef(0)

  useEffect(() => {
    const keys = PHRASE_KEYS[props.phase]
    phraseIndex.current = (phraseIndex.current + 1) % keys.length
    const key = keys[phraseIndex.current]
    setBubble(key ? t(key) : null)
    const timer = setTimeout(() => setBubble(null), 4500)
    return () => clearTimeout(timer)
  }, [props.phase, t])

  useEffect(() => {
    if (props.reactKey === undefined || props.reactKey === 0) return
    setAlerting(true)
    setBubble(t('mascot.alert'))
    const timer = setTimeout(() => {
      setAlerting(false)
      setBubble(null)
    }, 3000)
    return () => clearTimeout(timer)
  }, [props.reactKey, t])

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

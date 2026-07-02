import { useEffect, useRef, useState } from 'react'
import type { SessionPhase } from '@shared/session'

type Mood = 'sleepy' | 'idle' | 'hyped' | 'focused'

const MOOD_BY_PHASE: Record<SessionPhase, Mood> = {
  idle: 'sleepy',
  clientOpen: 'idle',
  champSelect: 'hyped',
  inGame: 'focused',
  postGame: 'idle'
}

const PHRASES: Record<SessionPhase, string[]> = {
  idle: ['Zzz…', 'Abre el cliente cuando quieras', 'Descansando el cristal'],
  clientOpen: ['¡Lista para la cola!', '¿Jugamos?', 'Calentando el cristal…'],
  champSelect: ['¡Buen pick!', 'Mira sus picks 👀', '¡A por todas!'],
  inGame: ['Concentrada…', 'Farmea tranquilo, yo vigilo', 'Ojo al minimapa'],
  postGame: ['GG', 'Analizando la partida…', '¿Otra?']
}

/**
 * Hexi — the app mascot: an original little hextech spirit (SVG, CSS
 * animated). Mood follows the session phase; speaks a short phrase on phase
 * change and squeaks visually when a spike alert lands.
 */
export default function Mascot(props: {
  phase: SessionPhase
  /** Increment to make Hexi react (e.g. new spike alert). */
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
    <div className="relative mt-auto flex flex-col items-center pb-1" aria-hidden>
      {bubble !== null && (
        <div className="alert-in mb-1 max-w-36 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-center text-[10px] text-slate-300">
          {bubble}
        </div>
      )}
      <svg
        viewBox="0 0 64 64"
        className={`hexi h-16 w-16 ${alerting ? 'gold-pulse rounded-full' : ''}`}
        data-mood={alerting ? 'hyped' : mood}
        role="img"
        aria-label="Hexi, la mascota"
      >
        {/* crystal */}
        <g className="hexi-crystal">
          <polygon points="32,2 38,10 32,16 26,10" fill="#7fd4e4" />
          <polygon points="32,2 38,10 32,16 26,10" fill="none" stroke="#0a9bb4" strokeWidth="1" />
        </g>
        {/* body */}
        <ellipse cx="32" cy="38" rx="20" ry="18" fill="#0a1428" stroke="#c8aa6e" strokeWidth="2" />
        <ellipse cx="32" cy="38" rx="20" ry="18" fill="url(#hexiGlow)" opacity="0.35" />
        <defs>
          <radialGradient id="hexiGlow" cx="0.5" cy="0.35" r="0.8">
            <stop offset="0%" stopColor="#7fd4e4" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        {/* eyes */}
        <g className="hexi-eye">
          <circle cx="25" cy="36" r="3.4" fill="#e8c979" />
          <circle cx="39" cy="36" r="3.4" fill="#e8c979" />
          <circle cx="26" cy="35" r="1.2" fill="#010a13" />
          <circle cx="40" cy="35" r="1.2" fill="#010a13" />
        </g>
        {/* mouth: smile when hyped, focused line otherwise */}
        {mood === 'hyped' || alerting ? (
          <path d="M27 45 Q32 50 37 45" stroke="#e8c979" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        ) : mood === 'sleepy' ? (
          <ellipse cx="32" cy="46" rx="2.2" ry="1.4" fill="#e8c979" opacity="0.7" />
        ) : (
          <path d="M28 46 L36 46" stroke="#e8c979" strokeWidth="1.6" strokeLinecap="round" />
        )}
        {/* gold runes on the body */}
        <path d="M18 44 l3 -2 M46 44 l-3 -2" stroke="#c8aa6e" strokeWidth="1" opacity="0.6" />
      </svg>
    </div>
  )
}

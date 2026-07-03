import type { SessionPhase } from '@shared/session'
import Mascot from './Mascot'

export type ViewId = 'live' | 'history' | 'settings'

const ITEMS: { id: ViewId; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'history', label: 'Historial' },
  { id: 'settings', label: 'Ajustes' }
]

const PHASE_DOT: Record<SessionPhase, { color: string; label: string }> = {
  idle: { color: 'bg-slate-600', label: 'Cliente cerrado' },
  clientOpen: { color: 'bg-indigo-500', label: 'Cliente abierto' },
  champSelect: { color: 'bg-amber-400', label: 'Selección de campeones' },
  inGame: { color: 'bg-emerald-500', label: 'En partida' },
  postGame: { color: 'bg-indigo-300', label: 'Partida terminada' }
}

/**
 * Top navigation: brand, view tabs with an animated underline, session state
 * dot and Hexi on the right. Replaces the old sidebar (owner request).
 */
export default function TopBar(props: {
  active: ViewId
  onSelect: (view: ViewId) => void
  phase: SessionPhase
  mascotReactKey?: number
}): React.JSX.Element {
  const phase = PHASE_DOT[props.phase]
  return (
    <header className="flex h-12 shrink-0 items-center gap-6 border-b border-slate-800 bg-slate-950/80 px-4 backdrop-blur-sm">
      <p className="text-sm font-bold tracking-widest text-amber-300 uppercase">LoL Companion</p>

      <nav className="flex h-full items-stretch gap-1">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => props.onSelect(item.id)}
            aria-current={props.active === item.id ? 'page' : undefined}
            className={`tab-underline relative px-3 text-sm transition-colors ${
              props.active === item.id
                ? 'font-semibold text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <span
          className="flex items-center gap-1.5 text-[11px] text-slate-400"
          title={phase.label}
        >
          <span className={`h-2 w-2 rounded-full ${phase.color}`} aria-hidden />
          {phase.label}
        </span>
        <Mascot phase={props.phase} reactKey={props.mascotReactKey} />
      </div>
    </header>
  )
}

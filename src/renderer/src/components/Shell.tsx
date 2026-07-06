import type { SessionPhase } from '@shared/session'
import Mascot from './Mascot'

export type ViewId = 'live' | 'history' | 'settings'

const ITEMS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'live', label: 'Live', icon: '▶' },
  { id: 'history', label: 'Historial', icon: '▤' },
  { id: 'settings', label: 'Ajustes', icon: '⚙' }
]

const PHASE_DOT: Record<SessionPhase, { color: string; label: string }> = {
  idle: { color: 'bg-slate-600', label: 'Cliente cerrado' },
  clientOpen: { color: 'bg-indigo-500', label: 'Cliente abierto' },
  champSelect: { color: 'bg-amber-400', label: 'Selección de campeones' },
  inGame: { color: 'bg-emerald-500', label: 'En partida' },
  postGame: { color: 'bg-indigo-300', label: 'Partida terminada' }
}

/**
 * The app shell: one professional layout for every identity (Discord/Blitz
 * style left sidebar) — themes change accent, surfaces and mascot, never the
 * chrome. Brand wordmark is the only place the identity's display face shows.
 */
export default function Shell(props: {
  active: ViewId
  onSelect: (view: ViewId) => void
  phase: SessionPhase
  mascotReactKey?: number
  children: React.ReactNode
}): React.JSX.Element {
  const phase = PHASE_DOT[props.phase]
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-52 shrink-0 flex-col border-r border-slate-800 bg-slate-900 py-4">
        <p
          className="mb-6 px-4 text-[10px] leading-relaxed tracking-wide text-amber-300"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          LOL COMPANION
        </p>
        <nav className="flex flex-col gap-0.5 px-2">
          {ITEMS.map((item) => {
            const active = props.active === item.id
            return (
              <button
                key={item.id}
                onClick={() => props.onSelect(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm ${
                  active
                    ? 'bg-slate-800 font-semibold text-slate-100'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                {active && (
                  <span
                    className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-amber-400"
                    aria-hidden
                  />
                )}
                <span className="w-4 text-center text-xs text-slate-500" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="mt-auto flex flex-col items-center gap-2.5 px-4">
          <Mascot phase={props.phase} reactKey={props.mascotReactKey} />
          <span
            className="flex items-center gap-1.5 text-[10px] text-slate-500"
            title={phase.label}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${phase.color}`} aria-hidden />
            {phase.label}
          </span>
        </div>
      </aside>
      <main className="min-h-0 flex-1 overflow-y-auto">{props.children}</main>
    </div>
  )
}

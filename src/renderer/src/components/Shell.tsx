import { useEffect } from 'react'
import type { SessionPhase } from '@shared/session'
import Mascot from './Mascot'

export type ViewId = 'live' | 'history' | 'settings'

const ITEMS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'live', label: 'Live', icon: '▶' },
  { id: 'history', label: 'Historial', icon: '▤' },
  { id: 'settings', label: 'Ajustes', icon: '⚙' }
]

const PHASE_DOT: Record<SessionPhase, { color: string; label: string; live: boolean }> = {
  idle: { color: 'bg-slate-600 text-slate-600', label: 'Cliente cerrado', live: false },
  clientOpen: { color: 'bg-indigo-500 text-indigo-500', label: 'Cliente abierto', live: true },
  champSelect: {
    color: 'bg-amber-400 text-amber-400',
    label: 'Selección de campeones',
    live: true
  },
  inGame: { color: 'bg-emerald-500 text-emerald-500', label: 'En partida', live: true },
  postGame: { color: 'bg-indigo-300 text-indigo-300', label: 'Partida terminada', live: false }
}

/**
 * The app shell: Blitz-style left sidebar over the rift aurora. The sidebar
 * carries the brand (gradient wordmark), display-font nav with an
 * illuminated active state, and Bitxo on his neon dock at the bottom.
 */
export default function Shell(props: {
  active: ViewId
  onSelect: (view: ViewId) => void
  phase: SessionPhase
  mascotReactKey?: number
  children: React.ReactNode
}): React.JSX.Element {
  const phase = PHASE_DOT[props.phase]

  // The rift aurora (body::before) reads the phase from <html>.
  useEffect(() => {
    document.documentElement.dataset['phase'] = props.phase
  }, [props.phase])

  return (
    <div className="flex h-screen text-slate-100">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-900/80 py-4 backdrop-blur-sm">
        <div className="mb-1 px-4">
          <p className="wordmark text-base leading-tight tracking-[0.08em]">LOL COMPANION</p>
          <p className="text-[10px] tracking-[0.3em] text-slate-500 uppercase">tu coach local</p>
        </div>
        <div
          className="mx-4 mt-2 mb-5 h-px bg-gradient-to-r from-amber-400/50 via-indigo-500/40 to-transparent"
          aria-hidden
        />
        <nav className="flex flex-col gap-1 px-2">
          {ITEMS.map((item) => {
            const active = props.active === item.id
            return (
              <button
                key={item.id}
                onClick={() => props.onSelect(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-semibold tracking-wide uppercase transition-transform ${
                  active
                    ? 'bg-indigo-500/10 text-slate-100 shadow-[0_0_14px_-2px_var(--color-indigo-500)]'
                    : 'text-slate-400 hover:translate-x-0.5 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                {active && (
                  <span
                    className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-indigo-500 shadow-[0_0_8px_var(--color-indigo-500)]"
                    aria-hidden
                  />
                )}
                <span
                  className={`w-4 text-center text-xs ${active ? 'text-indigo-300' : 'text-slate-500'}`}
                  aria-hidden
                >
                  {item.icon}
                </span>
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="mt-auto flex flex-col items-center gap-3 px-4">
          <Mascot phase={props.phase} reactKey={props.mascotReactKey} />
          <span
            className="flex items-center gap-1.5 font-display text-[10px] tracking-[0.14em] text-slate-500 uppercase"
            title={phase.label}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${phase.color} ${phase.live ? 'dot-ping' : ''}`}
              aria-hidden
            />
            {phase.label}
          </span>
        </div>
      </aside>
      <main className="min-h-0 flex-1 overflow-y-auto">{props.children}</main>
    </div>
  )
}

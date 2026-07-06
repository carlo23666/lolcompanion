import type { SessionPhase } from '@shared/session'
import Mascot, { useTheme } from './Mascot'

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

interface ShellProps {
  active: ViewId
  onSelect: (view: ViewId) => void
  phase: SessionPhase
  mascotReactKey?: number
  children: React.ReactNode
}

/* Recreativa: arcade cabinet — marquee header, chunky nav buttons, coin slot
 * status strip at the bottom. */
function ArcadeShell(props: ShellProps): React.JSX.Element {
  const phase = PHASE_DOT[props.phase]
  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex shrink-0 items-center gap-4 border-b-4 border-slate-800 bg-slate-900 px-4 py-2">
        <p
          className="text-[11px] leading-relaxed tracking-wide text-amber-300"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          LOL COMPANION
        </p>
        <nav className="flex items-stretch gap-2">
          {ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => props.onSelect(item.id)}
              aria-current={props.active === item.id ? 'page' : undefined}
              style={{ fontFamily: 'var(--font-display)' }}
              className={`px-3 py-1.5 text-[9px] leading-relaxed tracking-wide uppercase ${
                props.active === item.id
                  ? 'border-amber-400 bg-amber-400/15 text-amber-300'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Mascot phase={props.phase} reactKey={props.mascotReactKey} />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">{props.children}</main>
      <footer
        className="flex shrink-0 items-center justify-between border-t-4 border-slate-800 bg-slate-900 px-4 py-1 text-[9px] tracking-wide text-slate-500"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        <span className="flex items-center gap-2 uppercase">
          <span className={`inline-block h-2 w-2 ${phase.color}`} aria-hidden />
          {phase.label}
        </span>
        <span className="text-amber-400/70">INSERT COIN · 1UP</span>
      </footer>
    </div>
  )
}

/* Sakura: notebook — washi bookmark tabs on the LEFT edge, airy content
 * scroll, hanging seal with the mascot at the bottom of the rail. */
function NotebookShell(props: ShellProps): React.JSX.Element {
  const phase = PHASE_DOT[props.phase]
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-40 shrink-0 flex-col border-r border-slate-800 bg-slate-900/60 py-6">
        <p
          className="mb-6 px-4 text-sm font-bold text-slate-100"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          LoL Companion
          <span className="mt-1 block h-0.5 w-8 bg-indigo-300" aria-hidden />
        </p>
        <nav className="flex flex-col gap-1">
          {ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => props.onSelect(item.id)}
              aria-current={props.active === item.id ? 'page' : undefined}
              className={`mr-3 !rounded-r-full py-2 pr-4 pl-4 text-left text-sm transition-colors ${
                props.active === item.id
                  ? 'bg-indigo-300/15 font-semibold text-indigo-300'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto flex flex-col items-center gap-2 px-4">
          <Mascot phase={props.phase} reactKey={props.mascotReactKey} />
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500" title={phase.label}>
            <span className={`h-1.5 w-1.5 rounded-full ${phase.color}`} aria-hidden />
            {phase.label}
          </span>
        </div>
      </aside>
      <main className="min-h-0 flex-1 overflow-y-auto">{props.children}</main>
    </div>
  )
}

/* Cabina: cockpit — narrow instrument rail on the left, telemetry readout
 * strip across the top. */
function CockpitShell(props: ShellProps): React.JSX.Element {
  const phase = PHASE_DOT[props.phase]
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-slate-700 bg-slate-900 py-3">
        <span className="mb-2 text-lg text-amber-400" aria-hidden>
          ◈
        </span>
        {ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => props.onSelect(item.id)}
            aria-current={props.active === item.id ? 'page' : undefined}
            aria-label={item.label}
            title={item.label}
            className={`flex h-10 w-10 items-center justify-center text-base ${
              props.active === item.id
                ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span aria-hidden>{item.icon}</span>
            <span className="sr-only">{item.label}</span>
          </button>
        ))}
        <div className="mt-auto">
          <Mascot phase={props.phase} reactKey={props.mascotReactKey} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex shrink-0 items-center gap-4 border-b border-slate-700 bg-slate-900 px-4 py-1.5 text-[11px] tracking-wider text-slate-400 uppercase"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <span className="text-amber-300">LOL COMPANION</span>
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 ${phase.color}`} aria-hidden />
            {phase.label}
          </span>
          <span className="ml-auto text-slate-600">{ITEMS.find((i) => i.id === props.active)?.label}</span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{props.children}</main>
      </div>
    </div>
  )
}

/**
 * The app shell IS part of the identity: Recreativa = arcade cabinet (marquee
 * top + coin strip), Sakura = notebook (washi tabs on the left), Cabina =
 * cockpit (instrument rail + telemetry strip). Navigation buttons keep the
 * same accessible names in all three.
 */
export default function Shell(props: ShellProps): React.JSX.Element {
  const theme = useTheme()
  if (theme === 'sakura') return <NotebookShell {...props} />
  if (theme === 'cabina') return <CockpitShell {...props} />
  return <ArcadeShell {...props} />
}

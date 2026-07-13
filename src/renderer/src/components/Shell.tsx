import { useEffect } from 'react'
import type { SessionPhase } from '@shared/session'
import type { MessageKey } from '@shared/i18n'
import { useT } from '../i18n'
import Mascot from './Mascot'
import BrandMark from './BrandMark'

export type ViewId = 'live' | 'history' | 'settings'

const ITEMS: { id: ViewId; labelKey: MessageKey }[] = [
  { id: 'live', labelKey: 'nav.live' },
  { id: 'history', labelKey: 'nav.history' },
  { id: 'settings', labelKey: 'nav.settings' }
]

const PHASE: Record<SessionPhase, { labelKey: MessageKey; live: boolean }> = {
  idle: { labelKey: 'phase.idle', live: false },
  clientOpen: { labelKey: 'phase.clientOpen', live: true },
  champSelect: { labelKey: 'phase.champSelect', live: true },
  inGame: { labelKey: 'phase.inGame', live: true },
  postGame: { labelKey: 'phase.postGame', live: false }
}

function NavGlyph(props: { id: ViewId }): React.JSX.Element {
  if (props.id === 'history') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5M12 7v5l3 2" />
      </svg>
    )
  }
  if (props.id === 'settings') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M5 6h14M8 6v4M5 12h14M16 12v4M5 18h14" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5 17V7l7-3 7 3v10l-7 3-7-3Z" />
      <path d="m9 9 6 3-6 3V9Z" />
    </svg>
  )
}

export default function Shell(props: {
  active: ViewId
  onSelect: (view: ViewId) => void
  phase: SessionPhase
  mascotReactKey?: number
  children: React.ReactNode
}): React.JSX.Element {
  const t = useT()
  const phase = PHASE[props.phase]

  useEffect(() => {
    document.documentElement.dataset['phase'] = props.phase
  }, [props.phase])

  return (
    <div className="app-frame flex h-screen text-slate-100">
      <aside className="command-rail flex w-[214px] shrink-0 flex-col border-r px-3 py-4">
        <div className="brand-lockup flex items-center gap-3 px-2">
          <BrandMark className="brand-mark h-11 w-11 shrink-0" />
          <div className="min-w-0">
            <p className="wordmark truncate text-[15px] tracking-[0.16em]">WINCON</p>
            <p className="text-[9px] font-semibold tracking-[0.28em] text-slate-500 uppercase">
              {t('shell.productLine')}
            </p>
          </div>
        </div>

        <div className="signal-rule mx-2 my-5" aria-hidden />

        <nav className="flex flex-col gap-1" aria-label={t('shell.primaryNav')}>
          {ITEMS.map((item) => {
            const active = props.active === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => props.onSelect(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`nav-command group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold ${
                  active
                    ? 'nav-command-active text-slate-100'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                <span className="nav-glyph h-5 w-5 shrink-0">
                  <NavGlyph id={item.id} />
                </span>
                <span>{t(item.labelKey)}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-300" />}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center pt-8">
          <Mascot phase={props.phase} reactKey={props.mascotReactKey} />
          <div
            className="phase-console mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2"
            title={t(phase.labelKey)}
          >
            <span className={`phase-beacon ${phase.live ? 'phase-beacon-live' : ''}`} aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold tracking-[0.12em] text-slate-300 uppercase">
                {t(phase.labelKey)}
              </p>
              <p className="text-[9px] text-slate-600">{t('shell.localData')}</p>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-h-0 flex-1 overflow-y-auto">{props.children}</main>
    </div>
  )
}

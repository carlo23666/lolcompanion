import { useEffect, useRef, useState } from 'react'
import { HexiSprite } from './components/Mascot'
import { useIpcEvent, useLiveInsights, type LiveAlert } from './hooks'

const ACTION_LABEL: Record<string, string> = {
  prioritize: 'COMPRA YA',
  add: 'PRÓXIMA COMPRA',
  delay: 'ESPERA',
  replace: 'VENDE Y CAMBIA'
}

const ALERT_SHOW_MS = 6000

/**
 * In-game overlay (transparent always-on-top window, ?overlay=1): Hexi
 * delivers the top recommendation in a speech bubble and interrupts it for a
 * few seconds when a spike/objective alert lands. Draggable by the handle;
 * the main process shows/hides the window per session phase.
 */
export default function OverlayApp(): React.JSX.Element | null {
  const recommendations = useIpcEvent('gamestate:recommendations')
  const insights = useLiveInsights()
  const [activeAlert, setActiveAlert] = useState<LiveAlert | null>(null)
  const lastAlertIdRef = useRef(0)

  // A new spike/objective alert takes over the bubble for a few seconds.
  useEffect(() => {
    const newest = insights.alerts[0]
    if (!newest || newest.id === lastAlertIdRef.current) return
    lastAlertIdRef.current = newest.id
    if (newest.kind !== 'spike' && newest.kind !== 'objective') return
    setActiveAlert(newest)
    const timer = setTimeout(() => setActiveAlert(null), ALERT_SHOW_MS)
    return () => clearTimeout(timer)
  }, [insights.alerts])

  const top = recommendations?.recommendations[0]

  return (
    <div className="flex h-screen w-screen flex-col justify-start bg-transparent p-1">
      <div
        className="flex cursor-move items-center justify-between px-2 py-0.5"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="rounded bg-slate-950/70 px-1.5 text-[9px] font-bold tracking-widest text-amber-300/90 uppercase">
          LoL Companion
        </span>
        <span className="rounded bg-slate-950/70 px-1.5 text-[9px] text-slate-500">
          arrastra para mover
        </span>
      </div>

      <div className="flex items-start gap-1.5">
        <HexiSprite
          mood="focused"
          alerting={activeAlert !== null}
          className="h-12 w-12 shrink-0 drop-shadow-[0_0_6px_rgba(10,155,180,0.5)]"
        />

        {activeAlert !== null ? (
          <div
            className={`alert-in min-w-0 flex-1 rounded-lg border bg-slate-950/90 px-2.5 py-1.5 shadow-lg backdrop-blur-sm ${
              activeAlert.kind === 'objective' ? 'border-emerald-500/60' : 'border-amber-400/60'
            }`}
          >
            <p
              className={`text-xs font-semibold ${
                activeAlert.kind === 'objective' ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              {activeAlert.kind === 'objective' ? '🎯' : '⚠'} {activeAlert.text}
            </p>
          </div>
        ) : top ? (
          <div className="card-in flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-amber-400/40 bg-slate-950/90 px-2.5 py-1.5 shadow-lg backdrop-blur-sm">
            {top.itemId !== null && (
              <img
                src={`ddicon://item/${String(top.itemId)}.png`}
                alt=""
                className="h-9 w-9 rounded border border-slate-700"
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">
                {top.itemName ?? top.category}{' '}
                <span className="text-[10px] font-bold text-indigo-300">
                  {ACTION_LABEL[top.action] ?? ''}
                </span>
              </p>
              {top.reasons[0] !== undefined && (
                <p className="truncate text-[11px] text-slate-400" title={top.reasons.join('\n')}>
                  {top.reasons[0]}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1 rounded-lg border border-slate-700/60 bg-slate-950/90 px-2.5 py-1.5">
            <p className="text-[11px] text-slate-500">Esperando recomendación…</p>
          </div>
        )}
      </div>
    </div>
  )
}

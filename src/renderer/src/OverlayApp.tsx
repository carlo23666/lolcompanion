import { useIpcEvent, useLiveInsights } from './hooks'

const ACTION_LABEL: Record<string, string> = {
  prioritize: 'COMPRA YA',
  add: 'PRÓXIMA COMPRA',
  delay: 'ESPERA'
}

/**
 * Compact in-game overlay (transparent always-on-top window, ?overlay=1).
 * Shows only the top recommendation and the latest spike alert; draggable by
 * its handle. The main process shows/hides the window per session phase.
 */
export default function OverlayApp(): React.JSX.Element | null {
  const recommendations = useIpcEvent('gamestate:recommendations')
  const insights = useLiveInsights()
  const top = recommendations?.recommendations[0]
  const alert = insights.alerts[0]

  return (
    <div className="flex h-screen w-screen flex-col justify-start bg-transparent p-1">
      <div className="card-in overflow-hidden rounded-lg border border-amber-400/40 bg-slate-950/85 shadow-lg backdrop-blur-sm">
        <div
          className="flex cursor-move items-center justify-between bg-slate-900/80 px-2 py-0.5"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <span className="text-[10px] font-bold tracking-widest text-amber-300 uppercase">
            LoL Companion
          </span>
          <span className="text-[9px] text-slate-500">arrastra para mover</span>
        </div>

        {top ? (
          <div className="flex items-center gap-2 px-2 py-1.5">
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
          <p className="px-2 py-1.5 text-[11px] text-slate-500">Esperando recomendación…</p>
        )}

        {alert !== undefined && alert.kind === 'spike' && (
          <p className="alert-in border-t border-slate-800 px-2 py-1 text-[11px] text-amber-300">
            ⚠ {alert.text}
          </p>
        )}
      </div>
    </div>
  )
}

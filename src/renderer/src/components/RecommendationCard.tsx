import { useEffect, useRef, useState } from 'react'
import type { Recommendation } from '@shared/recommendation'
import type { RecommendationsPayload } from '@shared/ipc'

const ACTION_LABEL: Record<Recommendation['action'], string> = {
  prioritize: 'COMPRA YA',
  add: 'PRÓXIMA COMPRA',
  delay: 'ESPERA',
  replace: 'VENDE Y CAMBIA'
}

const ACTION_STYLE: Record<Recommendation['action'], string> = {
  prioritize: 'bg-emerald-600/20 text-emerald-300 border-emerald-700',
  add: 'bg-indigo-600/20 text-indigo-300 border-indigo-700',
  delay: 'bg-amber-600/20 text-amber-300 border-amber-700',
  replace: 'bg-rose-600/20 text-rose-300 border-rose-700'
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
}

interface HistoryEntry {
  gameTimeS: number
  title: string
  action: Recommendation['action']
}

export default function RecommendationCard(props: {
  payload: RecommendationsPayload | null
  currentGold: number
}): React.JSX.Element | null {
  const { payload } = props
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [pulse, setPulse] = useState(false)
  const lastTopRef = useRef<string>('')

  useEffect(() => {
    const top = payload?.recommendations[0]
    if (!payload || !top) return
    const key = `${String(top.itemId ?? top.category)}:${top.action}`
    if (key !== lastTopRef.current) {
      const isFirst = lastTopRef.current === ''
      lastTopRef.current = key
      if (!isFirst) {
        setPulse(true)
        setTimeout(() => setPulse(false), 1000)
      }
      setHistory((entries) => [
        { gameTimeS: payload.gameTimeS, title: top.itemName ?? top.category ?? '?', action: top.action },
        ...entries.slice(0, 29)
      ])
    }
  }, [payload])

  if (!payload || payload.recommendations.length === 0) return null
  const [top, ...rest] = payload.recommendations

  if (!top) return null

  return (
    // Outer wrapper owns the pulse shadow (the hex clip would cut it off).
    <div className={`card-in rounded-lg ${pulse ? 'gold-pulse' : ''}`}>
      <section className="hex-card energy-border bg-slate-900 p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-400/90">
          ◆ Recomendación
        </h3>
        <button
          className="text-[11px] text-slate-500 hover:text-slate-300"
          onClick={() => setShowHistory((visible) => !visible)}
        >
          {showHistory ? 'ocultar historial' : `historial (${String(history.length)})`}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_minmax(0,1fr)_220px]">
        <div className="flex flex-col items-center gap-1.5">
          {top.itemId !== null && (
            <img
              src={`ddicon://item/${String(top.itemId)}.png`}
              alt={top.itemName ?? ''}
              className="h-16 w-16 rounded border border-amber-400/50 shadow-[0_0_14px_rgba(200,170,110,0.3)]"
            />
          )}
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${ACTION_STYLE[top.action]}`}
          >
            {ACTION_LABEL[top.action]}
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-xl leading-tight font-semibold text-slate-100">
              {top.itemName ?? top.category}
            </p>
            <span
              className="text-[11px] text-slate-500"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              puntuación {top.score}
            </span>
          </div>
          <ul className="mt-1.5 space-y-1">
            {top.reasons.slice(0, 3).map((reason, index) => (
              <li
                key={index}
                className={`text-xs leading-snug ${
                  reason.includes('Master+') ? 'text-amber-300/90' : 'text-slate-300'
                }`}
              >
                · {reason}
              </li>
            ))}
          </ul>
        </div>

        {rest.length > 0 && (
          <div className="flex flex-col gap-1.5 md:border-l md:border-slate-800 md:pl-4">
            <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
              Alternativas
            </p>
            {rest.slice(0, 3).map((rec, index) => (
              <div key={index} className="flex items-center gap-2">
                {rec.itemId !== null && (
                  <img
                    src={`ddicon://item/${String(rec.itemId)}.png`}
                    alt=""
                    className="h-7 w-7 rounded-sm border border-slate-700"
                  />
                )}
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
                  {rec.itemName ?? rec.category}
                </span>
                <span
                  className="text-[11px] text-slate-500"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {rec.score}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showHistory && history.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto border-t border-slate-800 pt-2">
          {history.map((entry, index) => (
            <li key={index} className="flex justify-between font-mono text-[11px] text-slate-400">
              <span>
                {formatClock(entry.gameTimeS)} — {entry.title}
              </span>
              <span>{ACTION_LABEL[entry.action]}</span>
            </li>
          ))}
        </ul>
      )}
      </section>
    </div>
  )
}

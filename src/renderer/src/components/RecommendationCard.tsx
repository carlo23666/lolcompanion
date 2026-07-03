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
    <section
      className={`card-in rounded-lg border bg-slate-900 p-3 ${pulse ? 'gold-pulse border-amber-400' : 'border-slate-800'}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Recomendación
        </h3>
        <button
          className="text-[11px] text-slate-500 hover:text-slate-300"
          onClick={() => setShowHistory((visible) => !visible)}
        >
          {showHistory ? 'ocultar historial' : `historial (${String(history.length)})`}
        </button>
      </div>

      <div className="flex items-start gap-3">
        {top.itemId !== null && (
          <img
            src={`ddicon://item/${String(top.itemId)}.png`}
            alt={top.itemName ?? ''}
            className="h-12 w-12 rounded border border-slate-700"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-100">{top.itemName ?? top.category}</p>
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${ACTION_STYLE[top.action]}`}
            >
              {ACTION_LABEL[top.action]}
            </span>
            <span className="text-[11px] text-slate-500">puntuación {top.score}</span>
          </div>
          <ul className="mt-1 space-y-0.5">
            {top.reasons.slice(0, 3).map((reason, index) => (
              <li key={index} className="text-xs text-slate-300">
                · {reason}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {rest.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-800 pt-2">
          {rest.slice(0, 3).map((rec, index) => (
            <span
              key={index}
              title={rec.reasons.join('\n')}
              className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300"
            >
              {rec.itemId !== null && (
                <img
                  src={`ddicon://item/${String(rec.itemId)}.png`}
                  alt=""
                  className="h-4 w-4 rounded-sm"
                />
              )}
              {rec.itemName ?? rec.category} · {rec.score}
            </span>
          ))}
        </div>
      )}

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
  )
}

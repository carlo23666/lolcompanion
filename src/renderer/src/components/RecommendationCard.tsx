import { useEffect, useRef, useState } from 'react'
import type { Recommendation } from '@shared/recommendation'
import type { RecommendationsPayload } from '@shared/ipc'
import type { MessageKey } from '@shared/i18n'
import { useT } from '../i18n'

const ACTION_LABEL_KEYS: Record<Recommendation['action'], MessageKey> = {
  prioritize: 'rec.action.prioritize',
  add: 'rec.action.add',
  delay: 'rec.action.delay',
  replace: 'rec.action.replace'
}

const ACTION_STYLE: Record<Recommendation['action'], string> = {
  prioritize: 'decision-positive',
  add: 'decision-route',
  delay: 'decision-threshold',
  replace: 'decision-tradeoff'
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

function RouteStrip(props: { recommendation: Recommendation }): React.JSX.Element | null {
  const plan = props.recommendation.plan
  const t = useT()
  if (plan === undefined || plan.steps.length === 0) return null
  return (
    <div className="route-strip rounded-xl px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
          {t('rec.route')}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span>{t('rec.confidence', { value: String(Math.round(plan.confidence * 100)) })}</span>
          {plan.protectedCoreRemaining > 0 && (
            <span className="core-lock rounded-full px-2 py-0.5 text-amber-200">
              {t('rec.coreLock', { count: String(plan.protectedCoreRemaining) })}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center">
        {plan.steps.map((step, index) => {
          const current = index === plan.currentStep
          const label = step.owned
            ? t('rec.stepOwned', { item: step.itemName })
            : current
              ? t('rec.stepCurrent', { item: step.itemName })
              : t('rec.stepLater', { item: step.itemName })
          return (
            <div
              key={`${String(step.itemId)}-${String(index)}`}
              className="flex min-w-0 flex-1 items-center"
            >
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1" title={label}>
                <div
                  className={`route-node relative rounded-lg p-0.5 ${step.owned ? 'route-node-owned' : current ? 'route-node-current' : ''}`}
                >
                  <img
                    src={`ddicon://item/${String(step.itemId)}.png`}
                    alt={step.itemName}
                    className={`h-8 w-8 rounded-md ${step.owned ? '' : current ? '' : 'opacity-45 grayscale-[35%]'}`}
                  />
                  {step.owned && (
                    <span className="absolute -right-1 -bottom-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 text-[8px] font-bold text-slate-950">
                      <span aria-hidden>✓</span>
                    </span>
                  )}
                </div>
                <span
                  className={`max-w-20 truncate text-[9px] ${current ? 'text-slate-200' : 'text-slate-600'}`}
                >
                  {step.itemName}
                </span>
              </div>
              {index < plan.steps.length - 1 && (
                <span className="route-connector mx-1 h-px w-4 shrink-0" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ContextOption(props: {
  recommendation: Recommendation
  index: number
}): React.JSX.Element {
  const t = useT()
  const rec = props.recommendation
  return (
    <article className="context-option flex items-center gap-2.5 rounded-xl p-2.5">
      <span className="text-[9px] font-bold text-slate-600">0{props.index + 1}</span>
      {rec.itemId !== null && (
        <img
          src={`ddicon://item/${String(rec.itemId)}.png`}
          alt=""
          className="h-9 w-9 rounded-lg border border-slate-700/70"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-semibold text-slate-200">
            {rec.itemName ?? rec.category}
          </p>
          <span className="text-[9px] text-slate-600">{rec.score}</span>
        </div>
        <p className="truncate text-[10px] text-slate-500">{rec.reasons[0]}</p>
      </div>
      <span className={`decision-chip ${ACTION_STYLE[rec.action]}`}>
        {t(ACTION_LABEL_KEYS[rec.action])}
      </span>
    </article>
  )
}

export default function RecommendationCard(props: {
  payload: RecommendationsPayload | null
  currentGold: number
}): React.JSX.Element | null {
  const { payload } = props
  const t = useT()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [pulse, setPulse] = useState(false)
  const lastTopRef = useRef('')

  useEffect(() => {
    const top = payload?.recommendations[0]
    if (payload === null || payload === undefined || top === undefined) return
    const key = `${String(top.itemId ?? top.category)}:${top.action}`
    if (key === lastTopRef.current) return
    const isFirst = lastTopRef.current === ''
    lastTopRef.current = key
    let timer: ReturnType<typeof setTimeout> | undefined
    if (!isFirst) {
      setPulse(true)
      timer = setTimeout(() => setPulse(false), 900)
    }
    setHistory((entries) => [
      {
        gameTimeS: payload.gameTimeS,
        title: top.itemName ?? top.category ?? '?',
        action: top.action
      },
      ...entries.slice(0, 29)
    ])
    return () => {
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [payload])

  if (payload === null || payload.recommendations.length === 0) return null
  const [top, ...rest] = payload.recommendations
  if (top === undefined) return null

  return (
    <section className={`decision-board card-in rounded-2xl p-4 ${pulse ? 'gold-pulse' : ''}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="signal-kicker" aria-hidden />
          <h2 className="text-[11px] font-semibold tracking-[0.18em] text-amber-200 uppercase">
            {t('live.recommendation')}
          </h2>
        </div>
        <button
          type="button"
          className="text-[10px] text-slate-600 transition-colors hover:text-slate-300"
          onClick={() => setShowHistory((visible) => !visible)}
        >
          {showHistory ? t('rec.hideHistory') : t('rec.showHistory', { n: String(history.length) })}
        </button>
      </div>

      <RouteStrip recommendation={top} />

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.72fr)]">
        <div className="primary-option relative overflow-hidden rounded-2xl p-4">
          {top.itemId !== null && (
            <img
              src={`ddicon://item/${String(top.itemId)}.png`}
              alt=""
              aria-hidden
              className="pointer-events-none absolute -top-10 -right-8 h-40 w-40 rotate-12 opacity-[0.055] blur-[1px]"
            />
          )}
          <div className="relative flex items-start gap-4">
            {top.itemId !== null && (
              <img
                src={`ddicon://item/${String(top.itemId)}.png`}
                alt={top.itemName ?? ''}
                className="h-[72px] w-[72px] rounded-xl border border-amber-300/35 shadow-[0_12px_35px_-15px_rgba(246,199,92,0.7)]"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-2xl leading-tight font-semibold text-slate-50">
                    {top.itemName ?? top.category}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-600">
                    {t('live.score', { score: String(top.score) })} ·{' '}
                    {t('rec.currentGold', { value: String(Math.round(props.currentGold)) })}
                  </p>
                </div>
                <span className={`decision-chip ${ACTION_STYLE[top.action]}`}>
                  {t(ACTION_LABEL_KEYS[top.action])}
                </span>
              </div>
              <p className="mt-3 text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                {t('rec.evidence')}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {top.reasons.slice(0, 3).map((reason, index) => (
                  <li key={index} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-fuchsia-400/80" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <p className="px-1 text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
            {t('live.alternatives')}
          </p>
          {rest.length > 0 ? (
            rest
              .slice(0, 3)
              .map((rec, index) => (
                <ContextOption
                  key={`${String(rec.itemId ?? rec.category)}-${String(index)}`}
                  recommendation={rec}
                  index={index}
                />
              ))
          ) : (
            <div className="context-option rounded-xl px-3 py-4 text-xs text-slate-600">—</div>
          )}
        </div>
      </div>

      {showHistory && history.length > 0 && (
        <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto border-t border-slate-800/70 pt-3">
          {history.map((entry, index) => (
            <li key={index} className="flex justify-between text-[10px] text-slate-500">
              <span>
                {formatClock(entry.gameTimeS)} · {entry.title}
              </span>
              <span>{t(ACTION_LABEL_KEYS[entry.action])}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

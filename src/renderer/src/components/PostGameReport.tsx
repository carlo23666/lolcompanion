import { useEffect, useRef, useState } from 'react'
import type { PostGameReport as Report, PostGameReportResult } from '@shared/report'
import { HexiSprite } from './Mascot'

/**
 * Optional local-AI commentary (Ollama). Renders nothing unless the coach is
 * enabled in Ajustes AND Ollama answers on localhost. Runs by itself once per
 * report — no clicks needed (owner request 2026-07-06).
 */
function CoachSection(props: { report: Report }): React.JSX.Element | null {
  const [ready, setReady] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [advice, setAdvice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const analyzedMatchRef = useRef('')

  useEffect(() => {
    setAdvice(null)
    setError(null)
    void window.api
      .invoke('coach:status')
      .then((status) => setReady(status.enabled && status.available), () => undefined)
  }, [props.report.matchId])

  // Auto-analyze once per match as soon as the coach is confirmed ready.
  useEffect(() => {
    if (!ready || analyzedMatchRef.current === props.report.matchId) return
    analyzedMatchRef.current = props.report.matchId
    setThinking(true)
    setError(null)
    void window.api.invoke('coach:analyze', props.report).then((result) => {
      setThinking(false)
      if (result.ok && result.text !== undefined) setAdvice(result.text)
      else setError(result.error ?? 'error desconocido')
    })
  }, [ready, props.report])

  if (!ready) return null

  return (
    <div className="mt-3 rounded border border-indigo-800/60 bg-slate-950/50 p-2.5">
      <div className="flex items-start gap-2">
        <HexiSprite mood={thinking ? 'focused' : 'idle'} className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-indigo-300 uppercase">
            Análisis de Hexi (IA local)
          </p>
          {advice !== null ? (
            <p className="text-xs leading-relaxed whitespace-pre-wrap text-slate-300">{advice}</p>
          ) : (
            <p className="text-xs text-slate-500">
              {thinking
                ? 'Hexi está pensando… (modelo local, dale unos segundos)'
                : 'Preparando análisis…'}
            </p>
          )}
          {error !== null && <p className="mt-1 text-[11px] text-rose-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}

function StatDelta(props: {
  label: string
  value: number
  average: number | null
  decimals?: number
  suffix?: string
  /** Deaths-style metrics: staying under your average is the good outcome. */
  lowerIsBetter?: boolean
}): React.JSX.Element {
  const decimals = props.decimals ?? 1
  const better =
    props.average !== null &&
    (props.lowerIsBetter === true
      ? props.value <= props.average
      : props.value >= props.average)
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-slate-100">
        {props.value.toFixed(decimals)}
        {props.suffix ?? ''}
      </p>
      <p className="text-[11px] text-slate-500">{props.label}</p>
      {props.average !== null && (
        <p className={`text-[11px] font-mono ${better ? 'text-emerald-400' : 'text-rose-400'}`}>
          {better ? '▲' : '▼'} media {props.average.toFixed(decimals)}
          {props.suffix ?? ''}
        </p>
      )}
    </div>
  )
}

const UNSUPPORTED_MODE_LABEL: Record<string, string> = {
  PRACTICETOOL: 'Herramienta de práctica'
}

/**
 * Post-game report: the finished match vs personal averages + which engine
 * recommendations were followed. Refreshes when auto-ingest links the match.
 */
export default function PostGameReport(): React.JSX.Element | null {
  const [result, setResult] = useState<PostGameReportResult | null>(null)

  useEffect(() => {
    const load = (): void => {
      void window.api.invoke('report:last').then(setResult)
    }
    load()
    return window.api.on('history:changed', load)
  }, [])

  if (result === null) {
    return (
      <p className="card-in text-center text-xs text-slate-500">
        El informe aparecerá en cuanto Riot publique la partida (1-3 min)…
      </p>
    )
  }

  if (result.kind === 'unsupported') {
    return (
      <p className="card-in max-w-sm text-center text-xs text-slate-500">
        Las partidas de {UNSUPPORTED_MODE_LABEL[result.gameMode] ?? 'este modo'} no aparecen en
        el historial de Riot, así que no hay informe para esta partida.
      </p>
    )
  }

  return <ReportCard report={result.report} />
}

/** Presentational report card, reused by Historial → Ver informe. */
export function ReportCard(props: { report: Report }): React.JSX.Element {
  const report = props.report
  const followed = report.recommendedItems.filter((item) => item.followed)

  return (
    <section className="card-in mx-auto w-full max-w-lg rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center gap-3">
        <img
          src={`ddicon://champion/${report.champion}.png`}
          alt={report.champion}
          className="h-10 w-10 rounded"
        />
        <div>
          <p className="text-sm font-bold text-slate-100">
            {report.champion} ·{' '}
            <span className={report.win ? 'text-emerald-400' : 'text-rose-400'}>
              {report.win ? 'Victoria' : 'Derrota'}
            </span>
          </p>
          <p className="font-mono text-xs text-slate-400">
            {report.kills}/{report.deaths}/{report.assists} ·{' '}
            {Math.floor(report.durationS / 60)} min
          </p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-5 gap-2 rounded border border-slate-800 bg-slate-950/50 py-2">
        <StatDelta label="CS/min" value={report.csPerMin} average={report.avgCsPerMin} />
        <StatDelta
          label="Oro/min"
          value={report.goldPerMin}
          average={report.avgGoldPerMin}
          decimals={0}
        />
        <StatDelta
          label="% daño"
          value={report.damageSharePct}
          average={report.avgDamageSharePct}
          decimals={0}
          suffix="%"
        />
        <StatDelta
          label="Muertes"
          value={report.deaths}
          average={report.avgDeaths}
          decimals={0}
          lowerIsBetter
        />
        <StatDelta
          label="Visión"
          value={report.visionScore}
          average={report.avgVisionScore}
          decimals={0}
        />
      </div>

      {report.summary.length > 0 && (
        <ul className="mb-3 space-y-1 rounded border border-slate-800 bg-slate-950/50 p-2">
          {report.summary.map((line, index) => (
            <li key={index} className="text-xs text-slate-300">
              · {line}
            </li>
          ))}
        </ul>
      )}

      {report.recommendedItems.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-400">
            Recomendaciones del motor ({followed.length}/{report.recommendedItems.length}{' '}
            seguidas)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {report.recommendedItems.map((item) => (
              <span
                key={item.itemId}
                className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] ${
                  item.followed
                    ? 'border-emerald-800 bg-emerald-600/10 text-emerald-300'
                    : 'border-slate-700 bg-slate-800/60 text-slate-400'
                }`}
              >
                <img
                  src={`ddicon://item/${String(item.itemId)}.png`}
                  alt=""
                  className="h-4 w-4 rounded-sm"
                />
                {item.itemName ?? item.itemId} {item.followed ? '✓' : '·'}
              </span>
            ))}
          </div>
        </div>
      )}

      <CoachSection report={report} />
    </section>
  )
}

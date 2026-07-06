import { useCallback, useEffect, useState } from 'react'
import type { HistoryAggregate, HistoryDetail, HistoryRow } from '@shared/history'
import type { PostGameReportResult } from '@shared/report'
import { ReportCard } from './PostGameReport'
import StatsView from './StatsView'

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function GoldSparkline(props: { curve: number[] }): React.JSX.Element | null {
  const { curve } = props
  if (curve.length < 2) return null
  const width = 260
  const height = 48
  const max = Math.max(...curve)
  const points = curve
    .map((gold, index) => {
      const x = (index / (curve.length - 1)) * width
      const y = height - (gold / max) * (height - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Curva de oro por minuto"
      className="mt-1"
    >
      <polyline points={points} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
    </svg>
  )
}

function DetailDrawer(props: { detail: HistoryDetail }): React.JSX.Element {
  const { detail } = props
  const [report, setReport] = useState<PostGameReportResult | null>(null)
  const [reportRequested, setReportRequested] = useState(false)

  const loadReport = async (): Promise<void> => {
    setReportRequested(true)
    setReport(await window.api.invoke('report:forMatch', detail.matchId))
  }

  return (
    <div className="border-t border-slate-800 bg-slate-950/60 px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <p className="mb-1 text-slate-400">Build final</p>
          <div className="flex gap-1">
            {detail.items.map((itemId, index) => (
              <img
                key={`${String(itemId)}-${String(index)}`}
                src={`ddicon://item/${String(itemId)}.png`}
                alt={`objeto ${String(itemId)}`}
                className="h-7 w-7 rounded border border-slate-700"
              />
            ))}
          </div>
        </div>
        <div className="font-mono text-slate-300">
          <p>
            {detail.kills}/{detail.deaths}/{detail.assists} · {detail.cs} CS ·{' '}
            {Math.round(detail.gold / 100) / 10}k oro
          </p>
          <p className="text-slate-500">
            {Math.round(detail.damage / 100) / 10}k daño · visión {detail.vision}
          </p>
        </div>
        {!reportRequested && (
          <button
            className="ml-auto rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 hover:border-slate-500"
            onClick={() => void loadReport()}
          >
            Ver informe
          </button>
        )}
      </div>
      {detail.goldCurve.length > 1 && (
        <div className="mt-2">
          <p className="text-slate-400">Oro por minuto</p>
          <GoldSparkline curve={detail.goldCurve} />
        </div>
      )}
      {reportRequested && (
        <div className="mt-3">
          {report?.kind === 'report' ? (
            <ReportCard report={report.report} />
          ) : (
            <p className="text-slate-500">No hay informe disponible para esta partida.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function HistoryView(): React.JSX.Element {
  const [tab, setTab] = useState<'partidas' | 'stats'>('partidas')
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [aggregates, setAggregates] = useState<HistoryAggregate[]>([])
  const [champions, setChampions] = useState<string[]>([])
  const [filter, setFilter] = useState<string>('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<HistoryDetail | null>(null)

  const refresh = useCallback(async (champion: string): Promise<void> => {
    const [list, aggs, champs] = await Promise.all([
      window.api.invoke('history:list', champion === '' ? {} : { champion }),
      window.api.invoke('history:aggregates'),
      window.api.invoke('history:champions')
    ])
    setRows(list)
    setAggregates(aggs)
    setChampions(champs)
  }, [])

  useEffect(() => {
    void refresh(filter)
    return window.api.on('history:changed', () => void refresh(filter))
  }, [filter, refresh])

  const toggleDetail = async (matchId: string): Promise<void> => {
    if (expanded === matchId) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(matchId)
    setDetail(await window.api.invoke('history:detail', matchId))
  }

  return (
    <div className="flex min-h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">Historial</h1>
          <div className="flex rounded border border-slate-700 text-xs" role="tablist">
            {(['partidas', 'stats'] as const).map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`px-2.5 py-1 ${tab === id ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => setTab(id)}
              >
                {id === 'partidas' ? 'Partidas' : 'Estadísticas'}
              </button>
            ))}
          </div>
        </div>
        {tab === 'partidas' && (
          <select
            aria-label="Filtrar por campeón"
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="">Todos los campeones</option>
            {champions.map((champion) => (
              <option key={champion} value={champion}>
                {champion}
              </option>
            ))}
          </select>
        )}
      </div>

      {tab === 'stats' && <StatsView />}
      {tab === 'partidas' && (
        <>

      {aggregates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {aggregates.slice(0, 6).map((aggregate) => (
            <span
              key={aggregate.champion}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300"
            >
              {aggregate.champion} · {aggregate.games}p ·{' '}
              <span
                className={aggregate.winratePct >= 50 ? 'text-emerald-400' : 'text-rose-400'}
              >
                {Math.round(aggregate.winratePct)}% WR
              </span>{' '}
              · {aggregate.csPerMin.toFixed(1)} CS/min
            </span>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <span className="text-4xl" aria-hidden>
            📜
          </span>
          <p className="text-sm font-medium text-slate-300">Sin partidas guardadas</p>
          <p className="max-w-xs text-xs text-slate-500">
            Sincroniza tu historial en Ajustes o termina una partida: aparecerá aquí sola.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-800 overflow-y-auto rounded-lg border border-slate-800">
          {rows.map((row) => (
            <li key={row.matchId}>
              <button
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-slate-900"
                onClick={() => void toggleDetail(row.matchId)}
              >
                <span
                  className={`w-1 self-stretch rounded ${row.win ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  aria-hidden
                />
                <img
                  src={`ddicon://champion/${row.champion}.png`}
                  alt={row.champion}
                  className="h-8 w-8 rounded"
                />
                <span className="w-24 truncate font-medium">{row.champion}</span>
                <span className="w-20 font-mono text-slate-300">
                  {row.kills}/{row.deaths}/{row.assists}
                </span>
                <span className="w-24 font-mono text-slate-400">
                  {row.csPerMin.toFixed(1)} CS/min
                </span>
                <span className={`w-16 text-xs ${row.win ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {row.win ? 'Victoria' : 'Derrota'}
                </span>
                <span className="w-14 font-mono text-xs text-slate-500">
                  {formatDuration(row.durationS)}
                </span>
                <span className="w-14 text-xs text-slate-500">{row.patch}</span>
                <span className="ml-auto text-xs text-slate-600">
                  {formatDate(row.gameCreation)}
                </span>
              </button>
              {expanded === row.matchId && detail !== null && detail.matchId === row.matchId && (
                <DetailDrawer detail={detail} />
              )}
            </li>
          ))}
        </ul>
      )}
        </>
      )}
    </div>
  )
}

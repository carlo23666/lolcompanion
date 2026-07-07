import { useCallback, useEffect, useMemo, useState } from 'react'
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

const ROLE_LABEL: Record<string, string> = {
  TOP: 'TOP',
  JUNGLE: 'JG',
  MIDDLE: 'MID',
  BOTTOM: 'ADC',
  UTILITY: 'SUP'
}

type ResultFilter = 'todas' | 'victoria' | 'derrota'
type SortKey = 'fecha' | 'kda' | 'cs' | 'duracion'

const SORTERS: Record<SortKey, (a: HistoryRow, b: HistoryRow) => number> = {
  fecha: (a, b) => b.gameCreation - a.gameCreation,
  kda: (a, b) => kdaOf(b) - kdaOf(a),
  cs: (a, b) => b.csPerMin - a.csPerMin,
  duracion: (a, b) => b.durationS - a.durationS
}

function kdaOf(row: HistoryRow): number {
  return (row.kills + row.assists) / Math.max(1, row.deaths)
}

/** Aggregates over the CURRENT filtered set — the filters become a question
 * ("¿cómo voy con X en este parche?") and this strip is the answer. */
function SummaryStrip(props: { rows: HistoryRow[] }): React.JSX.Element | null {
  const { rows } = props
  if (rows.length === 0) return null
  const wins = rows.filter((row) => row.win).length
  const kills = rows.reduce((sum, row) => sum + row.kills, 0)
  const deaths = rows.reduce((sum, row) => sum + row.deaths, 0)
  const assists = rows.reduce((sum, row) => sum + row.assists, 0)
  const cs = rows.reduce((sum, row) => sum + row.csPerMin, 0) / rows.length
  const wr = Math.round((wins / rows.length) * 100)
  // Newest first regardless of the active sort.
  const recent = [...rows].sort((a, b) => b.gameCreation - a.gameCreation).slice(0, 10)

  const cell = (label: string, value: React.ReactNode): React.JSX.Element => (
    <div className="flex flex-col px-4 first:pl-0">
      <span className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
        {label}
      </span>
      <span
        className="font-display text-lg leading-tight font-semibold text-slate-100"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </span>
    </div>
  )

  return (
    <div className="card-in flex flex-wrap items-center rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5">
      <div className="flex divide-x divide-slate-800">
        {cell('Partidas', rows.length)}
        {cell(
          'Winrate',
          <span className={wr >= 50 ? 'text-emerald-400' : 'text-rose-400'}>{wr}%</span>
        )}
        {cell('KDA', ((kills + assists) / Math.max(1, deaths)).toFixed(2))}
        {cell('CS/min', cs.toFixed(1))}
      </div>
      <div className="ml-auto flex items-center gap-1.5" title="Últimas 10 (izquierda = más reciente)">
        <span className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
          Forma
        </span>
        {recent.map((row) => (
          <span
            key={row.matchId}
            className={`h-2.5 w-2.5 rounded-full ${row.win ? 'bg-emerald-500' : 'bg-rose-500/70'}`}
            title={`${row.champion}: ${row.win ? 'victoria' : 'derrota'}`}
          />
        ))}
      </div>
    </div>
  )
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

function FilterSelect(props: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <select
      aria-label={props.label}
      className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    >
      {props.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export default function HistoryView(): React.JSX.Element {
  const [tab, setTab] = useState<'partidas' | 'stats'>('partidas')
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [aggregates, setAggregates] = useState<HistoryAggregate[]>([])
  const [champions, setChampions] = useState<string[]>([])
  const [filter, setFilter] = useState<string>('')
  const [result, setResult] = useState<ResultFilter>('todas')
  const [role, setRole] = useState<string>('')
  const [patch, setPatch] = useState<string>('')
  const [sort, setSort] = useState<SortKey>('fecha')
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

  // Result/role/patch/sort work over the champion-filtered list, in memory —
  // the answer updates instantly, no round trips.
  const patches = useMemo(
    () => [...new Set(rows.map((row) => row.patch))].sort().reverse(),
    [rows]
  )
  const visible = useMemo(() => {
    const filtered = rows.filter(
      (row) =>
        (result === 'todas' || row.win === (result === 'victoria')) &&
        (role === '' || row.role === role) &&
        (patch === '' || row.patch === patch)
    )
    return filtered.sort(SORTERS[sort])
  }, [rows, result, role, patch, sort])

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
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-3 p-4">
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
      </div>

      {tab === 'stats' && <StatsView />}
      {tab === 'partidas' && (
        <>
          {/* The question bar: champion · result · role · patch · order. */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtrar por campeón"
              className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
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
            <FilterSelect
              label="Filtrar por resultado"
              value={result}
              onChange={(value) => setResult(value as ResultFilter)}
              options={[
                { value: 'todas', label: 'Todas' },
                { value: 'victoria', label: 'Victorias' },
                { value: 'derrota', label: 'Derrotas' }
              ]}
            />
            <FilterSelect
              label="Filtrar por rol"
              value={role}
              onChange={setRole}
              options={[
                { value: '', label: 'Todos los roles' },
                ...Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))
              ]}
            />
            <FilterSelect
              label="Filtrar por parche"
              value={patch}
              onChange={setPatch}
              options={[
                { value: '', label: 'Todos los parches' },
                ...patches.map((value) => ({ value, label: `parche ${value}` }))
              ]}
            />
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[10px] tracking-widest text-slate-500 uppercase">Ordenar</span>
              <FilterSelect
                label="Ordenar partidas"
                value={sort}
                onChange={(value) => setSort(value as SortKey)}
                options={[
                  { value: 'fecha', label: 'Fecha' },
                  { value: 'kda', label: 'KDA' },
                  { value: 'cs', label: 'CS/min' },
                  { value: 'duracion', label: 'Duración' }
                ]}
              />
            </div>
          </div>

          <SummaryStrip rows={visible} />

          {aggregates.length > 0 && filter === '' && (
            <div className="flex flex-wrap gap-2">
              {aggregates.slice(0, 6).map((aggregate) => (
                <button
                  key={aggregate.champion}
                  className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300 hover:border-indigo-500/60"
                  onClick={() => setFilter(aggregate.champion)}
                  title={`Filtrar por ${aggregate.champion}`}
                >
                  {aggregate.champion} · {aggregate.games}p ·{' '}
                  <span
                    className={aggregate.winratePct >= 50 ? 'text-emerald-400' : 'text-rose-400'}
                  >
                    {Math.round(aggregate.winratePct)}% WR
                  </span>{' '}
                  · {aggregate.csPerMin.toFixed(1)} CS/min
                </button>
              ))}
            </div>
          )}

          {visible.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <span className="text-4xl" aria-hidden>
                📜
              </span>
              <p className="text-sm font-medium text-slate-300">
                {rows.length === 0 ? 'Sin partidas guardadas' : 'Ninguna partida cumple el filtro'}
              </p>
              <p className="max-w-xs text-xs text-slate-500">
                {rows.length === 0
                  ? 'Sincroniza tu historial en Ajustes o termina una partida: aparecerá aquí sola.'
                  : 'Relaja algún filtro para volver a ver partidas.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-800 overflow-y-auto rounded-lg border border-slate-800">
              {visible.map((row) => (
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
                    <span className="w-9 text-[10px] font-semibold text-slate-500">
                      {ROLE_LABEL[row.role] ?? ''}
                    </span>
                    <span className="w-20 font-mono text-slate-300">
                      {row.kills}/{row.deaths}/{row.assists}
                    </span>
                    <span className="w-24 font-mono text-slate-400">
                      {row.csPerMin.toFixed(1)} CS/min
                    </span>
                    <span
                      className={`w-16 text-xs ${row.win ? 'text-emerald-400' : 'text-rose-400'}`}
                    >
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
                  {expanded === row.matchId &&
                    detail !== null &&
                    detail.matchId === row.matchId && <DetailDrawer detail={detail} />}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

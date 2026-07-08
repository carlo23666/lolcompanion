import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HistoryAggregate, HistoryDetail, HistoryRow } from '@shared/history'
import type { PostGameReportResult } from '@shared/report'
import type { Translator } from '@shared/i18n'
import { intlLocale, useLocale, useT } from '../i18n'
import { ReportCard } from './PostGameReport'
import StatsView from './StatsView'

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
}

function formatDate(epochMs: number, locale: string): string {
  return new Date(epochMs).toLocaleDateString(locale, { day: '2-digit', month: 'short' })
}

const ROLE_LABEL: Record<string, string> = {
  TOP: 'TOP',
  JUNGLE: 'JG',
  MIDDLE: 'MID',
  BOTTOM: 'ADC',
  UTILITY: 'SUP'
}

const QUEUE_LABEL: Record<number, string> = {
  420: 'SoloQ',
  440: 'Flex',
  400: 'Normal',
  430: 'Blind',
  450: 'ARAM',
  490: 'Quickplay',
  700: 'Clash'
}

function queueLabel(queueId: number, t: Translator): string {
  return QUEUE_LABEL[queueId] ?? t('hist.queuePrefix', { id: String(queueId) })
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
  const t = useT()
  if (rows.length === 0) return null
  const wins = rows.filter((row) => row.win).length
  const kills = rows.reduce((sum, row) => sum + row.kills, 0)
  const deaths = rows.reduce((sum, row) => sum + row.deaths, 0)
  const assists = rows.reduce((sum, row) => sum + row.assists, 0)
  const cs = rows.reduce((sum, row) => sum + row.csPerMin, 0) / rows.length
  const wr = Math.round((wins / rows.length) * 100)
  // Newest first regardless of the active sort.
  const byDate = [...rows].sort((a, b) => b.gameCreation - a.gameCreation)
  const recent = byDate.slice(0, 10)
  // Current streak within the filtered set (＋wins / −losses from the newest).
  let streak = 0
  for (const row of byDate) {
    if (row.win !== byDate[0]?.win) break
    streak += 1
  }
  const streakSigned = (byDate[0]?.win ?? true) ? streak : -streak

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
        {cell(t('hist.summary.games'), rows.length)}
        {cell(
          t('hist.summary.winrate'),
          <span className={wr >= 50 ? 'text-emerald-400' : 'text-rose-400'}>{wr}%</span>
        )}
        {cell(t('hist.summary.kda'), ((kills + assists) / Math.max(1, deaths)).toFixed(2))}
        {cell(t('hist.summary.cs'), cs.toFixed(1))}
        {cell(
          t('hist.summary.streak'),
          <span className={streakSigned > 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {streakSigned > 0 ? `+${String(streakSigned)}` : String(streakSigned)}
          </span>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1.5" title={t('hist.summary.formTitle')}>
        <span className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
          {t('hist.summary.form')}
        </span>
        {recent.map((row) => (
          <span
            key={row.matchId}
            className={`h-2.5 w-2.5 rounded-full ${row.win ? 'bg-emerald-500' : 'bg-rose-500/70'}`}
            title={`${row.champion}: ${row.win ? t('hist.winLower') : t('hist.lossLower')}`}
          />
        ))}
      </div>
    </div>
  )
}

function GoldSparkline(props: { curve: number[] }): React.JSX.Element | null {
  const { curve } = props
  const t = useT()
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
      aria-label={t('hist.goldCurveLabel')}
      className="mt-1"
    >
      <polyline points={points} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
    </svg>
  )
}

function DetailDrawer(props: { detail: HistoryDetail }): React.JSX.Element {
  const { detail } = props
  const t = useT()
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
          <p className="mb-1 text-slate-400">{t('hist.finalBuild')}</p>
          <div className="flex gap-1">
            {detail.items.map((itemId, index) => (
              <img
                key={`${String(itemId)}-${String(index)}`}
                src={`ddicon://item/${String(itemId)}.png`}
                alt={t('hist.itemAlt', { id: String(itemId) })}
                className="h-7 w-7 rounded border border-slate-700"
              />
            ))}
          </div>
        </div>
        <div className="font-mono text-slate-300">
          <p>
            {detail.kills}/{detail.deaths}/{detail.assists} · {detail.cs} CS ·{' '}
            {t('hist.detailGold', { gold: String(Math.round(detail.gold / 100) / 10) })}
            {detail.durationS > 0 && (
              <span className="text-slate-500">
                {' '}
                {t('hist.perMin', {
                  value: String(Math.round(detail.gold / (detail.durationS / 60)))
                })}
              </span>
            )}
          </p>
          <p className="text-slate-500">
            {t('hist.damageVision', {
              dmg: String(Math.round(detail.damage / 100) / 10),
              vision: String(detail.vision)
            })}
          </p>
        </div>
        {detail.laneOpponent !== null && (
          <div className="flex items-center gap-1.5">
            <p className="text-slate-400">{t('hist.laneOpponent')}</p>
            <img
              src={`ddicon://champion/${detail.laneOpponent}.png`}
              alt={detail.laneOpponent}
              title={detail.laneOpponent}
              className="h-7 w-7 rounded border border-rose-500/40"
            />
            <span className="text-slate-300">{detail.laneOpponent}</span>
          </div>
        )}
        {!reportRequested && (
          <button
            className="ml-auto rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 hover:border-slate-500"
            onClick={() => void loadReport()}
          >
            {t('hist.viewReport')}
          </button>
        )}
      </div>
      {/* Your build against what Master+ actually finished on this
          champion+role — matching items get the emerald ring. */}
      {detail.metaBuild !== null && detail.metaBuild.items.length > 0 && (
        <div className="mt-2.5">
          <p className="mb-1 text-slate-400">
            {t('hist.metaBuild', {
              champion: detail.champion,
              patch: detail.metaBuild.patch,
              games: String(detail.metaBuild.games)
            })}{' '}
            <span className="font-semibold text-slate-200">
              {detail.metaBuild.items.slice(0, 6).filter((entry) => detail.items.includes(entry.itemId)).length}
              /{Math.min(6, detail.metaBuild.items.length)}
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {detail.metaBuild.items.slice(0, 6).map((entry) => {
              const owned = detail.items.includes(entry.itemId)
              const pct = Math.round((entry.games / (detail.metaBuild?.games ?? 1)) * 100)
              return (
                <div key={entry.itemId} className="flex flex-col items-center gap-0.5">
                  <img
                    src={`ddicon://item/${String(entry.itemId)}.png`}
                    alt={t('hist.itemAlt', { id: String(entry.itemId) })}
                    title={`${t('hist.masterPctTitle', { pct: String(pct) })}${owned ? t('hist.alsoYours') : ''}`}
                    className={`h-7 w-7 rounded border ${
                      owned ? 'border-emerald-500 ring-1 ring-emerald-500/60' : 'border-slate-700 opacity-80'
                    }`}
                  />
                  <span
                    className="text-[10px] text-slate-500"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {detail.goldCurve.length > 1 && (
        <div className="mt-2">
          <p className="text-slate-400">{t('hist.goldPerMin')}</p>
          <GoldSparkline curve={detail.goldCurve} />
        </div>
      )}
      {reportRequested && (
        <div className="mt-3">
          {report?.kind === 'report' ? (
            <ReportCard report={report.report} />
          ) : (
            <p className="text-slate-500">{t('hist.noReport')}</p>
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
  const t = useT()
  const locale = useLocale()
  const [tab, setTab] = useState<'partidas' | 'stats'>('partidas')
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [aggregates, setAggregates] = useState<HistoryAggregate[]>([])
  const [champions, setChampions] = useState<string[]>([])
  const [filter, setFilter] = useState<string>('')
  const [result, setResult] = useState<ResultFilter>('todas')
  const [role, setRole] = useState<string>('')
  const [patch, setPatch] = useState<string>('')
  const [queue, setQueue] = useState<string>('')
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
  const queues = useMemo(() => [...new Set(rows.map((row) => row.queueId))].sort(), [rows])
  const visible = useMemo(() => {
    const filtered = rows.filter(
      (row) =>
        (result === 'todas' || row.win === (result === 'victoria')) &&
        (role === '' || row.role === role) &&
        (patch === '' || row.patch === patch) &&
        (queue === '' || String(row.queueId) === queue)
    )
    return filtered.sort(SORTERS[sort])
  }, [rows, result, role, patch, queue, sort])

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
          <h1 className="text-lg font-bold">{t('nav.history')}</h1>
          <div className="flex rounded border border-slate-700 text-xs" role="tablist">
            {(['partidas', 'stats'] as const).map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`px-2.5 py-1 ${tab === id ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => setTab(id)}
              >
                {id === 'partidas' ? t('hist.tab.games') : t('hist.tab.stats')}
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
              aria-label={t('hist.filter.champion')}
              className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="">{t('hist.allChampions')}</option>
              {champions.map((champion) => (
                <option key={champion} value={champion}>
                  {champion}
                </option>
              ))}
            </select>
            <FilterSelect
              label={t('hist.filter.result')}
              value={result}
              onChange={(value) => setResult(value as ResultFilter)}
              options={[
                { value: 'todas', label: t('hist.result.all') },
                { value: 'victoria', label: t('hist.result.wins') },
                { value: 'derrota', label: t('hist.result.losses') }
              ]}
            />
            <FilterSelect
              label={t('hist.filter.role')}
              value={role}
              onChange={setRole}
              options={[
                { value: '', label: t('hist.allRoles') },
                ...Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))
              ]}
            />
            <FilterSelect
              label={t('hist.filter.queue')}
              value={queue}
              onChange={setQueue}
              options={[
                { value: '', label: t('hist.allQueues') },
                ...queues.map((id) => ({ value: String(id), label: queueLabel(id, t) }))
              ]}
            />
            <FilterSelect
              label={t('hist.filter.patch')}
              value={patch}
              onChange={setPatch}
              options={[
                { value: '', label: t('hist.allPatches') },
                ...patches.map((value) => ({ value, label: t('hist.patchLabel', { patch: value }) }))
              ]}
            />
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[10px] tracking-widest text-slate-500 uppercase">
                {t('hist.sort')}
              </span>
              <FilterSelect
                label={t('hist.sortAria')}
                value={sort}
                onChange={(value) => setSort(value as SortKey)}
                options={[
                  { value: 'fecha', label: t('hist.sort.date') },
                  { value: 'kda', label: t('hist.sort.kda') },
                  { value: 'cs', label: t('hist.sort.cs') },
                  { value: 'duracion', label: t('hist.sort.duration') }
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
                  title={t('hist.filterBy', { champion: aggregate.champion })}
                >
                  {aggregate.champion} · {t('hist.aggGames', { n: String(aggregate.games) })} ·{' '}
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
                {rows.length === 0 ? t('hist.empty.none') : t('hist.empty.noMatch')}
              </p>
              <p className="max-w-xs text-xs text-slate-500">
                {rows.length === 0 ? t('hist.empty.noneHint') : t('hist.empty.noMatchHint')}
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
                      {row.win ? t('hist.win') : t('hist.loss')}
                    </span>
                    <span className="w-14 font-mono text-xs text-slate-500">
                      {formatDuration(row.durationS)}
                    </span>
                    <span className="w-14 text-xs text-slate-500">{row.patch}</span>
                    <span className="w-16 text-[10px] text-slate-500">
                      {queueLabel(row.queueId, t)}
                    </span>
                    <span className="ml-auto text-xs text-slate-600">
                      {formatDate(row.gameCreation, intlLocale(locale))}
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

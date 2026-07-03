import { useEffect, useState } from 'react'
import type { SessionPhase } from '@shared/session'
import type { PostGameReportResult } from '@shared/report'
import type { StatsOverview } from '@shared/stats'
import { HexiSprite } from './Mascot'

const HEXI_TIPS = [
  'El dragón aparece en el minuto 5: pide visión del río antes.',
  'Con 2500 de oro sin gastar estás jugando con desventaja — planea la base.',
  'Heridas graves reduce la curación enemiga un 40%: no la compres tarde.',
  'Tu racha de derrotas pesa: después de 2 seguidas, un descanso rinde más que otra cola.',
  'Los picos de nivel 6/11/16 enemigos aparecen en el feed: respétalos.',
  'Farmear 8 CS/min vale más que perseguir kills que no llegan.',
  'Mira tu Historial: los datos de tus propias partidas mandan más que cualquier guía.'
]

const ROTATE_MS = 9000

function TipTicker(): React.JSX.Element {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % HEXI_TIPS.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [])
  return (
    <p key={index} className="alert-in text-xs text-slate-400">
      💡 {HEXI_TIPS[index]}
    </p>
  )
}

function StreakChip(props: { current: number }): React.JSX.Element | null {
  if (props.current === 0) return null
  const winning = props.current > 0
  const count = Math.abs(props.current)
  return (
    <span
      className={`rounded border px-2 py-0.5 text-xs ${
        winning
          ? 'border-emerald-800 bg-emerald-600/10 text-emerald-300'
          : 'border-rose-800 bg-rose-600/10 text-rose-300'
      }`}
    >
      {winning ? '🔥' : '🧊'} racha de {count} {winning ? 'victorias' : 'derrotas'}
    </span>
  )
}

/**
 * Landing view while no game is running (idle/clientOpen): Hexi hero over the
 * most-played champion's splash, personal snapshot from stored history, last
 * game result and rotating tips. All data is the owner's own.
 */
export default function HomeDashboard(props: {
  phase: SessionPhase
  onOpenSettings?: () => void
}): React.JSX.Element {
  const [stats, setStats] = useState<StatsOverview | null>(null)
  const [lastGame, setLastGame] = useState<PostGameReportResult | null>(null)

  useEffect(() => {
    void window.api.invoke('stats:overview').then(setStats, () => undefined)
    void window.api.invoke('report:last').then(setLastGame, () => undefined)
  }, [])

  const topChampions = stats?.champions.slice(0, 3) ?? []
  const hero = topChampions[0]
  const report = lastGame?.kind === 'report' ? lastGame.report : null

  return (
    <div className="card-in flex flex-col gap-3">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
        {hero && (
          <div className="absolute inset-0" aria-hidden>
            <img
              src={`ddicon://splash/${hero.champion}_0.jpg`}
              alt=""
              className="h-full w-full object-cover object-top opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-slate-900/30" />
          </div>
        )}
        <div className="relative flex items-center gap-4 p-5">
          <HexiSprite mood={props.phase === 'clientOpen' ? 'idle' : 'sleepy'} className="h-20 w-20 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-100">
              {props.phase === 'clientOpen' ? '¡Lista para la cola!' : 'Descansando el cristal…'}
            </h2>
            <p className="text-xs text-slate-400">
              {props.phase === 'clientOpen'
                ? 'Cliente detectado. Entra en cola: la selección de campeones y la partida se activan solas.'
                : 'Abre el cliente de League of Legends; lo detecto automáticamente.'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {stats !== null && stats.totalGames > 0 && (
                <span className="rounded border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-300">
                  📊 {stats.totalGames} partidas analizadas
                </span>
              )}
              {stats !== null && <StreakChip current={stats.streaks.current} />}
            </div>
          </div>
        </div>
      </section>

      {/* Snapshot: top champions + last game */}
      {stats !== null && stats.totalGames > 0 ? (
        <div className="flex flex-wrap gap-3">
          <section className="min-w-64 flex-1 rounded-lg border border-slate-800 bg-slate-900 p-3">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Tus campeones
            </h3>
            <ul className="flex flex-col gap-2">
              {topChampions.map((champion) => (
                <li key={champion.champion} className="flex items-center gap-2.5">
                  <img
                    src={`ddicon://champion/${champion.champion}.png`}
                    alt={champion.champion}
                    className="h-9 w-9 rounded border border-slate-700"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-200">{champion.champion}</p>
                    <p className="text-[11px] text-slate-500">
                      {champion.games} partidas · KDA {champion.kda.toFixed(1)} ·{' '}
                      {champion.csPerMin.toFixed(1)} CS/min
                    </p>
                  </div>
                  <span
                    className={`font-mono text-sm ${
                      champion.winratePct >= 50 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {champion.winratePct.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="min-w-64 flex-1 rounded-lg border border-slate-800 bg-slate-900 p-3">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Última partida
            </h3>
            {report ? (
              <div className="flex items-center gap-3">
                <img
                  src={`ddicon://champion/${report.champion}.png`}
                  alt={report.champion}
                  className="h-12 w-12 rounded border border-slate-700"
                />
                <div>
                  <p className="text-sm font-bold">
                    <span className={report.win ? 'text-emerald-400' : 'text-rose-400'}>
                      {report.win ? 'Victoria' : 'Derrota'}
                    </span>{' '}
                    <span className="text-slate-300">con {report.champion}</span>
                  </p>
                  <p className="font-mono text-xs text-slate-400">
                    {report.kills}/{report.deaths}/{report.assists} ·{' '}
                    {report.csPerMin.toFixed(1)} CS/min · {Math.floor(report.durationS / 60)} min
                  </p>
                  {report.summary[0] !== undefined && (
                    <p className="mt-1 text-[11px] text-slate-500">· {report.summary[0]}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Aún no hay ninguna partida enlazada — juega una y el informe aparecerá aquí.
              </p>
            )}
            <div className="mt-3 border-t border-slate-800 pt-2">
              <TipTicker />
            </div>
          </section>
        </div>
      ) : (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center">
          <p className="text-sm text-slate-300">Todavía no conozco tus partidas.</p>
          <p className="mt-1 text-xs text-slate-500">
            Configura tu Riot ID y sincroniza el historial para ver aquí tus campeones, rachas y
            estadísticas.
          </p>
          <button
            className="mt-3 rounded bg-indigo-700 px-3 py-1.5 text-sm hover:bg-indigo-600"
            onClick={props.onOpenSettings}
          >
            Ir a Ajustes
          </button>
          <div className="mt-3 border-t border-slate-800 pt-2 text-left">
            <TipTicker />
          </div>
        </section>
      )}
    </div>
  )
}

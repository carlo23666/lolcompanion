import { useEffect, useState } from 'react'
import type { SessionPhase } from '@shared/session'
import type { PostGameReportResult } from '@shared/report'
import type { StatsOverview } from '@shared/stats'
import { HexiSprite, useMascotName } from './Mascot'

const TIPS = [
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
    const timer = setInterval(() => setIndex((i) => (i + 1) % TIPS.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [])
  return (
    <p key={index} className="alert-in text-xs text-slate-400">
      💡 {TIPS[index]}
    </p>
  )
}

function Metric(props: {
  label: string
  value: React.ReactNode
  tone?: 'good' | 'bad'
}): React.JSX.Element {
  return (
    <div className="flex flex-col rounded border border-slate-800 bg-slate-950/60 px-4 py-2.5">
      <span className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
        {props.label}
      </span>
      <span
        className={`text-2xl leading-tight font-semibold ${
          props.tone === 'good'
            ? 'text-emerald-400'
            : props.tone === 'bad'
              ? 'text-rose-400'
              : 'text-slate-100'
        }`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {props.value}
      </span>
    </div>
  )
}

/**
 * Landing view while no game is running (idle/clientOpen): mascot hero over
 * the most-played champion's splash, metric blocks, splash-backed champion
 * cards and the last game. All data is the owner's own.
 */
export default function HomeDashboard(props: {
  phase: SessionPhase
  onOpenSettings?: () => void
}): React.JSX.Element {
  const mascot = useMascotName()
  const [stats, setStats] = useState<StatsOverview | null>(null)
  const [lastGame, setLastGame] = useState<PostGameReportResult | null>(null)

  useEffect(() => {
    void window.api.invoke('stats:overview').then(setStats, () => undefined)
    void window.api.invoke('report:last').then(setLastGame, () => undefined)
  }, [])

  const topChampions = stats?.champions.slice(0, 3) ?? []
  const hero = topChampions[0]
  const report = lastGame?.kind === 'report' ? lastGame.report : null
  const streak = stats?.streaks.current ?? 0

  // First run: no data yet → a single centered setup moment, not a thin strip
  // of cards floating over a sea of dark.
  if (stats !== null && stats.totalGames === 0) {
    return (
      <div className="card-in flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <HexiSprite mood="idle" className="h-28 w-28" />
        <div>
          <h2 className="text-xl font-bold text-slate-100">
            ¡Hola! Soy {mascot}, tu coach de la Grieta
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
            Configura tu Riot ID y sincroniza el historial: a partir de ahí analizo tus
            campeones, tus builds y tus partidas en directo.
          </p>
        </div>
        <button
          className="rounded bg-indigo-700 px-5 py-2 text-sm font-semibold hover:bg-indigo-600"
          onClick={props.onOpenSettings}
        >
          Empezar en Ajustes
        </button>
        <div className="mt-2">
          <TipTicker />
        </div>
      </div>
    )
  }

  return (
    <div className="card-in flex flex-col gap-3">
      {/* Hero: phase + snapshot numbers over the most-played splash. */}
      <section className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
        {hero && (
          <div className="absolute inset-0" aria-hidden>
            <img
              src={`ddicon://splash/${hero.champion}_0.jpg`}
              alt=""
              className="h-full w-full object-cover object-top opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/85 to-slate-900/25" />
          </div>
        )}
        <div className="relative flex flex-wrap items-center gap-6 p-6">
          <HexiSprite
            mood={props.phase === 'clientOpen' ? 'idle' : 'sleepy'}
            className="h-24 w-24 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-slate-100">
              {props.phase === 'clientOpen' ? '¡Lista para la cola!' : 'Descansando el cristal…'}
            </h2>
            <p className="mt-0.5 max-w-md text-xs text-slate-400">
              {props.phase === 'clientOpen'
                ? 'Cliente detectado. Entra en cola: la selección de campeones y la partida se activan solas.'
                : 'Abre el cliente de League of Legends; lo detecto automáticamente.'}
            </p>
          </div>
          {stats !== null && stats.totalGames > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Partidas" value={stats.totalGames} />
              <Metric
                label="Racha"
                value={`${streak > 0 ? '+' : ''}${String(streak)}`}
                tone={streak > 0 ? 'good' : streak < 0 ? 'bad' : undefined}
              />
              {hero && (
                <Metric
                  label={`WR ${hero.champion}`}
                  value={`${hero.winratePct.toFixed(0)}%`}
                  tone={hero.winratePct >= 50 ? 'good' : 'bad'}
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* Top champions as splash cards. */}
      {topChampions.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {topChampions.map((champion) => (
            <section
              key={champion.champion}
              className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900"
            >
              <div className="absolute inset-0" aria-hidden>
                <img
                  src={`ddicon://splash/${champion.champion}_0.jpg`}
                  alt=""
                  className="h-full w-full object-cover opacity-25"
                  style={{ objectPosition: 'center 20%' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/70 to-slate-900/30" />
              </div>
              <div className="relative flex items-end justify-between gap-2 p-3 pt-14">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-100">{champion.champion}</p>
                  <p
                    className="text-[11px] text-slate-400"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {champion.games} partidas · KDA {champion.kda.toFixed(1)} ·{' '}
                    {champion.csPerMin.toFixed(1)} CS/min
                  </p>
                </div>
                <span
                  className={`text-2xl font-semibold ${
                    champion.winratePct >= 50 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {champion.winratePct.toFixed(0)}%
                </span>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Last game + tips. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-3.5">
          <h3 className="mb-2 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
            Última partida
          </h3>
          {report ? (
            <div className="flex items-center gap-3">
              <img
                src={`ddicon://champion/${report.champion}.png`}
                alt={report.champion}
                className="h-12 w-12 rounded border border-slate-700"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  <span className={report.win ? 'text-emerald-400' : 'text-rose-400'}>
                    {report.win ? 'Victoria' : 'Derrota'}
                  </span>{' '}
                  <span className="text-slate-300">con {report.champion}</span>
                </p>
                <p
                  className="font-mono text-xs text-slate-400"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {report.kills}/{report.deaths}/{report.assists} · {report.csPerMin.toFixed(1)}{' '}
                  CS/min · {Math.floor(report.durationS / 60)} min
                </p>
                {report.summary[0] !== undefined && (
                  <p className="mt-1 truncate text-[11px] text-slate-500">
                    · {report.summary[0]}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Aún no hay ninguna partida enlazada — juega una y el informe aparecerá aquí.
            </p>
          )}
        </section>
        <section className="flex items-center rounded-lg border border-slate-800 bg-slate-900 p-3.5">
          <TipTicker />
        </section>
      </div>
    </div>
  )
}

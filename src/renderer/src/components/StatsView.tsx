import { useEffect, useState } from 'react'
import type { PersonalCurve, StatsOverview } from '@shared/stats'

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DURATION_LABEL: Record<string, string> = {
  corta: '< 25 min',
  media: '25-32 min',
  larga: '> 32 min'
}

function wrColor(pct: number): string {
  return pct >= 50 ? 'text-emerald-400' : 'text-rose-400'
}

function Card(props: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {props.title}
      </h3>
      {props.children}
    </section>
  )
}

function StreakCard(props: { overview: StatsOverview }): React.JSX.Element {
  const { streaks, totalGames } = props.overview
  const tilt =
    streaks.sessionFirstWrPct !== null &&
    streaks.sessionLaterWrPct !== null &&
    streaks.sessionLaterGames >= 10 &&
    streaks.sessionFirstWrPct - streaks.sessionLaterWrPct >= 5
  return (
    <Card title="Rachas y sesiones">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div>
          <p
            className={`text-2xl font-bold ${streaks.current >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {streaks.current >= 0 ? '▲' : '▼'} {Math.abs(streaks.current)}
          </p>
          <p className="text-xs text-slate-500">racha actual</p>
        </div>
        <div className="text-xs text-slate-400">
          <p>
            Mejor racha: <span className="text-emerald-400">{streaks.longestWin} victorias</span>
          </p>
          <p>
            Peor racha: <span className="text-rose-400">{streaks.longestLoss} derrotas</span>
          </p>
          <p className="text-slate-600">{totalGames} partidas analizadas</p>
        </div>
        {streaks.sessionFirstWrPct !== null && streaks.sessionLaterWrPct !== null && (
          <div className="text-xs text-slate-400">
            <p>
              Partidas 1-2 de sesión:{' '}
              <span className={wrColor(streaks.sessionFirstWrPct)}>
                {Math.round(streaks.sessionFirstWrPct)}% WR
              </span>
            </p>
            <p>
              Partida 3 en adelante:{' '}
              <span className={wrColor(streaks.sessionLaterWrPct)}>
                {Math.round(streaks.sessionLaterWrPct)}% WR
              </span>
            </p>
            {tilt && (
              <p className="mt-1 text-amber-400">
                ⚠ Tu winrate cae {Math.round(streaks.sessionFirstWrPct - streaks.sessionLaterWrPct)}{' '}
                puntos a partir de la 3ª partida — considera sesiones más cortas
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function ChampionTable(props: { overview: StatsOverview }): React.JSX.Element {
  return (
    <Card title="Por campeón">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-1 pr-2 font-normal">Campeón</th>
              <th className="pb-1 pr-2 font-normal">P</th>
              <th className="pb-1 pr-2 font-normal">WR</th>
              <th className="pb-1 pr-2 font-normal">KDA</th>
              <th className="pb-1 pr-2 font-normal">CS/min</th>
              <th className="pb-1 pr-2 font-normal">Oro/min</th>
              <th className="pb-1 pr-2 font-normal">% daño</th>
              <th className="pb-1 font-normal">Visión/min</th>
            </tr>
          </thead>
          <tbody>
            {props.overview.champions.slice(0, 10).map((stat) => (
              <tr key={stat.champion} className="border-t border-slate-800/60 text-slate-300">
                <td className="py-1 pr-2">
                  <span className="flex items-center gap-1.5">
                    <img
                      src={`ddicon://champion/${stat.champion}.png`}
                      alt=""
                      className="h-5 w-5 rounded-sm"
                    />
                    {stat.champion}
                  </span>
                </td>
                <td className="pr-2 font-mono">{stat.games}</td>
                <td className={`pr-2 font-mono ${wrColor(stat.winratePct)}`}>
                  {Math.round(stat.winratePct)}%
                </td>
                <td className="pr-2 font-mono">{stat.kda.toFixed(1)}</td>
                <td className="pr-2 font-mono">{stat.csPerMin.toFixed(1)}</td>
                <td className="pr-2 font-mono">{Math.round(stat.goldPerMin)}</td>
                <td className="pr-2 font-mono">{Math.round(stat.damageSharePct)}%</td>
                <td className="font-mono">{stat.visionPerMin.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function BarRow(props: { label: string; pct: number; games: number }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-slate-400">{props.label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-800">
        <div
          className={`h-full rounded ${props.pct >= 50 ? 'bg-emerald-500' : 'bg-rose-500'}`}
          style={{ width: `${String(Math.max(2, Math.min(100, props.pct)))}%` }}
        />
      </div>
      <span className={`w-10 text-right font-mono ${wrColor(props.pct)}`}>
        {Math.round(props.pct)}%
      </span>
      <span className="w-8 text-right font-mono text-slate-600">{props.games}p</span>
    </div>
  )
}

function MatchupChips(props: {
  title: string
  matchups: StatsOverview['worstMatchups']
}): React.JSX.Element | null {
  if (props.matchups.length === 0) return null
  return (
    <Card title={props.title}>
      <div className="flex flex-wrap gap-1.5">
        {props.matchups.map((matchup) => (
          <span
            key={matchup.enemyChampion}
            className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300"
            title={`${matchup.role} · ${String(matchup.games)} partidas`}
          >
            <img
              src={`ddicon://champion/${matchup.enemyChampion}.png`}
              alt=""
              className="h-4 w-4 rounded-sm"
            />
            {matchup.enemyChampion}
            <span className={`font-mono ${wrColor(matchup.winratePct)}`}>
              {Math.round(matchup.winratePct)}%
            </span>
          </span>
        ))}
      </div>
    </Card>
  )
}

function CurvesCard(props: { curves: PersonalCurve[] }): React.JSX.Element | null {
  if (props.curves.length === 0) return null
  return (
    <Card title="Tu curva de farmeo (medias personales)">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-1 pr-2 font-normal">Campeón</th>
              <th className="pb-1 pr-2 font-normal">CS @10</th>
              <th className="pb-1 pr-2 font-normal">CS @15</th>
              <th className="pb-1 pr-2 font-normal">Oro @10</th>
              <th className="pb-1 font-normal">Oro @15</th>
            </tr>
          </thead>
          <tbody>
            {props.curves.map((curve) => (
              <tr key={curve.champion} className="border-t border-slate-800/60 text-slate-300">
                <td className="py-1 pr-2">
                  <span className="flex items-center gap-1.5">
                    <img
                      src={`ddicon://champion/${curve.champion}.png`}
                      alt=""
                      className="h-5 w-5 rounded-sm"
                    />
                    {curve.champion}
                  </span>
                </td>
                <td className="pr-2 font-mono">{curve.csAt10.toFixed(0)}</td>
                <td className="pr-2 font-mono">{curve.csAt15.toFixed(0)}</td>
                <td className="pr-2 font-mono">{Math.round(curve.goldAt10)}</td>
                <td className="font-mono">{Math.round(curve.goldAt15)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function StatsView(): React.JSX.Element {
  const [overview, setOverview] = useState<StatsOverview | null>(null)
  const [curves, setCurves] = useState<PersonalCurve[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      setLoading(true)
      const data = await window.api.invoke('stats:overview')
      if (cancelled) return
      setOverview(data)
      setLoading(false)
      if (data) {
        const top = data.champions.slice(0, 5)
        const loaded = await Promise.all(
          top.map((stat) => window.api.invoke('stats:curve', stat.champion))
        )
        if (!cancelled) setCurves(loaded.filter((curve): curve is PersonalCurve => curve !== null))
      }
    }
    void load()
    const off = window.api.on('history:changed', () => void load())
    return () => {
      cancelled = true
      off()
    }
  }, [])

  if (loading && overview === null) {
    return <p className="p-4 text-sm text-slate-500">Calculando estadísticas…</p>
  }
  if (overview === null || overview.totalGames === 0) {
    return (
      <p className="p-4 text-sm text-slate-500">
        Sin datos todavía — sincroniza tu historial en Ajustes.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto">
      <StreakCard overview={overview} />
      <ChampionTable overview={overview} />
      <CurvesCard curves={curves} />

      <div className="grid gap-3 md:grid-cols-2">
        <Card title="Winrate por duración de partida">
          <div className="flex flex-col gap-1.5">
            {overview.durations.map((duration) => (
              <BarRow
                key={duration.bucket}
                label={DURATION_LABEL[duration.bucket] ?? duration.bucket}
                pct={duration.winratePct}
                games={duration.games}
              />
            ))}
          </div>
        </Card>

        {overview.firstDragon !== null && (
          <Card title="Primer dragón">
            <div className="flex items-center gap-6 text-center">
              <div>
                <p className={`text-xl font-bold ${wrColor(overview.firstDragon.withWrPct)}`}>
                  {Math.round(overview.firstDragon.withWrPct)}%
                </p>
                <p className="text-[11px] text-slate-500">
                  tu equipo lo coge ({overview.firstDragon.withGames}p)
                </p>
              </div>
              <div>
                <p className={`text-xl font-bold ${wrColor(overview.firstDragon.withoutWrPct)}`}>
                  {Math.round(overview.firstDragon.withoutWrPct)}%
                </p>
                <p className="text-[11px] text-slate-500">
                  lo pierde ({overview.firstDragon.withoutGames}p)
                </p>
              </div>
            </div>
          </Card>
        )}

        <MatchupChips title="Peores matchups (misma línea)" matchups={overview.worstMatchups} />
        <MatchupChips title="Mejores matchups (misma línea)" matchups={overview.bestMatchups} />
      </div>

      <Card title="Winrate por día de la semana">
        <div className="flex flex-col gap-1.5">
          {overview.weekdays
            .filter((day) => day.games > 0)
            .map((day) => (
              <BarRow
                key={day.weekday}
                label={WEEKDAYS[day.weekday] ?? String(day.weekday)}
                pct={day.winratePct}
                games={day.games}
              />
            ))}
        </div>
      </Card>
    </div>
  )
}

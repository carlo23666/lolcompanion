import { useEffect, useState } from 'react'
import type { GameState } from '@shared/gamestate'
import type { PersonalCurve } from '@shared/stats'
import type { LiveInsights as Insights } from '../hooks'

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
}

/** Expected CS at minute t from the personal @10/@15 baseline (linear pieces). */
function expectedAt(at10: number, at15: number, minute: number): number {
  if (minute <= 0) return 0
  if (minute <= 10) return (at10 * minute) / 10
  // Post-10 slope; also used to extrapolate past 15.
  return at10 + ((at15 - at10) / 5) * (minute - 10)
}

/** "CS 84 · tu media 78 ▲" — live farm vs the personal baseline. */
export function PersonalCurveChip(props: {
  gameState: GameState
  curve: PersonalCurve | null
}): React.JSX.Element | null {
  const { gameState, curve } = props
  const minute = gameState.gameTimeS / 60
  if (!curve || minute < 3) return null
  const currentCs = gameState.self.scores.creepScore
  const expectedCs = expectedAt(curve.csAt10, curve.csAt15, minute)
  const delta = currentCs - expectedCs
  const ahead = delta >= 0
  return (
    <span
      className={`flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${
        ahead
          ? 'border-emerald-800 bg-emerald-600/10 text-emerald-300'
          : 'border-rose-800 bg-rose-600/10 text-rose-300'
      }`}
      title={`Tu media con ${curve.champion} (${String(curve.games)} partidas): ${curve.csAt10.toFixed(0)} CS @10, ${curve.csAt15.toFixed(0)} CS @15`}
    >
      🌾 CS {currentCs} · tu media {Math.round(expectedCs)} {ahead ? '▲' : '▼'}
      {Math.abs(Math.round(delta))}
    </span>
  )
}

/** Estimated team gold comparison bar. */
export function TeamGoldBar(props: { gameState: GameState }): React.JSX.Element {
  const allies = props.gameState.allyAggregates.estimatedTotalGold
  const enemies = props.gameState.enemyAggregates.estimatedTotalGold
  const total = allies + enemies
  const allyPct = total > 0 ? (allies / total) * 100 : 50
  const diff = allies - enemies
  const ahead = diff >= 0
  return (
    <div
      className="flex items-center gap-2 text-xs"
      title="Oro estimado por equipo (modelo documentado en normalize.ts)"
    >
      <span className="text-slate-500">oro</span>
      <div className="flex h-2 flex-1 overflow-hidden rounded bg-rose-900/60">
        <div className="h-full bg-sky-600" style={{ width: `${String(allyPct)}%` }} />
      </div>
      <span className={`font-mono ${ahead ? 'text-emerald-400' : 'text-rose-400'}`}>
        {ahead ? '▲' : '▼'} {(Math.abs(diff) / 1000).toFixed(1)}k
      </span>
    </div>
  )
}

/** Dragon/baron spawn countdowns + dead-gold reminder. */
export function LiveChips(props: {
  gameState: GameState
  insights: Insights
}): React.JSX.Element {
  const { gameState, insights } = props
  const now = gameState.gameTimeS
  const dragonIn = insights.nextDragonS !== null ? insights.nextDragonS - now : null
  const baronIn = insights.nextBaronS !== null ? insights.nextBaronS - now : null
  const deadGold = gameState.self.currentGold >= 2500

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {dragonIn !== null && (
        <span className="rounded border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-300">
          🐉 {dragonIn > 0 ? `en ${formatClock(dragonIn)}` : 'en el mapa'}
        </span>
      )}
      {baronIn !== null && (
        <span className="rounded border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-300">
          🟣 {baronIn > 0 ? `Barón en ${formatClock(baronIn)}` : 'Barón en el mapa'}
        </span>
      )}
      {deadGold && (
        <span className="rounded border border-amber-800 bg-amber-600/10 px-2 py-0.5 text-xs text-amber-300">
          💰 {Math.round(gameState.self.currentGold)} oro sin gastar — planea base
        </span>
      )}
    </div>
  )
}

/** Rolling feed of enemy power-spike alerts. */
export function AlertFeed(props: { insights: Insights }): React.JSX.Element | null {
  if (props.insights.alerts.length === 0) return null
  return (
    <ul className="flex flex-col gap-0.5">
      {props.insights.alerts.slice(0, 4).map((alert) => (
        <li
          key={alert.id}
          className={`alert-in text-xs ${alert.kind === 'spike' ? 'text-amber-300' : 'text-slate-400'}`}
        >
          <span className="font-mono text-slate-600">{formatClock(alert.gameTimeS)}</span> ⚠{' '}
          {alert.text}
        </li>
      ))}
    </ul>
  )
}

/** Fetches the personal curve for the current champion once per game. */
export function usePersonalCurve(gameState: GameState | null): PersonalCurve | null {
  const [curve, setCurve] = useState<PersonalCurve | null>(null)
  // championId is the ddragon id ("Kaisa"), matching what match-v5 stores in
  // the DB; championName is the display name ("Kai'Sa") and would miss.
  const champion = gameState?.self.championId ?? null
  useEffect(() => {
    setCurve(null)
    if (champion === null || champion === '') return
    let cancelled = false
    void window.api.invoke('stats:curve', champion).then((result) => {
      if (!cancelled) setCurve(result)
    })
    return () => {
      cancelled = true
    }
  }, [champion])
  return curve
}

import { useEffect, useState } from 'react'
import type { ChampionMeta } from '@shared/champselect'
import type { GameState } from '@shared/gamestate'
import type { RecommendationsPayload } from '@shared/ipc'
import type { ChampSelectState } from '@shared/schemas/lcu'
import type { SessionPhase } from '@shared/session'
import type { LiveInsights as LiveInsightsData } from '../hooks'
import ChampSelectPanel from './ChampSelectPanel'
import Gauges from './Gauges'
import HomeDashboard from './HomeDashboard'
import {
  AlertFeed,
  LiveChips,
  PersonalCurveChip,
  TeamGoldBar,
  usePersonalCurve
} from './LiveInsights'
import ObjectivesRow from './ObjectivesRow'
import PostGameReport from './PostGameReport'
import RecommendationCard from './RecommendationCard'
import TeamPanel from './TeamPanel'

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
}

function EmptyState(props: { icon: string; title: string; hint: string }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      <span className="text-4xl" aria-hidden>
        {props.icon}
      </span>
      <p className="text-sm font-medium text-slate-300">{props.title}</p>
      <p className="max-w-xs text-xs text-slate-500">{props.hint}</p>
    </div>
  )
}

/** One-line nudge while in game if the experimental overlay is switched off. */
function OverlayHint(props: { onOpenSettings?: () => void }): React.JSX.Element | null {
  const [overlayEnabled, setOverlayEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    void window.api.invoke('settings:get').then((settings) => {
      // Defensive: test stubs (and a failed invoke) may hand back null.
      if (!cancelled && settings != null) setOverlayEnabled(settings.overlayEnabled)
    })
    return () => {
      cancelled = true
    }
  }, [])
  if (overlayEnabled !== false) return null
  return (
    <p className="card-in rounded border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-[11px] text-slate-400">
      💡 Hexi puede acompañarte dentro del juego con un overlay (LoL en ventana o sin bordes).{' '}
      <button
        className="text-indigo-300 underline hover:text-indigo-200"
        onClick={props.onOpenSettings}
      >
        Actívalo en Ajustes
      </button>
    </p>
  )
}

export default function LiveView(props: {
  phase: SessionPhase
  liveState?: 'unavailable' | 'loading' | 'polling' | null
  gameState: GameState | null
  champSelect: ChampSelectState | null
  recommendations?: RecommendationsPayload | null
  championMeta?: Record<number, ChampionMeta>
  insights?: LiveInsightsData
  onOpenSettings?: () => void
}): React.JSX.Element {
  const { phase, gameState } = props
  const curve = usePersonalCurve(gameState)

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <h1 className="text-lg font-bold">Live</h1>

      {(phase === 'idle' || phase === 'clientOpen') && (
        <HomeDashboard phase={phase} onOpenSettings={props.onOpenSettings} />
      )}
      {phase === 'postGame' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-sm font-medium text-slate-300">🏁 Fin de la partida</p>
          <PostGameReport />
        </div>
      )}
      {phase === 'champSelect' && (
        <ChampSelectPanel champSelect={props.champSelect} championMeta={props.championMeta} />
      )}

      {phase === 'inGame' &&
        (gameState === null ? (
          props.liveState === 'loading' ? (
            <EmptyState
              icon="🌀"
              title="Cargando partida"
              hint="La pantalla de carga está en marcha; los datos llegan al aparecer en la Grieta."
            />
          ) : (
            <EmptyState
              icon="⏳"
              title="Conectando con la partida"
              hint="Leyendo datos del juego (puerto 2999)…"
            />
          )
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto">
            <OverlayHint onOpenSettings={props.onOpenSettings} />
            <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm">
              <span className="font-mono text-lg">⏱ {formatClock(gameState.gameTimeS)}</span>
              <span className="font-mono text-amber-300">
                💰 {Math.round(gameState.self.currentGold)}
              </span>
              <span className="font-mono text-slate-300">
                {gameState.self.scores.kills}/{gameState.self.scores.deaths}/
                {gameState.self.scores.assists}
              </span>
              <PersonalCurveChip gameState={gameState} curve={curve} />
              <span className="ml-auto text-xs text-slate-500">
                {gameState.self.championName} · nv {gameState.self.level} · parche{' '}
                {gameState.patch}
              </span>
            </div>

            {props.insights && (
              <div className="card-in flex flex-col gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2">
                <div className="flex items-center gap-3">
                  <LiveChips gameState={gameState} insights={props.insights} />
                  <div className="min-w-32 flex-1">
                    <TeamGoldBar gameState={gameState} />
                  </div>
                </div>
                <AlertFeed insights={props.insights} />
              </div>
            )}

            <RecommendationCard
              payload={props.recommendations ?? null}
              currentGold={gameState.self.currentGold}
            />

            <div className="flex gap-3">
              <TeamPanel
                title="Tu equipo"
                accent="ally"
                players={[gameState.self, ...gameState.allies]}
                selfChampion={gameState.self.championName}
              />
              <TeamPanel title="Enemigos" accent="enemy" players={gameState.enemies} />
            </div>

            <Gauges aggregates={gameState.enemyAggregates} gameTimeS={gameState.gameTimeS} />
            <ObjectivesRow objectives={gameState.objectives} selfTeam={gameState.self.team} />
          </div>
        ))}
    </div>
  )
}

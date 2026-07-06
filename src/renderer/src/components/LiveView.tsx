import { useEffect, useState } from 'react'
import type { ChampionMeta } from '@shared/champselect'
import type { GameState } from '@shared/gamestate'
import type { RecommendationsPayload } from '@shared/ipc'
import type { ChampSelectState } from '@shared/schemas/lcu'
import type { SessionPhase } from '@shared/session'
import type { LiveInsights as LiveInsightsData } from '../hooks'
import AnimatedNumber from './AnimatedNumber'
import ChampSelectPanel from './ChampSelectPanel'
import { useTheme } from './Mascot'
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
      💡 Tu mascota puede acompañarte dentro del juego con un overlay (LoL en ventana o sin
      bordes).{' '}
      <button
        className="text-indigo-300 underline hover:text-indigo-200"
        onClick={props.onOpenSettings}
      >
        Actívalo en Ajustes
      </button>
    </p>
  )
}

/**
 * In-game layout, arranged per identity: Recreativa stacks like an arcade
 * screen list; Sakura reads as a centered notebook scroll; Cabina splits
 * into a two-column cockpit (advice console right, instruments left).
 */
function InGameLayout(props: {
  gameState: GameState
  curve: ReturnType<typeof usePersonalCurve>
  recommendations: RecommendationsPayload | null
  insights?: LiveInsightsData
  onOpenSettings?: () => void
}): React.JSX.Element {
  const theme = useTheme()
  const { gameState, curve } = props

  const stat = (label: string, value: React.ReactNode, accent = false): React.JSX.Element => (
    <div className="flex flex-col px-4 first:pl-0">
      <span className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
        {label}
      </span>
      <span
        className={`text-xl leading-tight font-semibold ${accent ? 'text-amber-300' : 'text-slate-100'}`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </span>
    </div>
  )
  const statusBar = (
    <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5">
      <div className="mr-4 flex items-center gap-2.5 border-r border-slate-800 pr-4">
        <img
          src={`ddicon://champion/${gameState.self.championId}.png`}
          alt={gameState.self.championName}
          className="h-10 w-10 rounded border border-amber-400/40"
        />
        <div>
          <p className="text-sm leading-tight font-semibold text-slate-100">
            {gameState.self.championName}
          </p>
          <p className="text-[11px] text-slate-500">nivel {gameState.self.level}</p>
        </div>
      </div>
      <div className="flex divide-x divide-slate-800">
        {stat('Tiempo', formatClock(gameState.gameTimeS))}
        {stat('Oro', <AnimatedNumber value={Math.round(gameState.self.currentGold)} />, true)}
        {stat(
          'KDA',
          `${String(gameState.self.scores.kills)}/${String(gameState.self.scores.deaths)}/${String(gameState.self.scores.assists)}`
        )}
        {stat('CS', gameState.self.scores.creepScore)}
      </div>
      <div className="ml-4">
        <PersonalCurveChip gameState={gameState} curve={curve} />
      </div>
      <span className="ml-auto text-[11px] text-slate-600">parche {gameState.patch}</span>
    </div>
  )
  const hero = (
    <RecommendationCard payload={props.recommendations} currentGold={gameState.self.currentGold} />
  )
  const insightsRow = props.insights ? (
    <div className="card-in flex flex-col gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2">
      <div className="flex items-center gap-3">
        <LiveChips gameState={gameState} insights={props.insights} />
        <div className="min-w-32 flex-1">
          <TeamGoldBar gameState={gameState} />
        </div>
      </div>
      <AlertFeed insights={props.insights} />
    </div>
  ) : null
  const allies = (
    <TeamPanel
      title="Tu equipo"
      accent="ally"
      players={[gameState.self, ...gameState.allies]}
      selfChampion={gameState.self.championName}
    />
  )
  const enemies = <TeamPanel title="Enemigos" accent="enemy" players={gameState.enemies} />
  const gauges = <Gauges aggregates={gameState.enemyAggregates} gameTimeS={gameState.gameTimeS} />
  const objectives = (
    <ObjectivesRow objectives={gameState.objectives} selfTeam={gameState.self.team} />
  )
  const hint = <OverlayHint onOpenSettings={props.onOpenSettings} />

  if (theme === 'cabina') {
    return (
      <div className="flex flex-col gap-3">
        {hint}
        {statusBar}
        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
          <div className="flex flex-col gap-3">
            <div className="flex gap-3 opacity-90">
              {allies}
              {enemies}
            </div>
            {gauges}
            {objectives}
          </div>
          <div className="flex flex-col gap-3">
            {hero}
            {insightsRow}
          </div>
        </div>
      </div>
    )
  }

  if (theme === 'sakura') {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {hint}
        {statusBar}
        {hero}
        {insightsRow}
        <div className="flex flex-col gap-3 opacity-90">
          {allies}
          {enemies}
        </div>
        {gauges}
        {objectives}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {hint}
      {statusBar}
      {hero}
      {insightsRow}
      <div className="flex gap-3 opacity-90">
        {allies}
        {enemies}
      </div>
      {gauges}
      {objectives}
    </div>
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
    // min-h-full (not h-full): the view must be able to GROW past the
    // viewport so <main>'s scrollbar reaches everything. max-w keeps the
    // content composed on wide monitors instead of stretched and empty.
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-3 p-4">
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
          <InGameLayout
            gameState={gameState}
            curve={curve}
            recommendations={props.recommendations ?? null}
            insights={props.insights}
            onOpenSettings={props.onOpenSettings}
          />
        ))}
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { ChampionMeta } from '@shared/champselect'
import type { GameState } from '@shared/gamestate'
import type { RecommendationsPayload } from '@shared/ipc'
import type { ChampSelectState } from '@shared/schemas/lcu'
import type { SessionPhase } from '@shared/session'
import { useIpcEvent, type LiveInsights as LiveInsightsData } from '../hooks'
import { useT } from '../i18n'
import AnimatedNumber from './AnimatedNumber'
import ChampSelectPanel from './ChampSelectPanel'
import { HexiSprite, useMascotName } from './Mascot'

/** Role-aware strategic read from the local-AI coach (slow cadence). */
function GameDirectionPanel(): React.JSX.Element | null {
  const direction = useIpcEvent('coach:direction')
  const mascot = useMascotName()
  const t = useT()
  if (direction === null) return null
  return (
    <section className="card-in rounded-lg border border-indigo-800/60 bg-slate-900 p-3.5">
      <div className="flex items-start gap-2.5">
        <HexiSprite mood="focused" className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] font-semibold tracking-widest text-indigo-300 uppercase">
            {t('live.gamePlan')} · {mascot}
          </p>
          <p className="text-xs leading-relaxed text-slate-300">{direction.text}</p>
        </div>
      </div>
    </section>
  )
}
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
  const t = useT()
  if (overlayEnabled !== false) return null
  return (
    <p className="card-in rounded border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-[11px] text-slate-400">
      💡 {t('live.overlayHint')}{' '}
      <button
        className="text-indigo-300 underline hover:text-indigo-200"
        onClick={props.onOpenSettings}
      >
        {t('live.overlayEnable')}
      </button>
    </p>
  )
}

/**
 * In-game layout (one professional arrangement for every identity):
 * HUD strip on top, then a two-column console on wide windows — advice
 * (recommendation, plan, alerts) left, instruments (teams, gauges,
 * objectives) right. Stacks on narrow windows.
 */
function InGameLayout(props: {
  gameState: GameState
  curve: ReturnType<typeof usePersonalCurve>
  recommendations: RecommendationsPayload | null
  insights?: LiveInsightsData
  onOpenSettings?: () => void
}): React.JSX.Element {
  const { gameState, curve } = props
  const t = useT()

  const stat = (label: string, value: React.ReactNode, accent = false): React.JSX.Element => (
    <div className="flex flex-col px-4 first:pl-0">
      <span className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
        {label}
      </span>
      <span
        className={`font-display text-xl leading-tight font-semibold ${accent ? 'stat-glow text-amber-300' : 'text-slate-100'}`}
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
          className="h-10 w-10 rounded border border-amber-400/40 shadow-[0_0_10px_-2px_var(--color-amber-400)]"
        />
        <div>
          <p className="text-sm leading-tight font-semibold text-slate-100">
            {gameState.self.championName}
          </p>
          <p className="text-[11px] text-slate-500">
            {t('live.levelAbbr', { n: String(gameState.self.level) })}
          </p>
        </div>
      </div>
      <div className="flex divide-x divide-slate-800">
        {stat(t('live.stat.time'), formatClock(gameState.gameTimeS))}
        {stat(
          t('live.stat.gold'),
          <AnimatedNumber value={Math.round(gameState.self.currentGold)} />,
          true
        )}
        {stat(
          t('live.stat.kda'),
          `${String(gameState.self.scores.kills)}/${String(gameState.self.scores.deaths)}/${String(gameState.self.scores.assists)}`
        )}
        {stat(t('live.stat.cs'), gameState.self.scores.creepScore)}
      </div>
      <div className="ml-4">
        <PersonalCurveChip gameState={gameState} curve={curve} />
      </div>
      <span className="ml-auto text-[11px] text-slate-600">
        {t('live.patch', { patch: gameState.patch })}
      </span>
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
      title={t('live.yourTeam')}
      accent="ally"
      players={[gameState.self, ...gameState.allies]}
      selfChampion={gameState.self.championName}
    />
  )
  const enemies = <TeamPanel title={t('live.enemies')} accent="enemy" players={gameState.enemies} />
  const gauges = <Gauges aggregates={gameState.enemyAggregates} gameTimeS={gameState.gameTimeS} />
  const objectives = (
    <ObjectivesRow objectives={gameState.objectives} selfTeam={gameState.self.team} />
  )
  const hint = <OverlayHint onOpenSettings={props.onOpenSettings} />
  const direction = <GameDirectionPanel />

  // Transparent champion-splash backdrop: your champion looms behind the
  // console, fading into the page color (theme-aware via slate vars).
  const splashName = gameState.self.championName.replace(/[^a-zA-Z]/g, '')
  const backdrop = (
    <div
      className="pointer-events-none absolute inset-x-0 -top-4 -z-10 h-80 overflow-hidden"
      aria-hidden
    >
      <img
        src={`ddicon://splash/${splashName}_0.jpg`}
        alt=""
        className="h-full w-full object-cover object-top opacity-15"
        onError={(event) => {
          event.currentTarget.parentElement?.remove()
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/70 to-slate-950" />
    </div>
  )

  return (
    <div className="relative isolate flex flex-col gap-3">
      {backdrop}
      {hint}
      {statusBar}
      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex flex-col gap-3">
          {hero}
          {direction}
          {insightsRow}
        </div>
        <div className="flex flex-col gap-3">
          {/* Time-critical first: objective timers lead the instruments. */}
          {objectives}
          {allies}
          {enemies}
          {gauges}
        </div>
      </div>
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
  onOpenHistory?: () => void
}): React.JSX.Element {
  const { phase, gameState } = props
  const curve = usePersonalCurve(gameState)
  const t = useT()

  return (
    // min-h-full (not h-full): the view must be able to GROW past the
    // viewport so <main>'s scrollbar reaches everything. max-w keeps the
    // content composed on wide monitors instead of stretched and empty.
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-3 p-4">
      <h1 className="text-lg font-bold">{t('nav.live')}</h1>

      {(phase === 'idle' || phase === 'clientOpen') && (
        <HomeDashboard phase={phase} onOpenSettings={props.onOpenSettings} />
      )}
      {phase === 'postGame' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-sm font-medium text-slate-300">🏁 {t('live.gameOverBanner')}</p>
          <PostGameReport />
          {props.onOpenHistory && (
            <button
              className="rounded border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs text-slate-300 hover:border-indigo-500/60 hover:text-slate-100"
              onClick={props.onOpenHistory}
            >
              {t('live.compareHistory')}
            </button>
          )}
        </div>
      )}
      {phase === 'champSelect' && (
        <ChampSelectPanel champSelect={props.champSelect} championMeta={props.championMeta} />
      )}

      {phase === 'inGame' &&
        (gameState === null ? (
          props.liveState === 'loading' ? (
            <EmptyState icon="🌀" title={t('live.loadingTitle')} hint={t('live.loadingHint')} />
          ) : (
            <EmptyState
              icon="⏳"
              title={t('live.connectingTitle')}
              hint={t('live.connectingHint')}
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

import { useEffect, useRef, useState } from 'react'
import type { IpcEventChannel, IpcEventChannels } from '@shared/ipc'
import type { MaterialAdvantageReason, MaterialAdvantageSignal } from '@shared/duel'
import { t as translators, type Translator } from '@shared/i18n'
import { useT } from './i18n'

const GAME_SCOPED_CHANNELS: ReadonlySet<IpcEventChannel> = new Set([
  'gamestate:update',
  'gamestate:events',
  'gamestate:recommendations',
  'gamestate:duel',
  'coach:direction'
])

/** Subscribes to a push channel and keeps the latest payload as state. */
export function useIpcEvent<C extends IpcEventChannel>(
  channel: C,
  initial: IpcEventChannels[C] | null = null
): IpcEventChannels[C] | null {
  const [value, setValue] = useState<IpcEventChannels[C] | null>(initial)
  useEffect(() => {
    const offValue = window.api.on(channel, setValue)
    const offReset = GAME_SCOPED_CHANNELS.has(channel)
      ? window.api.on('gamestate:reset', () => setValue(initial))
      : () => undefined
    return () => {
      offValue()
      offReset()
    }
  }, [channel, initial])
  return value
}

export interface LiveAlert {
  id: number
  gameTimeS: number
  /** Purchase/duel alerts are deterministic; coach is optional local-AI prose. */
  kind: 'spike' | 'objective' | 'purchase' | 'duel' | 'coach' | 'info'
  text: string
  itemId?: number
  itemName?: string
}

export interface LiveInsights {
  alerts: LiveAlert[]
  /** Game-time (s) when the next dragon/baron spawns; null = unknown/alive. */
  nextDragonS: number | null
  nextBaronS: number | null
}

/**
 * Objective spawn timing — derivable from on-screen information (the game
 * shows these timers itself). ADJUST PER PATCH if Riot moves them.
 */
const DRAGON_FIRST_SPAWN_S = 5 * 60
const DRAGON_RESPAWN_S = 5 * 60
const BARON_SPAWN_S = 20 * 60
const BARON_RESPAWN_S = 6 * 60
/** Item completions at or above this gold count as an enemy power spike. */
const SPIKE_ITEM_GOLD = 2400
const LEVEL_SPIKES = new Set([6, 11, 16])
const MAX_ALERTS = 6
/** An objective spawning within this window still counts as a play window. */
const OBJECTIVE_SOON_S = 60

function duelReasonText(reason: MaterialAdvantageReason, t: Translator): string {
  const amount = String(reason.amount)
  if (reason.kind === 'levels') return t('alert.duel.levels', { n: amount })
  if (reason.kind === 'completedItems') {
    return t(reason.amount === 1 ? 'alert.duel.completedOne' : 'alert.duel.completedMany', {
      n: amount
    })
  }
  if (reason.kind === 'itemValue') {
    return t('alert.duel.itemValue', { value: String(Math.round(reason.amount / 100) * 100) })
  }
  if (reason.kind === 'health') return t('alert.duel.health', { pct: amount })
  if (reason.kind === 'cs') return t('alert.duel.cs', { n: amount })
  return t('alert.duel.kda')
}

export function duelAlertText(signal: MaterialAdvantageSignal, t: Translator): string {
  const [first = '', second = ''] = signal.advantages.map((reason) => duelReasonText(reason, t))
  return t('alert.duel', {
    champion: signal.opponentChampionName,
    advantages: t('alert.duel.join', { first, second })
  })
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
}

/**
 * Objective-window text for visible enemy deaths (kills are on-screen events;
 * positions come from the Live Client scoreboard). Null when no objective is
 * up or coming soon.
 */
export function objectiveWindowText(
  deaths: { championName: string; isJungler: boolean }[],
  now: number,
  nextDragonS: number | null,
  nextBaronS: number | null,
  t: Translator = translators.es
): string | null {
  const jungler = deaths.find((death) => death.isJungler)
  if (!jungler && deaths.length < 2) return null

  const dragonIn = nextDragonS !== null ? nextDragonS - now : null
  const baronIn =
    nextBaronS !== null && now >= BARON_SPAWN_S - OBJECTIVE_SOON_S ? nextBaronS - now : null
  let objective: string | null = null
  if (baronIn !== null && baronIn <= 0) objective = t('alert.baronFree')
  else if (dragonIn !== null && dragonIn <= 0) objective = t('alert.dragonFree')
  else if (baronIn !== null && baronIn <= OBJECTIVE_SOON_S)
    objective = t('alert.baronIn', { time: formatClock(Math.max(0, baronIn)) })
  else if (dragonIn !== null && dragonIn <= OBJECTIVE_SOON_S)
    objective = t('alert.dragonIn', { time: formatClock(Math.max(0, dragonIn)) })
  if (objective === null) return null

  const who = jungler
    ? t('alert.junglerDied', { champion: jungler.championName })
    : t('alert.enemiesDied', { n: String(deaths.length) })
  return t('alert.objectiveWindow', { who, objective })
}

/**
 * Accumulates enemy power-spike alerts and objective spawn timers from the
 * gamestate event stream. Lives at App level so it survives view switches;
 * resets when game time goes backwards (new game).
 */
export function useLiveInsights(): LiveInsights {
  const [insights, setInsights] = useState<LiveInsights>({
    alerts: [],
    nextDragonS: DRAGON_FIRST_SPAWN_S,
    nextBaronS: BARON_SPAWN_S
  })
  // Latest translator in a ref: the event subscription mounts once, but alert
  // text must follow the current locale without re-subscribing (ADR-009).
  const t = useT()
  const tRef = useRef(t)
  tRef.current = t
  const timeRef = useRef(0)
  const selfTeamRef = useRef<'ORDER' | 'CHAOS'>('ORDER')
  const idRef = useRef(1)
  const enemyPositionsRef = useRef(new Map<string, string>())
  const lastRecommendationRef = useRef('')
  // Mirror of the spawn timers so event handlers can read them without
  // reaching into the state updater (updaters must stay side-effect free).
  const timersRef = useRef<{ dragon: number | null; baron: number | null }>({
    dragon: DRAGON_FIRST_SPAWN_S,
    baron: BARON_SPAWN_S
  })

  useEffect(() => {
    const resetInsights = (): void => {
      timeRef.current = 0
      selfTeamRef.current = 'ORDER'
      enemyPositionsRef.current.clear()
      lastRecommendationRef.current = ''
      timersRef.current = { dragon: DRAGON_FIRST_SPAWN_S, baron: BARON_SPAWN_S }
      setInsights({
        alerts: [],
        nextDragonS: DRAGON_FIRST_SPAWN_S,
        nextBaronS: BARON_SPAWN_S
      })
    }
    const offState = window.api.on('gamestate:update', (state) => {
      if (state.gameTimeS < timeRef.current - 5) {
        // Real-client fallback: an explicit reset normally arrives first,
        // but a backwards clock is still a safe session boundary.
        resetInsights()
      }
      timeRef.current = state.gameTimeS
      selfTeamRef.current = state.self.team
      for (const enemy of state.enemies) {
        enemyPositionsRef.current.set(enemy.championName, enemy.position)
      }
    })
    const offEvents = window.api.on('gamestate:events', (events) => {
      const now = timeRef.current
      const enemyTeam = selfTeamRef.current === 'ORDER' ? 'CHAOS' : 'ORDER'
      const fresh: LiveAlert[] = []
      const enemyDeaths: { championName: string; isJungler: boolean }[] = []
      let dragonTaken = false
      let baronTaken = false
      for (const event of events) {
        if (event.type === 'playerDied' && event.team === enemyTeam) {
          enemyDeaths.push({
            championName: event.championName,
            isJungler: enemyPositionsRef.current.get(event.championName) === 'JUNGLE'
          })
        } else if (event.type === 'itemCompleted' && event.team === enemyTeam) {
          if (event.item.totalGold >= SPIKE_ITEM_GOLD) {
            fresh.push({
              id: idRef.current++,
              gameTimeS: now,
              kind: 'spike',
              text: tRef.current('alert.spike', {
                champion: event.championName,
                item: event.item.name
              })
            })
          }
        } else if (event.type === 'levelUp' && event.team === enemyTeam) {
          if (LEVEL_SPIKES.has(event.level)) {
            fresh.push({
              id: idRef.current++,
              gameTimeS: now,
              kind: 'spike',
              text: tRef.current('alert.levelSpike', {
                champion: event.championName,
                level: String(event.level)
              })
            })
          }
        } else if (event.type === 'objectiveTaken') {
          if (event.objective === 'dragon') dragonTaken = true
          if (event.objective === 'baron') baronTaken = true
        }
      }
      const windowText = objectiveWindowText(
        enemyDeaths,
        now,
        timersRef.current.dragon,
        timersRef.current.baron,
        tRef.current
      )
      if (windowText !== null) {
        // Appended last so the batch reverse below surfaces it on top.
        fresh.push({ id: idRef.current++, gameTimeS: now, kind: 'objective', text: windowText })
      }
      if (dragonTaken) timersRef.current.dragon = now + DRAGON_RESPAWN_S
      if (baronTaken) timersRef.current.baron = now + BARON_RESPAWN_S

      if (fresh.length === 0 && !dragonTaken && !baronTaken) return
      // Reversed once, outside the updater (StrictMode may run it twice).
      const batch = [...fresh].reverse()
      setInsights((previous) => ({
        alerts: [...batch, ...previous.alerts].slice(0, MAX_ALERTS),
        nextDragonS: dragonTaken ? now + DRAGON_RESPAWN_S : previous.nextDragonS,
        nextBaronS: baronTaken ? now + BARON_RESPAWN_S : previous.nextBaronS
      }))
    })
    const offRecommendations = window.api.on('gamestate:recommendations', (payload) => {
      const top = payload.recommendations[0]
      if (top === undefined || top.itemId === null || top.itemName === null) return
      const itemId = top.itemId
      const itemName = top.itemName
      const key = `${String(itemId)}:${top.action}`
      if (key === lastRecommendationRef.current) return
      lastRecommendationRef.current = key
      setInsights((previous) => ({
        ...previous,
        alerts: [
          {
            id: idRef.current++,
            gameTimeS: payload.gameTimeS,
            kind: 'purchase' as const,
            text: top.reasons[0] ?? tRef.current('alert.purchaseFallback'),
            itemId,
            itemName
          },
          ...previous.alerts
        ].slice(0, MAX_ALERTS)
      }))
    })
    const offDuel = window.api.on('gamestate:duel', (signal) => {
      setInsights((previous) => ({
        ...previous,
        alerts: [
          {
            id: idRef.current++,
            gameTimeS: signal.gameTimeS,
            kind: 'duel' as const,
            text: duelAlertText(signal, tRef.current)
          },
          ...previous.alerts
        ].slice(0, MAX_ALERTS)
      }))
    })
    const offCoach = window.api.on('coach:tip', (tip) => {
      setInsights((previous) => ({
        ...previous,
        alerts: [
          { id: idRef.current++, gameTimeS: tip.gameTimeS, kind: 'coach' as const, text: tip.text },
          ...previous.alerts
        ].slice(0, MAX_ALERTS)
      }))
    })
    const offReset = window.api.on('gamestate:reset', resetInsights)
    return () => {
      offState()
      offEvents()
      offRecommendations()
      offDuel()
      offCoach()
      offReset()
    }
  }, [])

  return insights
}

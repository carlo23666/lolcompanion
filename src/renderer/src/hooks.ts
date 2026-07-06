import { useEffect, useRef, useState } from 'react'
import type { IpcEventChannel, IpcEventChannels } from '@shared/ipc'

/** Subscribes to a push channel and keeps the latest payload as state. */
export function useIpcEvent<C extends IpcEventChannel>(
  channel: C,
  initial: IpcEventChannels[C] | null = null
): IpcEventChannels[C] | null {
  const [value, setValue] = useState<IpcEventChannels[C] | null>(initial)
  useEffect(() => window.api.on(channel, setValue), [channel])
  return value
}

export interface LiveAlert {
  id: number
  gameTimeS: number
  /** 'spike' = enemy power spike, 'objective' = window to play,
   * 'coach' = local-AI macro tip, 'info' = neutral. */
  kind: 'spike' | 'objective' | 'coach' | 'info'
  text: string
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
  nextBaronS: number | null
): string | null {
  const jungler = deaths.find((death) => death.isJungler)
  if (!jungler && deaths.length < 2) return null

  const dragonIn = nextDragonS !== null ? nextDragonS - now : null
  const baronIn = nextBaronS !== null && now >= BARON_SPAWN_S - OBJECTIVE_SOON_S ? nextBaronS - now : null
  let objective: string | null = null
  if (baronIn !== null && baronIn <= 0) objective = '¡Barón libre!'
  else if (dragonIn !== null && dragonIn <= 0) objective = 'dragón libre'
  else if (baronIn !== null && baronIn <= OBJECTIVE_SOON_S)
    objective = `Barón sale en ${formatClock(Math.max(0, baronIn))}`
  else if (dragonIn !== null && dragonIn <= OBJECTIVE_SOON_S)
    objective = `dragón sale en ${formatClock(Math.max(0, dragonIn))}`
  if (objective === null) return null

  const who = jungler
    ? `${jungler.championName} (jungla enemiga) ha muerto`
    : `${String(deaths.length)} enemigos han muerto`
  return `${who} — ${objective}`
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
  const timeRef = useRef(0)
  const selfTeamRef = useRef<'ORDER' | 'CHAOS'>('ORDER')
  const idRef = useRef(1)
  const enemyPositionsRef = useRef(new Map<string, string>())
  // Mirror of the spawn timers so event handlers can read them without
  // reaching into the state updater (updaters must stay side-effect free).
  const timersRef = useRef<{ dragon: number | null; baron: number | null }>({
    dragon: DRAGON_FIRST_SPAWN_S,
    baron: BARON_SPAWN_S
  })

  useEffect(() => {
    const offState = window.api.on('gamestate:update', (state) => {
      if (state.gameTimeS < timeRef.current - 5) {
        // Game time went backwards → new game.
        timersRef.current = { dragon: DRAGON_FIRST_SPAWN_S, baron: BARON_SPAWN_S }
        setInsights({
          alerts: [],
          nextDragonS: DRAGON_FIRST_SPAWN_S,
          nextBaronS: BARON_SPAWN_S
        })
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
              text: `${event.championName} completó ${event.item.name} — power spike`
            })
          }
        } else if (event.type === 'levelUp' && event.team === enemyTeam) {
          if (LEVEL_SPIKES.has(event.level)) {
            fresh.push({
              id: idRef.current++,
              gameTimeS: now,
              kind: 'spike',
              text: `${event.championName} alcanzó nivel ${String(event.level)}`
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
        timersRef.current.baron
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
    const offCoach = window.api.on('coach:tip', (tip) => {
      setInsights((previous) => ({
        ...previous,
        alerts: [
          { id: idRef.current++, gameTimeS: tip.gameTimeS, kind: 'coach' as const, text: tip.text },
          ...previous.alerts
        ].slice(0, MAX_ALERTS)
      }))
    })
    return () => {
      offState()
      offEvents()
      offCoach()
    }
  }, [])

  return insights
}

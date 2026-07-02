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
  /** 'spike' = enemy power spike, 'info' = neutral. */
  kind: 'spike' | 'info'
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

  useEffect(() => {
    const offState = window.api.on('gamestate:update', (state) => {
      if (state.gameTimeS < timeRef.current - 5) {
        // Game time went backwards → new game.
        setInsights({
          alerts: [],
          nextDragonS: DRAGON_FIRST_SPAWN_S,
          nextBaronS: BARON_SPAWN_S
        })
      }
      timeRef.current = state.gameTimeS
      selfTeamRef.current = state.self.team
    })
    const offEvents = window.api.on('gamestate:events', (events) => {
      const now = timeRef.current
      const enemyTeam = selfTeamRef.current === 'ORDER' ? 'CHAOS' : 'ORDER'
      const fresh: LiveAlert[] = []
      let dragonTaken = false
      let baronTaken = false
      for (const event of events) {
        if (event.type === 'itemCompleted' && event.team === enemyTeam) {
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
      if (fresh.length === 0 && !dragonTaken && !baronTaken) return
      setInsights((previous) => ({
        alerts: [...fresh.reverse(), ...previous.alerts].slice(0, MAX_ALERTS),
        nextDragonS: dragonTaken ? now + DRAGON_RESPAWN_S : previous.nextDragonS,
        nextBaronS: baronTaken ? now + BARON_RESPAWN_S : previous.nextBaronS
      }))
    })
    return () => {
      offState()
      offEvents()
    }
  }, [])

  return insights
}

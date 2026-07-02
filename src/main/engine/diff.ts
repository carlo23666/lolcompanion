import type { GameState, GameStateEvent, PlayerState } from '@shared/gamestate'

/**
 * Deterministic semantic diff between two consecutive GameStates.
 * Players are matched by championName (unique within a game).
 * NO I/O in this module.
 */
export function diffGameStates(prev: GameState, next: GameState): GameStateEvent[] {
  const events: GameStateEvent[] = []

  const prevPlayers = new Map<string, PlayerState>()
  for (const player of [prev.self, ...prev.allies, ...prev.enemies]) {
    prevPlayers.set(player.championName, player)
  }

  for (const player of [next.self, ...next.allies, ...next.enemies]) {
    const before = prevPlayers.get(player.championName)
    if (!before) continue

    if (player.level > before.level) {
      events.push({
        type: 'levelUp',
        championName: player.championName,
        team: player.team,
        level: player.level
      })
    }
    if (player.isDead && !before.isDead) {
      events.push({ type: 'playerDied', championName: player.championName, team: player.team })
    }
    if (!player.isDead && before.isDead) {
      events.push({
        type: 'playerRespawned',
        championName: player.championName,
        team: player.team
      })
    }

    // New COMPLETED items (count-aware: duplicates like double Doran's count).
    const beforeCounts = new Map<number, number>()
    for (const item of before.items) {
      beforeCounts.set(item.id, (beforeCounts.get(item.id) ?? 0) + 1)
    }
    for (const item of player.items) {
      const remaining = beforeCounts.get(item.id) ?? 0
      if (remaining > 0) {
        beforeCounts.set(item.id, remaining - 1)
        continue
      }
      if (item.isCompleted) {
        events.push({
          type: 'itemCompleted',
          championName: player.championName,
          team: player.team,
          item
        })
      }
    }
  }

  for (const team of ['ORDER', 'CHAOS'] as const) {
    const newDragons = next.objectives.dragons[team].slice(prev.objectives.dragons[team].length)
    for (const subtype of newDragons) {
      events.push({ type: 'objectiveTaken', team, objective: 'dragon', detail: subtype })
    }
    if (next.objectives.barons[team] > prev.objectives.barons[team]) {
      events.push({ type: 'objectiveTaken', team, objective: 'baron' })
    }
    if (next.objectives.heralds[team] > prev.objectives.heralds[team]) {
      events.push({ type: 'objectiveTaken', team, objective: 'herald' })
    }
    for (let i = prev.objectives.towers[team]; i < next.objectives.towers[team]; i++) {
      events.push({ type: 'objectiveTaken', team, objective: 'tower' })
    }
  }

  return events
}

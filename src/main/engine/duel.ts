import type { MaterialAdvantageReason, MaterialAdvantageSignal } from '@shared/duel'
import type { GameState, PlayerState } from '@shared/gamestate'

const MIN_GAME_TIME_S = 5 * 60
const MIN_SELF_HEALTH = 0.55
const CLEAR_SCORE = 7

interface ScoredOpponent {
  signal: MaterialAdvantageSignal
  hasMaterialAnchor: boolean
}

function healthRatio(player: PlayerState): number | null {
  const health = player.visibleHealth
  if (health === undefined || health.max <= 0) return null
  return Math.max(0, Math.min(1, health.current / health.max))
}

function visibleItemValue(player: PlayerState): number {
  return player.items.reduce(
    (sum, item) => (item.tags.includes('Trinket') ? sum : sum + Math.max(0, item.totalGold)),
    0
  )
}

function completedPowerItems(player: PlayerState): number {
  return player.items.filter(
    (item) => item.isCompleted && !item.tags.includes('Trinket') && !item.tags.includes('Boots')
  ).length
}

function scoreOpponent(state: GameState, enemy: PlayerState): ScoredOpponent | null {
  if (enemy.isDead) return null
  const selfHealth = Math.max(
    0,
    Math.min(1, state.self.stats.currentHealth / Math.max(1, state.self.stats.maxHealth))
  )
  if (selfHealth < MIN_SELF_HEALTH) return null

  const enemyHealth = healthRatio(enemy)
  const levelLead = state.self.level - enemy.level
  const itemValueLead = visibleItemValue(state.self) - visibleItemValue(enemy)
  const completedLead = completedPowerItems(state.self) - completedPowerItems(enemy)
  const healthLead = enemyHealth === null ? 0 : selfHealth - enemyHealth
  const csLead = state.self.scores.creepScore - enemy.scores.creepScore
  const selfCombat = state.self.scores.kills - state.self.scores.deaths
  const enemyCombat = enemy.scores.kills - enemy.scores.deaths
  const kdaLead = selfCombat - enemyCombat

  let score = 0
  const weighted: { weight: number; reason: MaterialAdvantageReason }[] = []
  if (levelLead >= 2) {
    score += 4
    weighted.push({ weight: 4, reason: { kind: 'levels', amount: levelLead } })
  } else if (levelLead === 1) {
    score += 1
  }
  if (itemValueLead >= 1300) {
    score += 4
    weighted.push({ weight: 4, reason: { kind: 'itemValue', amount: itemValueLead } })
  } else if (itemValueLead >= 800) {
    score += 2
    weighted.push({ weight: 2, reason: { kind: 'itemValue', amount: itemValueLead } })
  }
  if (completedLead >= 2) {
    score += 4
    weighted.push({ weight: 5, reason: { kind: 'completedItems', amount: completedLead } })
  } else if (completedLead === 1 && itemValueLead >= 500) {
    score += 2
    weighted.push({ weight: 5, reason: { kind: 'completedItems', amount: completedLead } })
  }
  if (healthLead >= 0.25) {
    score += 2
    weighted.push({
      weight: 2,
      reason: { kind: 'health', amount: Math.round(healthLead * 100) }
    })
  } else if (healthLead >= 0.12) {
    score += 1
    weighted.push({
      weight: 1,
      reason: { kind: 'health', amount: Math.round(healthLead * 100) }
    })
  }
  if (csLead >= 35) {
    score += 1
    weighted.push({ weight: 1, reason: { kind: 'cs', amount: csLead } })
  }
  if (kdaLead >= 3) {
    score += 1
    weighted.push({ weight: 1, reason: { kind: 'kda', amount: kdaLead } })
  }

  const hasMaterialAnchor =
    levelLead >= 2 || itemValueLead >= 1100 || (completedLead >= 1 && itemValueLead >= 600)
  if (!hasMaterialAnchor || score < CLEAR_SCORE) return null

  const advantages = weighted
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((entry) => entry.reason)
  if (advantages.length < 2) return null
  return {
    hasMaterialAnchor,
    signal: {
      gameTimeS: state.gameTimeS,
      opponentChampionName: enemy.championName,
      score,
      advantages
    }
  }
}

/**
 * Returns the clearest isolated-duel advantage visible on the scoreboard.
 * It deliberately ignores estimated/hidden gold, cooldowns, fog and ally positions.
 */
export function materialAdvantageSignal(state: GameState): MaterialAdvantageSignal | null {
  if (state.gameTimeS < MIN_GAME_TIME_S || state.self.isDead) return null
  const sameRole = state.enemies.filter(
    (enemy) => state.self.position !== '' && enemy.position === state.self.position
  )
  const candidates = sameRole.length > 0 ? sameRole : state.enemies
  return (
    candidates
      .map((enemy) => scoreOpponent(state, enemy))
      .filter((entry): entry is ScoredOpponent => entry !== null)
      .sort((a, b) => b.signal.score - a.signal.score)[0]?.signal ?? null
  )
}

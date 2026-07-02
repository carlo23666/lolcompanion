import { HEALER_CHAMPION_WEIGHTS } from '../normalize'
import { THRESHOLDS } from './thresholds'
import { clampScore, itemCost, itemName, ownsAny, selfIsPhysical } from './helpers'
import type { Rule, RuleOutput } from './types'

/** Grievous wounds items: [cheap component, full item] per damage class. */
const ANTIHEAL_PHYSICAL = [3123, 6609] as const // Executioner's, Chempunk
const ANTIHEAL_MAGIC = [3916, 3165] as const // Oblivion Orb, Morellonomicon
const ALL_ANTIHEAL = [...ANTIHEAL_PHYSICAL, ...ANTIHEAL_MAGIC]

/**
 * Rule 1 — antiheal: enemy healing index over threshold → Grievous Wounds,
 * cheap component first, gold-aware.
 */
export const antihealRule: Rule = (state, staticData) => {
  const healingIndex = state.enemyAggregates.healingIndex
  if (healingIndex < THRESHOLDS.ANTIHEAL_MIN_INDEX) return []
  if (ownsAny(state.self, ALL_ANTIHEAL)) return []
  // An ally already carrying antiheal reduces urgency but self-coverage
  // still matters for our own targets; keep recommending, lower score.
  const allyHasIt = state.allies.some((ally) => ownsAny(ally, ALL_ANTIHEAL))

  const healers = state.enemies
    .filter((enemy) => (HEALER_CHAMPION_WEIGHTS[enemy.championId] ?? 0) > 0)
    .map((enemy) => enemy.championName)

  const [componentId] = selfIsPhysical(state) ? ANTIHEAL_PHYSICAL : ANTIHEAL_MAGIC
  const cost = itemCost(staticData, componentId)
  const gold = state.self.currentGold
  const affordable = gold >= cost

  const urgent = healingIndex >= THRESHOLDS.ANTIHEAL_URGENT_INDEX
  let score = urgent ? 75 : 55
  if (allyHasIt) score -= 15
  if (!affordable) score -= 10

  const reasons = [
    `Índice de curación enemiga ${healingIndex.toFixed(1)}${
      healers.length > 0 ? ` (${healers.join(', ')})` : ''
    } — heridas graves reduce su curación un 40%`
  ]
  reasons.push(
    affordable
      ? `${itemName(staticData, componentId)} cuesta ${String(cost)} de oro y llevas ${String(Math.floor(gold))}: cómpralo en la próxima base`
      : `${itemName(staticData, componentId)} cuesta ${String(cost)} de oro, te faltan ${String(Math.ceil(cost - gold))}`
  )
  if (allyHasIt) {
    reasons.push('Un aliado ya lleva antiheal; menos urgente pero cubre tus propios objetivos')
  }

  const output: RuleOutput = {
    ruleId: 'antiheal',
    itemId: componentId,
    action: affordable ? 'add' : 'delay',
    score: clampScore(score),
    reasons
  }
  return [output]
}

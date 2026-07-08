import { HEALER_CHAMPION_WEIGHTS } from '../normalize'
import { metaPickReason, metaPreferred } from '../meta-items'
import { THRESHOLDS } from './thresholds'
import { clampScore, defaultTranslator, itemCost, itemName, ownsAny, selfIsPhysical } from './helpers'
import type { Rule, RuleOutput } from './types'

/** Grievous wounds lines: [cheap component, ...full items] per damage class. */
const ANTIHEAL_PHYSICAL = [3123, 3033, 6609] as const // Executioner's, Mortal Reminder, Chempunk
const ANTIHEAL_MAGIC = [3916, 3165] as const // Oblivion Orb, Morellonomicon
const ANTIHEAL_FULL = [3033, 6609, 3165] as const // full items only (meta lookup)
const ALL_ANTIHEAL = [...ANTIHEAL_PHYSICAL, ...ANTIHEAL_MAGIC]

/**
 * Rule 1 — antiheal: enemy healing index over threshold → Grievous Wounds,
 * cheap component first, gold-aware. The LINE (physical vs magic) follows
 * what Master+ players buy on this champion; the own-damage heuristic only
 * decides when there is no meta signal. Antiheal is never capped — the need
 * is generic and the component is cheap.
 */
export const antihealRule: Rule = (state, staticData, meta, t = defaultTranslator) => {
  const healingIndex = state.enemyAggregates.healingIndex
  if (healingIndex < THRESHOLDS.ANTIHEAL_MIN_INDEX) return []
  if (ownsAny(state.self, ALL_ANTIHEAL)) return []
  // An ally already carrying antiheal reduces urgency but self-coverage
  // still matters for our own targets; keep recommending, lower score.
  const allyHasIt = state.allies.some((ally) => ownsAny(ally, ALL_ANTIHEAL))

  const healers = state.enemies
    .filter((enemy) => (HEALER_CHAMPION_WEIGHTS[enemy.championId] ?? 0) > 0)
    .map((enemy) => enemy.championName)

  // Master+ decides the line; self damage profile is only the tiebreak.
  const metaPick = metaPreferred(meta, ANTIHEAL_FULL)
  const physicalLine =
    metaPick !== null
      ? (ANTIHEAL_PHYSICAL as readonly number[]).includes(metaPick.itemId)
      : selfIsPhysical(state)
  const [componentId] = physicalLine ? ANTIHEAL_PHYSICAL : ANTIHEAL_MAGIC
  const cost = itemCost(staticData, componentId)
  const gold = state.self.currentGold
  const affordable = gold >= cost

  const urgent = healingIndex >= THRESHOLDS.ANTIHEAL_URGENT_INDEX
  let score = urgent ? 75 : 55
  if (allyHasIt) score -= 15
  if (!affordable) score -= 10

  const reasons = [
    t('engine.antiheal.index', {
      index: healingIndex.toFixed(1),
      healers: healers.length > 0 ? ` (${healers.join(', ')})` : ''
    })
  ]
  reasons.push(
    affordable
      ? t('engine.antiheal.buy', {
          item: itemName(staticData, componentId),
          cost: String(cost),
          gold: String(Math.floor(gold))
        })
      : t('engine.antiheal.short', {
          item: itemName(staticData, componentId),
          cost: String(cost),
          missing: String(Math.ceil(cost - gold))
        })
  )
  if (metaPick !== null) {
    reasons.push(
      metaPickReason(state.self.championName, itemName(staticData, metaPick.itemId), metaPick, t)
    )
  }
  if (allyHasIt) {
    reasons.push(t('engine.antiheal.allyHas'))
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

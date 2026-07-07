import type { GameState } from '@shared/gamestate'
import type { Recommendation } from '@shared/recommendation'
import type { StaticData } from '../staticdata/manager'
import type { MetaItemsInput } from './meta-items'
import { antihealRule } from './rules/antiheal'
import { antiBurstRule } from './rules/anti-burst'
import { antiTankRule } from './rules/anti-tank'
import { armorVsMrRule } from './rules/armor-vs-mr'
import { combine } from './rules/combiner'
import { spikeNowRule } from './rules/spike-now'
import type { Rule } from './rules/types'

export { normalizeSnapshot, estimateGoldEarned, playerDamageSplit } from './normalize'
export { diffGameStates } from './diff'
export { THRESHOLDS } from './rules/thresholds'
export { combine } from './rules/combiner'
export type { Rule, RuleOutput } from './rules/types'

export const RULES_V1: Rule[] = [
  antihealRule,
  armorVsMrRule,
  antiTankRule,
  antiBurstRule,
  spikeNowRule
]

/**
 * The engine: pure and synchronous, (GameState, StaticData, meta?) →
 * Recommendation[]. NO I/O anywhere below this call — `meta` is the caller's
 * snapshot of the champion's Master+ item distribution.
 */
export function runEngine(
  state: GameState,
  staticData: StaticData,
  meta?: MetaItemsInput
): Recommendation[] {
  const outputs = RULES_V1.flatMap((rule) => rule(state, staticData, meta))
  return combine(outputs, staticData)
}

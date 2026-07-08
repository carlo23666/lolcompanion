import { THRESHOLDS } from './thresholds'
import { defaultTranslator, itemName } from './helpers'
import type { Rule, RuleOutput } from './types'

/**
 * Rule 5 — spike-now: looks at components in the own inventory, finds the
 * cheapest reachable completion, and answers "buy now or wait N gold" for the
 * current recall. Boots tier-3 upgrades are excluded (feat-gated).
 */
export const spikeNowRule: Rule = (state, staticData, _meta, t = defaultTranslator) => {
  const gold = state.self.currentGold
  const graph = staticData.itemGraph

  interface Candidate {
    completionId: number
    missingGold: number
    /** Full item (not a component of something bigger). */
    isFinal: boolean
  }
  let best: Candidate | null = null

  const ownedCounts = new Map<number, number>()
  for (const item of state.self.items) {
    ownedCounts.set(item.id, (ownedCounts.get(item.id) ?? 0) + 1)
  }

  for (const item of state.self.items) {
    const node = graph.nodes.get(item.id)
    if (!node) continue
    // Upgrading finished tier-2 boots (tier-3 is feat-gated) is not a recall
    // decision; skip their upgrade paths entirely.
    if (node.tags.includes('Boots') && node.depth >= 2) continue
    for (const upgradeId of node.buildsInto) {
      const upgrade = graph.nodes.get(upgradeId)
      if (!upgrade || !upgrade.availableOnSR) continue
      // Missing cost = upgrade total minus every owned component that fits.
      let missing = upgrade.totalGold
      const used = new Map<number, number>()
      for (const componentId of upgrade.buildsFrom) {
        const available = (ownedCounts.get(componentId) ?? 0) - (used.get(componentId) ?? 0)
        if (available > 0) {
          missing -= graph.nodes.get(componentId)?.totalGold ?? 0
          used.set(componentId, (used.get(componentId) ?? 0) + 1)
        }
      }
      const isFinal = upgrade.buildsInto.length === 0
      // Prefer FINAL items over intermediate epics; among equals, cheapest.
      const better =
        best === null ||
        (isFinal && !best.isFinal) ||
        (isFinal === best.isFinal && missing < best.missingGold)
      if (better) {
        best = { completionId: upgradeId, missingGold: missing, isFinal }
      }
    }
  }

  if (best === null) return []
  const name = itemName(staticData, best.completionId)

  if (gold >= best.missingGold) {
    const output: RuleOutput = {
      ruleId: 'spike-now',
      itemId: best.completionId,
      action: 'prioritize',
      score: 70,
      reasons: [
        t('engine.spike.now', {
          item: name,
          cost: String(best.missingGold),
          gold: String(Math.floor(gold))
        }),
        t('engine.spike.nowExplain')
      ]
    }
    return [output]
  }

  const shortfall = Math.ceil(best.missingGold - gold)
  if (shortfall <= THRESHOLDS.SPIKE_WAIT_WINDOW_GOLD) {
    const output: RuleOutput = {
      ruleId: 'spike-now',
      itemId: best.completionId,
      action: 'delay',
      score: 50,
      reasons: [
        t('engine.spike.close', {
          shortfall: String(shortfall),
          item: name,
          remaining: String(best.missingGold),
          gold: String(Math.floor(gold))
        }),
        t('engine.spike.closeExplain')
      ]
    }
    return [output]
  }

  if (best.missingGold <= THRESHOLDS.SPIKE_MAX_MISSING_GOLD) {
    const output: RuleOutput = {
      ruleId: 'spike-now',
      itemId: best.completionId,
      action: 'add',
      score: 30,
      reasons: [
        t('engine.spike.target', { item: name, cost: String(Math.round(best.missingGold)) })
      ]
    }
    return [output]
  }

  return []
}

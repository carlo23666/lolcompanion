import type { Recommendation } from '@shared/recommendation'
import type { StaticData } from '../../staticdata/manager'
import type { RuleOutput } from './types'

const ACTION_PRIORITY = { prioritize: 0, add: 1, delay: 2 } as const

/**
 * Merges RuleOutputs into ranked Recommendations:
 * - grouped by itemId (or category when no item),
 * - score = max + 10 per extra supporting rule (capped at 100),
 * - all reasons kept (explainability is the product),
 * - strongest action wins (prioritize > add > delay).
 */
export function combine(outputs: RuleOutput[], staticData: StaticData): Recommendation[] {
  const groups = new Map<string, RuleOutput[]>()
  for (const output of outputs) {
    const key = output.itemId !== undefined ? `item:${String(output.itemId)}` : `cat:${output.category ?? 'general'}`
    const list = groups.get(key) ?? []
    list.push(output)
    groups.set(key, list)
  }

  const recommendations: Recommendation[] = []
  for (const group of groups.values()) {
    const first = group[0]
    if (!first) continue
    const maxScore = Math.max(...group.map((o) => o.score))
    const action = group.reduce(
      (strongest, o) => (ACTION_PRIORITY[o.action] < ACTION_PRIORITY[strongest] ? o.action : strongest),
      first.action
    )
    const reasons = [...new Set(group.flatMap((o) => o.reasons))]
    const itemId = first.itemId ?? null
    recommendations.push({
      itemId,
      itemName: itemId !== null ? (staticData.itemGraph.nodes.get(itemId)?.name ?? null) : null,
      category: first.category ?? null,
      action,
      score: Math.min(100, maxScore + (group.length - 1) * 10),
      reasons
    })
  }

  return recommendations.sort((a, b) => b.score - a.score)
}

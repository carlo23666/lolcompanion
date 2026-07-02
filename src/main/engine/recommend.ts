import type { GameState } from '@shared/gamestate'
import type { Recommendation } from '@shared/recommendation'
import type { BaselinePool } from '@shared/schemas/baselines'
import type { StaticData } from '../staticdata/manager'
import { runEngine } from './index'
import { findBaseline, loadBaselinePool, nextBuyRecommendation } from './nextbuy'

/**
 * Full recommendation pass: baseline next-buy + WP-007 rule adjustments.
 * Rule items that sit in the champion's situational slots get a boost.
 * Pure and synchronous.
 */
export function recommend(
  state: GameState,
  staticData: StaticData,
  pool: BaselinePool = loadBaselinePool()
): Recommendation[] {
  const baseline = findBaseline(pool, state.self.championId, state.self.position)
  const ruleRecommendations = runEngine(state, staticData).map((rec) => {
    if (rec.itemId !== null && baseline?.situational.includes(rec.itemId) === true) {
      return {
        ...rec,
        score: Math.min(100, rec.score + 10),
        reasons: [
          ...rec.reasons,
          `${rec.itemName ?? 'Este objeto'} está en tus situacionales de ${state.self.championName}`
        ]
      }
    }
    return rec
  })

  const nextBuy = nextBuyRecommendation(state, staticData, pool)
  const all = nextBuy ? [nextBuy, ...ruleRecommendations] : ruleRecommendations

  // Dedupe by item: keep the highest score, merge every reason.
  const byKey = new Map<string, Recommendation>()
  for (const rec of all) {
    const key = rec.itemId !== null ? `item:${String(rec.itemId)}` : `cat:${rec.category ?? 'general'}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, rec)
      continue
    }
    byKey.set(key, {
      ...(existing.score >= rec.score ? existing : rec),
      score: Math.min(100, Math.max(existing.score, rec.score) + 5),
      reasons: [...new Set([...existing.reasons, ...rec.reasons])]
    })
  }

  return [...byKey.values()].sort((a, b) => b.score - a.score)
}

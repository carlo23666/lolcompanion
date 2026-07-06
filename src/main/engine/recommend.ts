import type { GameState } from '@shared/gamestate'
import type { Recommendation } from '@shared/recommendation'
import type { BaselinePool } from '@shared/schemas/baselines'
import type { StaticData } from '../staticdata/manager'
import { runEngine } from './index'
import {
  endgameRecommendation,
  loadBaselinePool,
  nextBuyRecommendation,
  resolveBaseline,
  type MetaItemsInput
} from './nextbuy'

export type { MetaItemsInput } from './nextbuy'

/**
 * Full recommendation pass: baseline next-buy + WP-007 rule adjustments.
 * Rule items that sit in the champion's situational slots get a boost.
 * `meta` (optional, Master+ aggregates for the own champion+role) backs the
 * build advice when the champion is outside the owner's pool. Pure and
 * synchronous — the caller does any DB lookups.
 */
export function recommend(
  state: GameState,
  staticData: StaticData,
  pool: BaselinePool = loadBaselinePool(),
  meta?: MetaItemsInput
): Recommendation[] {
  const baseline = resolveBaseline(state, staticData, pool, meta)
  const ruleRecommendations = runEngine(state, staticData).map((rec) => {
    if (rec.itemId !== null && baseline?.situational.includes(rec.itemId) === true) {
      return {
        ...rec,
        score: Math.min(100, rec.score + 10),
        reasons: [
          ...rec.reasons,
          baseline.source === 'pool'
            ? `${rec.itemName ?? 'Este objeto'} está en tus situacionales de ${state.self.championName}`
            : `${rec.itemName ?? 'Este objeto'} es compra habitual en Master+ con ${state.self.championName}`
        ]
      }
    }
    return rec
  })

  // Core first; once it's done, the endgame layer fills slots 5-6 and flags
  // leftover starter items — the engine must never go silent mid-game.
  const nextBuy =
    nextBuyRecommendation(state, staticData, pool, meta) ??
    endgameRecommendation(state, staticData, pool, meta)
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
    const winner = existing.score >= rec.score ? existing : rec
    byKey.set(key, {
      ...winner,
      // 'replace' carries the "sell first" instruction — never lose it in a merge.
      action:
        existing.action === 'replace' || rec.action === 'replace' ? 'replace' : winner.action,
      score: Math.min(100, Math.max(existing.score, rec.score) + 5),
      reasons: [...new Set([...existing.reasons, ...rec.reasons])]
    })
  }

  return [...byKey.values()].sort((a, b) => b.score - a.score)
}

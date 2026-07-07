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
 * Full recommendation pass, Master+-first (owner request 2026-07-07): the
 * meta build is the primary baseline AND every rule receives the champion's
 * Master+ item distribution, so situational picks come from what top players
 * actually build (unbacked picks ship capped + labeled). The owner's pool
 * only backs champions without crawl data. Pure and synchronous — the caller
 * does any DB lookups.
 */
export function recommend(
  state: GameState,
  staticData: StaticData,
  pool: BaselinePool = loadBaselinePool(),
  meta?: MetaItemsInput
): Recommendation[] {
  const baseline = resolveBaseline(state, staticData, pool, meta)
  const ruleRecommendations = runEngine(state, staticData, meta).map((rec) => {
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

  // Master+ item winrate annotation: whenever an advised item has enough
  // sample on the OWN champion+role, say how it performs at the top — this
  // also surfaces meta data for pool champions (owner request 2026-07-06).
  const annotated = [...byKey.values()]
  if (meta !== undefined) {
    const statById = new Map(meta.items.map((entry) => [entry.itemId, entry]))
    for (const [index, rec] of annotated.entries()) {
      if (rec.itemId === null) continue
      const stat = statById.get(rec.itemId)
      if (stat === undefined || stat.games < META_ITEM_REASON_MIN_GAMES) continue
      const wr = Math.round((stat.wins / stat.games) * 100)
      annotated[index] = {
        ...rec,
        reasons: [
          ...rec.reasons,
          `en Master+ con ${state.self.championName}: ${String(wr)}% WR llevando este objeto (${String(stat.games)} partidas)`
        ]
      }
    }
  }

  return annotated.sort((a, b) => b.score - a.score)
}

/** Below this sample the per-item Master+ WR is noise, not a signal. */
const META_ITEM_REASON_MIN_GAMES = 10

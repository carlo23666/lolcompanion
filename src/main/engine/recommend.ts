import type { GameState } from '@shared/gamestate'
import type { Recommendation } from '@shared/recommendation'
import type { BaselinePool } from '@shared/schemas/baselines'
import type { Translator } from '@shared/i18n'
import type { StaticData } from '../staticdata/manager'
import { applyExclusivity } from './exclusivity'
import { defaultTranslator } from './rules/helpers'
import { runEngine } from './index'
import {
  endgameRecommendation,
  loadBaselinePool,
  nextBuyRecommendation,
  protectedCoreRemaining,
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
  meta?: MetaItemsInput,
  t: Translator = defaultTranslator,
  personal?: MetaItemsInput
): Recommendation[] {
  const baseline = resolveBaseline(state, staticData, pool, meta, personal)
  const protectedRemaining =
    baseline === null ? 0 : protectedCoreRemaining(state, staticData, baseline)
  const ruleRecommendations = runEngine(state, staticData, meta, t).map((rec) => {
    const protectedRec =
      protectedRemaining > 0
        ? {
            ...rec,
            kind: 'adaptation' as const,
            action: rec.action === 'delay' ? ('delay' as const) : ('add' as const),
            score: Math.min(rec.score, 45),
            reasons: [
              ...rec.reasons,
              t('engine.route.coreProtected', { remaining: String(protectedRemaining) })
            ]
          }
        : { ...rec, kind: 'adaptation' as const }
    if (
      protectedRec.itemId !== null &&
      baseline?.situational.includes(protectedRec.itemId) === true
    ) {
      const item = protectedRec.itemName ?? t('engine.word.thisItem')
      return {
        ...protectedRec,
        score: protectedRemaining > 0 ? protectedRec.score : Math.min(100, protectedRec.score + 10),
        reasons: [
          ...protectedRec.reasons,
          baseline.source === 'pool'
            ? t('engine.recommend.situPool', { item, champion: state.self.championName })
            : t('engine.endgame.situMeta', { item, champion: state.self.championName })
        ]
      }
    }
    return protectedRec
  })

  // Core first; once it's done, the endgame layer fills slots 5-6 and flags
  // leftover starter items — the engine must never go silent mid-game.
  const nextBuy =
    nextBuyRecommendation(state, staticData, pool, meta, t, personal) ??
    endgameRecommendation(state, staticData, pool, meta, t, personal)
  const all = nextBuy ? [nextBuy, ...ruleRecommendations] : ruleRecommendations

  // Dedupe by item: keep the highest score, merge every reason.
  const byKey = new Map<string, Recommendation>()
  for (const rec of all) {
    const key =
      rec.itemId !== null ? `item:${String(rec.itemId)}` : `cat:${rec.category ?? 'general'}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, rec)
      continue
    }
    const winner = existing.score >= rec.score ? existing : rec
    byKey.set(key, {
      ...winner,
      // 'replace' carries the "sell first" instruction — never lose it in a merge.
      action: existing.action === 'replace' || rec.action === 'replace' ? 'replace' : winner.action,
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
          t('engine.recommend.metaWr', {
            champion: state.self.championName,
            wr: String(wr),
            games: String(stat.games)
          })
        ]
      }
    }
  }

  // Exclusivity last: never advise an item incompatible with an owned one, and
  // between colliding candidates only the best-scored survives (WP-012).
  return applyExclusivity(
    annotated.sort((a, b) => b.score - a.score),
    state.self.items.map((item) => item.id),
    staticData,
    t
  )
}

/** Below this sample the per-item Master+ WR is noise, not a signal. */
const META_ITEM_REASON_MIN_GAMES = 10

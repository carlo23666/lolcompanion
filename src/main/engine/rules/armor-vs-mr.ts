import { metaBackedOptions, metaPickReason, metaUsage, SUGGESTION_SCORE_CAP } from '../meta-items'
import { THRESHOLDS } from './thresholds'
import { availableOptions, clampScore, defaultTranslator, itemName, ownsAny, pct } from './helpers'
import type { Rule, RuleOutput } from './types'

/** Defensive options per (damage type to resist, own class). Exported so the
 * champ-select tips advise the SAME items the in-game rule will push. */
export const ARMOR_TANK = [3075, 3143, 3110] as const // Thornmail, Randuin, Frozen Heart
export const ARMOR_SQUISHY = [3026, 3157] as const // Guardian Angel, Zhonya
export const MR_TANK = [3065, 4401] as const // Spirit Visage, Force of Nature
export const MR_SQUISHY = [3102, 2504] as const // Banshee, Kaenic Rookern

function isTanky(tags: string[]): boolean {
  return tags.includes('Tank') || tags.includes('Fighter')
}

/**
 * Rule 2 — armor-vs-mr: enemy damage split skewed → prioritize the matching
 * resist. Options are ordered by Master+ usage on the own champion (the
 * class-based lists only shape the candidate set); when Master+ players buy
 * none of them on this champion, the advice ships capped + labeled.
 */
export const armorVsMrRule: Rule = (state, staticData, meta, t = defaultTranslator) => {
  const outputs: RuleOutput[] = []
  const { physicalShare, magicShare } = state.enemyAggregates
  const selfTags = staticData.champions.get(state.self.championId)?.tags ?? []
  const tanky = isTanky(selfTags)
  // Phase awareness (WP-015): before the first completed item, a skewed comp
  // is a PLAN, not a purchase — no Master+ player opens with reactive resists.
  // Capped and labeled so it can never outrank the build path pre-first-back.
  const preFirstItem = !state.self.items.some((item) => item.isCompleted)

  const topDealers = (type: 'physical' | 'magic'): string[] =>
    state.enemies
      .filter((enemy) => enemy.damageType === type || enemy.damageType === 'mixed')
      .sort((a, b) => b.estimatedGoldEarned - a.estimatedGoldEarned)
      .slice(0, 3)
      .map((enemy) => {
        const damageItems = enemy.items.filter(
          (item) =>
            (item.stats['FlatPhysicalDamageMod'] ?? 0) > 0 ||
            (item.stats['FlatMagicDamageMod'] ?? 0) > 0
        ).length
        return damageItems > 0
          ? t('engine.armorMr.dealerItems', {
              champion: enemy.championName,
              count: String(damageItems)
            })
          : enemy.championName
      })

  // Every viable option becomes its own output (same reasons) so the UI can
  // show the alternatives; owning ANY of them means the advice is covered and
  // the rule goes silent.
  const pushOptions = (
    options: readonly number[],
    category: string,
    score: number,
    reasons: string[]
  ): void => {
    // Master+ anchor (WP-018): only resists this champion's Master+ players
    // actually build, most-used first. No meta-backed option → this champion
    // never buys a reactive resist here (e.g. a support vs an AD comp): stay
    // silent rather than invent an off-role item like Guardian Angel.
    const backed = metaBackedOptions(availableOptions(staticData, options), meta)
    if (backed.length === 0 || ownsAny(state.self, backed)) return
    // Pre-first-item a skewed comp is still a PLAN, not a purchase (WP-015):
    // capped + 'add' so it can't outrank the build path before the first back.
    const capped = preFirstItem
    backed.forEach((itemId, index) => {
      const stat = metaUsage(meta, itemId)
      outputs.push({
        ruleId: 'armor-vs-mr',
        itemId,
        category,
        action: preFirstItem ? 'add' : 'prioritize',
        // Alternatives rank right below the preferred option.
        score: capped
          ? Math.min(clampScore(score - index * 8), SUGGESTION_SCORE_CAP)
          : clampScore(score - index * 8),
        reasons: [
          ...reasons,
          ...(stat !== null
            ? [metaPickReason(state.self.championName, itemName(staticData, itemId), stat, t)]
            : []),
          ...(preFirstItem && index === 0 ? [t('engine.armorMr.preFirst')] : [])
        ]
      })
    })
  }

  if (physicalShare >= THRESHOLDS.DAMAGE_SKEW_SHARE) {
    const options = tanky ? ARMOR_TANK : ARMOR_SQUISHY
    pushOptions(
      options,
      t('engine.cat.armor'),
      clampScore(40 + (physicalShare - THRESHOLDS.DAMAGE_SKEW_SHARE) * 150),
      [
        t('engine.armorMr.physical', {
          pct: pct(physicalShare),
          dealers: topDealers('physical').join(', ')
        }),
        t('engine.armorMr.prioArmor', {
          items: options.map((id) => itemName(staticData, id)).join(' / ')
        })
      ]
    )
  }

  if (magicShare >= THRESHOLDS.DAMAGE_SKEW_SHARE) {
    const options = tanky ? MR_TANK : MR_SQUISHY
    pushOptions(
      options,
      t('engine.cat.mr'),
      clampScore(40 + (magicShare - THRESHOLDS.DAMAGE_SKEW_SHARE) * 150),
      [
        t('engine.armorMr.magic', {
          pct: pct(magicShare),
          dealers: topDealers('magic').join(', ')
        }),
        t('engine.armorMr.prioMr', {
          items: options.map((id) => itemName(staticData, id)).join(' / ')
        })
      ]
    )
  }

  return outputs
}

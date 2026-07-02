import { THRESHOLDS } from './thresholds'
import { availableOptions, clampScore, itemName, ownsAny, pct } from './helpers'
import type { Rule, RuleOutput } from './types'

/** Defensive options per (damage type to resist, own class). */
const ARMOR_TANK = [3075, 3143, 3110] as const // Thornmail, Randuin, Frozen Heart
const ARMOR_SQUISHY = [3026, 3157] as const // Guardian Angel, Zhonya
const MR_TANK = [3065, 4401] as const // Spirit Visage, Force of Nature
const MR_SQUISHY = [3102, 2504] as const // Banshee, Kaenic Rookern

function isTanky(tags: string[]): boolean {
  return tags.includes('Tank') || tags.includes('Fighter')
}

/**
 * Rule 2 — armor-vs-mr: enemy damage split skewed → prioritize the matching
 * resist, with concrete options for the own champion class.
 */
export const armorVsMrRule: Rule = (state, staticData) => {
  const outputs: RuleOutput[] = []
  const { physicalShare, magicShare } = state.enemyAggregates
  const selfTags = staticData.champions.get(state.self.championId)?.tags ?? []
  const tanky = isTanky(selfTags)

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
        return `${enemy.championName}${damageItems > 0 ? ` con ${String(damageItems)} objetos de daño` : ''}`
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
    const viable = availableOptions(staticData, options)
    if (viable.length === 0 || ownsAny(state.self, viable)) return
    viable.forEach((itemId, index) => {
      outputs.push({
        ruleId: 'armor-vs-mr',
        itemId,
        category,
        action: 'prioritize',
        // Alternatives rank right below the preferred option.
        score: clampScore(score - index * 8),
        reasons
      })
    })
  }

  if (physicalShare >= THRESHOLDS.DAMAGE_SKEW_SHARE) {
    const options = tanky ? ARMOR_TANK : ARMOR_SQUISHY
    pushOptions(
      options,
      'armadura',
      clampScore(40 + (physicalShare - THRESHOLDS.DAMAGE_SKEW_SHARE) * 150),
      [
        `El ${pct(physicalShare)} del daño enemigo estimado es físico (${topDealers('physical').join(', ')})`,
        `Prioriza armadura: ${options
          .map((id) => itemName(staticData, id))
          .join(' / ')} encajan con tu campeón`
      ]
    )
  }

  if (magicShare >= THRESHOLDS.DAMAGE_SKEW_SHARE) {
    const options = tanky ? MR_TANK : MR_SQUISHY
    pushOptions(
      options,
      'resistencia mágica',
      clampScore(40 + (magicShare - THRESHOLDS.DAMAGE_SKEW_SHARE) * 150),
      [
        `El ${pct(magicShare)} del daño enemigo estimado es mágico (${topDealers('magic').join(', ')})`,
        `Prioriza resistencia mágica: ${options
          .map((id) => itemName(staticData, id))
          .join(' / ')} encajan con tu campeón`
      ]
    )
  }

  return outputs
}

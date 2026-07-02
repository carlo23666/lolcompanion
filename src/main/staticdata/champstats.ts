import type { DdChampionStats } from '@shared/schemas/ddragon'

/**
 * Riot's stat growth formula: stats do NOT grow linearly per level.
 * statAtLevel(n) = base + growth * (n-1) * (0.7025 + 0.0175 * (n-1))
 * At level 18 the multiplier sums to exactly 17 * growth.
 * Source: League wiki "Champion statistic" (gold-standard community reference).
 */
export function growthMultiplier(level: number): number {
  const n = Math.min(Math.max(level, 1), 18)
  return (n - 1) * (0.7025 + 0.0175 * (n - 1))
}

export function statAtLevel(base: number, growth: number, level: number): number {
  return base + growth * growthMultiplier(level)
}

/** Attack speed growth is a PERCENT of base AS, not a flat add. */
export function attackSpeedAtLevel(
  baseAS: number,
  growthPercent: number,
  level: number
): number {
  return baseAS * (1 + (growthPercent / 100) * growthMultiplier(level))
}

export interface ChampionStatsAtLevel {
  hp: number
  armor: number
  magicResist: number
  attackDamage: number
  attackSpeed: number
}

export function championStatsAtLevel(
  stats: DdChampionStats,
  level: number
): ChampionStatsAtLevel {
  return {
    hp: statAtLevel(stats.hp, stats.hpperlevel, level),
    armor: statAtLevel(stats.armor, stats.armorperlevel, level),
    magicResist: statAtLevel(stats.spellblock, stats.spellblockperlevel, level),
    attackDamage: statAtLevel(stats.attackdamage, stats.attackdamageperlevel, level),
    attackSpeed: attackSpeedAtLevel(stats.attackspeed, stats.attackspeedperlevel, level)
  }
}

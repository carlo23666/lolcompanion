/**
 * Gold value per stat point, derived from the cheapest "pure" item granting
 * that stat (classic gold-efficiency method). Values recomputed against the
 * cached patch at load time would be ideal; these constants match the basic
 * items, whose gold/stat ratio has been stable for years:
 *  - AD:        Long Sword 350g / 10 AD            = 35 g
 *  - AP:        Amplifying Tome 400g / 20 AP       = 20 g
 *  - Armor:     Cloth Armor 300g / 15 armor        = 20 g
 *  - MR:        Null-Magic Mantle 400g / 25 MR     = 16 g
 *  - HP:        Ruby Crystal 400g / 150 HP         ≈ 2.67 g
 *  - AS:        Dagger 250g / 12% AS               ≈ 20.83 g per 1%
 *  - Crit:      Cloak of Agility 600g / 15% crit   = 40 g per 1%
 *  - Mana:      Sapphire Crystal 300g / 250 mana   = 1.2 g
 *  - HP regen:  Rejuvenation Bead 300g / 100% base ≈ 3 g per 1%
 *  - Move speed: Boots 300g / 25 flat MS           = 12 g
 */
export const GOLD_PER_STAT: Record<string, number> = {
  FlatPhysicalDamageMod: 35,
  FlatMagicDamageMod: 20,
  FlatArmorMod: 20,
  FlatSpellBlockMod: 16,
  FlatHPPoolMod: 2.67,
  PercentAttackSpeedMod: 2083, // ddragon stores 0.12 for 12%
  FlatCritChanceMod: 4000, // ddragon stores 0.15 for 15%
  FlatMPPoolMod: 1.2,
  FlatMovementSpeedMod: 12
}

export interface GoldEfficiency {
  /** Gold value of the item's valued stats. */
  statGoldValue: number
  /** statGoldValue / totalGold, as a percentage. 100 = exactly efficient. */
  efficiencyPct: number
  /** ddragon stat keys present on the item but not valued by the table. */
  unvaluedStats: string[]
}

export function goldEfficiency(
  stats: Record<string, number>,
  totalGold: number
): GoldEfficiency {
  let statGoldValue = 0
  const unvaluedStats: string[] = []
  for (const [key, amount] of Object.entries(stats)) {
    const perPoint = GOLD_PER_STAT[key]
    if (perPoint === undefined) {
      unvaluedStats.push(key)
      continue
    }
    statGoldValue += amount * perPoint
  }
  return {
    statGoldValue,
    efficiencyPct: totalGold > 0 ? (statGoldValue / totalGold) * 100 : 0,
    unvaluedStats
  }
}

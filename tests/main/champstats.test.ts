import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { championFileSchema } from '@shared/schemas/ddragon'
import {
  attackSpeedAtLevel,
  championStatsAtLevel,
  growthMultiplier,
  statAtLevel
} from '@main/staticdata/champstats'

const dir = join(import.meta.dirname, '..', '..', 'fixtures', 'ddragon', '16.13.1')
const champions = championFileSchema.parse(
  JSON.parse(readFileSync(join(dir, 'champion.json'), 'utf8'))
).data

describe('champion stat growth', () => {
  it('level 18 multiplier is exactly 17 (Riot formula)', () => {
    expect(growthMultiplier(18)).toBeCloseTo(17, 10)
  })

  it('Annie: hp at level 1 and 18 match base and base+17*growth', () => {
    const annie = champions['Annie']
    if (!annie) throw new Error('Annie missing from fixture')
    // Fixture: hp 560, hpperlevel 96
    expect(statAtLevel(annie.stats.hp, annie.stats.hpperlevel, 1)).toBe(560)
    expect(statAtLevel(annie.stats.hp, annie.stats.hpperlevel, 18)).toBeCloseTo(
      560 + 17 * 96,
      6
    )
    // Level 6 multiplier: 5 * (0.7025 + 0.0175*5) = 3.95
    expect(statAtLevel(annie.stats.hp, annie.stats.hpperlevel, 6)).toBeCloseTo(
      560 + 96 * 3.95,
      6
    )
  })

  it('Garen: armor growth at level 11', () => {
    const garen = champions['Garen']
    if (!garen) throw new Error('Garen missing from fixture')
    // multiplier(11) = 10 * (0.7025 + 0.0175*10) = 8.775
    const expected = garen.stats.armor + garen.stats.armorperlevel * 8.775
    expect(statAtLevel(garen.stats.armor, garen.stats.armorperlevel, 11)).toBeCloseTo(
      expected,
      6
    )
  })

  it('attack speed grows as percent of base', () => {
    const annie = champions['Annie']
    if (!annie) throw new Error('Annie missing from fixture')
    // Fixture: as 0.61, growth 1.36 (%). Level 18: 0.61 * (1 + 0.0136*17)
    expect(
      attackSpeedAtLevel(annie.stats.attackspeed, annie.stats.attackspeedperlevel, 18)
    ).toBeCloseTo(0.61 * (1 + 0.0136 * 17), 6)
  })

  it('clamps levels outside 1..18', () => {
    expect(growthMultiplier(0)).toBe(0)
    expect(growthMultiplier(25)).toBeCloseTo(17, 10)
  })

  it('championStatsAtLevel bundles the five combat stats', () => {
    const annie = champions['Annie']
    if (!annie) throw new Error('Annie missing from fixture')
    const at18 = championStatsAtLevel(annie.stats, 18)
    expect(at18.hp).toBeCloseTo(2192, 6)
    expect(at18.armor).toBeCloseTo(23 + 4 * 17, 6)
    expect(at18.magicResist).toBeCloseTo(30 + 1.3 * 17, 6)
  })
})

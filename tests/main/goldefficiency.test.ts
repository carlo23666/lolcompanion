import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { itemFileSchema } from '@shared/schemas/ddragon'
import { goldEfficiency } from '@main/staticdata/goldefficiency'

const dir = join(import.meta.dirname, '..', '..', 'fixtures', 'ddragon', '16.13.1')
const items = itemFileSchema.parse(
  JSON.parse(readFileSync(join(dir, 'item.json'), 'utf8'))
).data

describe('gold efficiency', () => {
  it('Long Sword is 100% efficient by construction', () => {
    const longSword = items['1036']
    if (!longSword) throw new Error('Long Sword missing')
    const { efficiencyPct } = goldEfficiency(longSword.stats, longSword.gold.total)
    expect(efficiencyPct).toBeCloseTo(100, 1)
  })

  it('Infinity Edge raw stat efficiency ≈ 103.6% (crit damage unvalued)', () => {
    const ie = items['3031']
    if (!ie) throw new Error('Infinity Edge missing')
    const result = goldEfficiency(ie.stats, ie.gold.total)
    // 75 AD * 35 + 0.25 crit * 4000 = 2625 + 1000 = 3625 → 3625/3500
    expect(result.statGoldValue).toBeCloseTo(3625, 0)
    expect(result.efficiencyPct).toBeCloseTo((3625 / 3500) * 100, 1)
  })

  it('reports stats it cannot value', () => {
    const result = goldEfficiency({ MadeUpStat: 10, FlatArmorMod: 15 }, 300)
    expect(result.unvaluedStats).toEqual(['MadeUpStat'])
    expect(result.statGoldValue).toBeCloseTo(300, 6)
  })

  it('handles zero-cost items without dividing by zero', () => {
    expect(goldEfficiency({}, 0).efficiencyPct).toBe(0)
  })
})

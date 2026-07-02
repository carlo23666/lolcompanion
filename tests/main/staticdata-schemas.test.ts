import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  championFileSchema,
  itemFileSchema,
  runesFileSchema
} from '@shared/schemas/ddragon'
import damageProfiles from '@main/staticdata/champion-damage-profile.json'

export const FIXTURE_PATCH = '16.13.1'
const dir = join(import.meta.dirname, '..', '..', 'fixtures', 'ddragon', FIXTURE_PATCH)
const readJson = (file: string): unknown => JSON.parse(readFileSync(join(dir, file), 'utf8'))

describe('Data Dragon schemas (real fixture files)', () => {
  it('parses item.json', () => {
    const parsed = itemFileSchema.parse(readJson('item.json'))
    expect(Object.keys(parsed.data).length).toBeGreaterThan(500)
  })

  it('parses champion.json', () => {
    const parsed = championFileSchema.parse(readJson('champion.json'))
    expect(Object.keys(parsed.data).length).toBeGreaterThan(160)
    expect(parsed.data['Annie']?.stats.hp).toBe(560)
  })

  it('parses runesReforged.json', () => {
    const parsed = runesFileSchema.parse(readJson('runesReforged.json'))
    expect(parsed.length).toBeGreaterThanOrEqual(5)
    const keys = parsed.map((tree) => tree.key)
    expect(keys).toContain('Domination')
  })

  it('rejects an item without gold info', () => {
    const broken = { version: 'x', data: { '1': { name: 'Broken' } } }
    expect(itemFileSchema.safeParse(broken).success).toBe(false)
  })
})

describe('champion damage profile table', () => {
  it('covers every champion in the current patch', () => {
    const parsed = championFileSchema.parse(readJson('champion.json'))
    const profiles = damageProfiles as Record<string, string>
    const missing = Object.keys(parsed.data).filter((id) => profiles[id] === undefined)
    expect(missing).toEqual([])
  })

  it('only contains valid damage types', () => {
    const invalid = Object.entries(damageProfiles as Record<string, string>).filter(
      ([key, value]) =>
        key !== '_comment' && !['physical', 'magic', 'mixed'].includes(value)
    )
    expect(invalid).toEqual([])
  })
})

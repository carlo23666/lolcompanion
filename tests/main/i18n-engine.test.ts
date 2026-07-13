import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { allGameDataSchema } from '@shared/schemas/liveclient'
import type { GameState } from '@shared/gamestate'
import { createTranslator } from '@shared/i18n'
import { normalizeSnapshot } from '@main/engine/normalize'
import { antihealRule } from '@main/engine/rules/antiheal'
import { armorVsMrRule } from '@main/engine/rules/armor-vs-mr'
import { recommend } from '@main/engine/recommend'
import type { StaticData } from '@main/staticdata/manager'
import { loadFixtureStaticData } from './helpers/staticdata'

const fixtureDir = join(import.meta.dirname, '..', '..', 'fixtures', 'liveclient')
const enT = createTranslator('en')

let staticData: StaticData
let mid: GameState

beforeAll(async () => {
  staticData = await loadFixtureStaticData()
  const snapshot = allGameDataSchema.parse(
    JSON.parse(readFileSync(join(fixtureDir, 'mid.json'), 'utf8'))
  )
  const state = normalizeSnapshot(snapshot, staticData)
  if (!state) throw new Error('normalize null')
  mid = state
})

describe('engine reasons honor the translator (ADR-009)', () => {
  it('antiheal renders English with the EN translator, Spanish by default', () => {
    const english = antihealRule(mid, staticData, undefined, enT)
    const spanish = antihealRule(mid, staticData) // default translator = es
    expect(english[0]?.reasons.join(' ')).toContain('Grievous Wounds')
    expect(english[0]?.reasons.join(' ')).not.toContain('de oro')
    expect(spanish[0]?.reasons.join(' ')).toContain('heridas graves')
    // Same structural output, only the language differs.
    expect(english[0]?.itemId).toBe(spanish[0]?.itemId)
    expect(english[0]?.action).toBe(spanish[0]?.action)
  })

  it('armor-vs-mr category + reasons localize', () => {
    const meta = { games: 300, items: [{ itemId: 3026, games: 40, wins: 22 }] }
    const threatened = structuredClone(mid)
    const zed = threatened.enemies.find((enemy) => enemy.championId === 'Zed')
    if (zed === undefined) throw new Error('fixture has no Zed')
    zed.scores.kills = 8
    zed.scores.deaths = 3
    const english = armorVsMrRule(threatened, staticData, meta, enT)
    expect(english[0]?.category).toBe('armor')
    expect(english[0]?.reasons[0]).toMatch(/of estimated enemy damage is physical/)
  })

  it('recommend() end-to-end produces English reasons', () => {
    const recs = recommend(mid, staticData, undefined, undefined, enT)
    const joined = recs.flatMap((rec) => rec.reasons).join(' ')
    expect(joined.length).toBeGreaterThan(0)
    // No stray Spanish leaked from the engine into the English pass.
    expect(joined).not.toMatch(/ de oro|Prioriza|heridas graves|situacional/)
  })
})

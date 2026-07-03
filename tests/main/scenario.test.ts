import { beforeAll, describe, expect, it } from 'vitest'
import { buildScenarioSnapshot } from '@main/devtools-scenario'
import { normalizeSnapshot } from '@main/engine/normalize'
import { recommend } from '@main/engine/recommend'
import type { StaticData } from '@main/staticdata/manager'
import { baselinePoolSchema } from '@shared/schemas/baselines'
import { allGameDataSchema } from '@shared/schemas/liveclient'
import type { GameScenario } from '@shared/scenario'
import { loadFixtureStaticData } from './helpers/staticdata'

let staticData: StaticData

const TEST_POOL = baselinePoolSchema.parse({
  champions: [
    {
      championId: 'Jinx',
      role: 'BOTTOM',
      core: [3006, 3031, 3085, 3036],
      situational: [3026, 3139, 3153]
    }
  ]
})

const SCENARIO: GameScenario = {
  gameTimeS: 18 * 60,
  gold: 2600,
  self: { champion: 'Jinx', position: 'BOTTOM', level: 11, items: [3031] },
  allies: [
    { champion: 'Ornn', position: 'TOP' },
    { champion: 'Vi', position: 'JUNGLE' },
    { champion: 'Ahri', position: 'MIDDLE' },
    { champion: 'Leona', position: 'UTILITY' }
  ],
  enemies: [
    { champion: 'Dr. Mundo', position: 'TOP', level: 12 },
    { champion: 'Kayn', position: 'JUNGLE' },
    { champion: 'Zed', position: 'MIDDLE', kills: 7 },
    { champion: 'Draven', position: 'BOTTOM' },
    { champion: 'Soraka', position: 'UTILITY' }
  ]
}

beforeAll(async () => {
  staticData = await loadFixtureStaticData()
})

describe('buildScenarioSnapshot', () => {
  it('produces a schema-valid snapshot that normalizes into a full GameState', () => {
    const { snapshot, errors } = buildScenarioSnapshot(SCENARIO, staticData)
    expect(errors).toEqual([])
    expect(snapshot).not.toBeNull()
    if (!snapshot) return
    expect(() => allGameDataSchema.parse(snapshot)).not.toThrow()

    const state = normalizeSnapshot(snapshot, staticData)
    expect(state).not.toBeNull()
    if (!state) return
    expect(state.self.championId).toBe('Jinx')
    expect(state.self.currentGold).toBe(2600)
    expect(state.allies).toHaveLength(4)
    expect(state.enemies).toHaveLength(5)
    expect(state.gameTimeS).toBe(1080)
  })

  it('the engine produces explained recommendations from a scenario', () => {
    const { snapshot } = buildScenarioSnapshot(SCENARIO, staticData)
    if (!snapshot) throw new Error('snapshot null')
    const state = normalizeSnapshot(snapshot, staticData)
    if (!state) throw new Error('state null')
    const recommendations = recommend(state, staticData, TEST_POOL)
    expect(recommendations.length).toBeGreaterThan(0)
    for (const rec of recommendations) {
      expect(rec.reasons.length).toBeGreaterThan(0)
    }
    // Soraka in the enemy comp: the antiheal rule should be visible.
    const all = recommendations.flatMap((rec) => rec.reasons).join(' ')
    expect(all).toContain('curación')
  })

  it('accepts ddragon ids and display names, rejects unknown champions', () => {
    const byId = buildScenarioSnapshot(
      { ...SCENARIO, self: { ...SCENARIO.self, champion: 'MonkeyKing' } },
      staticData
    )
    expect(byId.errors).toEqual([])
    expect(byId.snapshot?.allPlayers[0]?.championName).toBe('Wukong')

    const bad = buildScenarioSnapshot(
      { ...SCENARIO, self: { ...SCENARIO.self, champion: 'NoExiste' } },
      staticData
    )
    expect(bad.snapshot).toBeNull()
    expect(bad.errors.join(' ')).toContain('NoExiste')
  })

  it('magical footwear lands in the self runes', () => {
    const { snapshot } = buildScenarioSnapshot(
      { ...SCENARIO, magicalFootwear: true },
      staticData
    )
    const runeIds = (snapshot?.activePlayer.fullRunes?.generalRunes ?? []).map((rune) => rune.id)
    expect(runeIds).toContain(8304)

    const state = snapshot ? normalizeSnapshot(snapshot, staticData) : null
    expect(state?.self.runeIds).toContain(8304)
  })

  it('defaults level and creep score from the game time', () => {
    const { snapshot } = buildScenarioSnapshot(SCENARIO, staticData)
    const kayn = snapshot?.allPlayers.find((player) => player.championName === 'Kayn')
    expect(kayn?.level).toBeGreaterThanOrEqual(9)
    // Jungler CS defaults lower than a laner's.
    const draven = snapshot?.allPlayers.find((player) => player.championName === 'Draven')
    expect((kayn?.scores.creepScore ?? 0)).toBeLessThan(draven?.scores.creepScore ?? 0)
  })
})

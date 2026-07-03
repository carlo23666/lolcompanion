import { beforeAll, describe, expect, it } from 'vitest'
import { champSelectInsights, type OwnerHistoryRow } from '@main/champselect'
import type { StaticData } from '@main/staticdata/manager'
import { baselinePoolSchema } from '@shared/schemas/baselines'
import type { ChampSelectState } from '@shared/schemas/lcu'
import { loadFixtureStaticData } from './helpers/staticdata'

let staticData: StaticData

// Numeric ddragon keys used below: Ahri 103, Lux 99, Annie 1, Soraka 16,
// Aatrox 266, Yasuo 157, Zed 238, Draven 119, Jinx 222.
const AHRI = 103
const LUX = 99
const ANNIE = 1
const SORAKA = 16
const AATROX = 266
const YASUO = 157
const ZED = 238
const DRAVEN = 119
const JINX = 222

const TEST_POOL = baselinePoolSchema.parse({
  champions: [
    { championId: 'Jinx', role: 'BOTTOM', core: [3006, 3031], situational: [3026] }
  ]
})

function state(partial: Partial<ChampSelectState>): ChampSelectState {
  return {
    localPlayerCellId: 0,
    ownPosition: null,
    myTeam: [],
    theirTeam: [],
    bans: { mine: [], theirs: [] },
    timerPhase: null,
    ...partial
  }
}

function ally(
  cellId: number,
  championId: number,
  position = ''
): ChampSelectState['myTeam'][number] {
  return { cellId, championId, championPickIntent: 0, position }
}

beforeAll(async () => {
  staticData = await loadFixtureStaticData()
})

describe('champSelectInsights', () => {
  it('empty select: zero splits, no tips, no plan', () => {
    const insights = champSelectInsights(state({}), staticData, TEST_POOL)
    expect(insights.enemySplit.picked).toBe(0)
    expect(insights.tips).toEqual([])
    expect(insights.ownPlan).toBeNull()
  })

  it('AP-heavy enemy comp → magic resist tip with the cheap component', () => {
    const insights = champSelectInsights(
      state({ theirTeam: [AHRI, LUX, ANNIE, YASUO].map((id, i) => ({ cellId: i, championId: id })) }),
      staticData,
      TEST_POOL
    )
    expect(insights.enemySplit.magic).toBeGreaterThanOrEqual(3)
    expect(insights.tips.some((tip) => tip.includes('resistencia mágica'))).toBe(true)
  })

  it('AD-heavy enemy comp → armor tip', () => {
    const insights = champSelectInsights(
      state({ theirTeam: [AATROX, YASUO, ZED, DRAVEN].map((id, i) => ({ cellId: i, championId: id })) }),
      staticData,
      TEST_POOL
    )
    expect(insights.tips.some((tip) => tip.includes('armadura'))).toBe(true)
  })

  it('enemy healer → grievous wounds reminder', () => {
    const insights = champSelectInsights(
      state({ theirTeam: [{ cellId: 0, championId: SORAKA }, { cellId: 1, championId: YASUO }] }),
      staticData,
      TEST_POOL
    )
    expect(insights.tips.some((tip) => tip.includes('heridas graves'))).toBe(true)
  })

  it('own pick in the pool → plan with named core items', () => {
    const insights = champSelectInsights(
      state({
        localPlayerCellId: 2,
        ownPosition: 'bottom',
        myTeam: [ally(2, JINX, 'bottom')]
      }),
      staticData,
      TEST_POOL
    )
    expect(insights.ownPlan?.championId).toBe('Jinx')
    expect(insights.ownPlan?.core.map((item) => item.id)).toEqual([3006, 3031])
    expect(insights.ownPlan?.core.every((item) => item.name.length > 0)).toBe(true)
  })

  it('pick intent counts before locking', () => {
    const insights = champSelectInsights(
      state({
        localPlayerCellId: 2,
        ownPosition: 'bottom',
        myTeam: [{ cellId: 2, championId: 0, championPickIntent: JINX, position: 'bottom' }]
      }),
      staticData,
      TEST_POOL
    )
    expect(insights.ownPlan?.championId).toBe('Jinx')
    expect(insights.allySplit.picked).toBe(1)
  })

  it('pick suggestions: ranked from own history in the assigned role', () => {
    const history: OwnerHistoryRow[] = [
      // Jinx BOTTOM: 8W/2L. Kai'Sa BOTTOM: 4W/6L. Ahri MIDDLE: 5W/0L (other role).
      ...Array.from({ length: 10 }, (_, i) => ({
        champion: 'Jinx',
        role: 'BOTTOM',
        win: i < 8
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        champion: 'Kaisa',
        role: 'BOTTOM',
        win: i < 4
      })),
      ...Array.from({ length: 5 }, () => ({ champion: 'Ahri', role: 'MIDDLE', win: true }))
    ]
    const insights = champSelectInsights(
      state({ localPlayerCellId: 0, ownPosition: 'bottom', myTeam: [ally(0, 0, 'bottom')] }),
      staticData,
      TEST_POOL,
      history
    )
    // Ahri (other role) excluded; Jinx first (80% > Kai'Sa 40%).
    expect(insights.picks.map((pick) => pick.championId)).toEqual(['Jinx', 'Kaisa'])
    expect(insights.picks[0]?.reasons[0]).toContain('80% de victorias en 10 partidas')
    // Jinx is in the pool → the baseline note appears.
    expect(insights.picks[0]?.reasons.some((reason) => reason.includes('pool'))).toBe(true)
  })

  it('pick suggestions skip banned champions and disappear once locked', () => {
    const history: OwnerHistoryRow[] = Array.from({ length: 10 }, (_, i) => ({
      champion: 'Jinx',
      role: 'BOTTOM',
      win: i < 8
    }))
    const banned = champSelectInsights(
      state({
        localPlayerCellId: 0,
        ownPosition: 'bottom',
        myTeam: [ally(0, 0, 'bottom')],
        bans: { mine: [], theirs: [JINX] }
      }),
      staticData,
      TEST_POOL,
      history
    )
    expect(banned.picks).toEqual([])

    const locked = champSelectInsights(
      state({
        localPlayerCellId: 0,
        ownPosition: 'bottom',
        myTeam: [ally(0, DRAVEN, 'bottom')]
      }),
      staticData,
      TEST_POOL,
      history
    )
    expect(locked.picks).toEqual([])
  })

  it('pick suggestions favor the damage type the team lacks', () => {
    const history: OwnerHistoryRow[] = [
      // Two 50% champions in role: Draven (physical) and Ahri-as-ADC stand-in?
      // Use Jinx (physical) vs Ziggs-like: fixture-safe → use Ahri played BOTTOM.
      ...Array.from({ length: 6 }, (_, i) => ({ champion: 'Jinx', role: 'BOTTOM', win: i < 3 })),
      ...Array.from({ length: 6 }, (_, i) => ({ champion: 'Ahri', role: 'BOTTOM', win: i < 3 }))
    ]
    // Ally comp already all-physical → the magic pick should rank first.
    const insights = champSelectInsights(
      state({
        localPlayerCellId: 4,
        ownPosition: 'bottom',
        myTeam: [ally(0, AATROX), ally(1, YASUO), ally(2, ZED), ally(4, 0, 'bottom')]
      }),
      staticData,
      TEST_POOL,
      history
    )
    expect(insights.picks[0]?.championId).toBe('Ahri')
    expect(insights.picks[0]?.reasons.some((reason) => reason.includes('daño mágico'))).toBe(true)
  })

  it('all-AD ally team → diversification note', () => {
    const insights = champSelectInsights(
      state({
        myTeam: [AATROX, YASUO, ZED, DRAVEN, JINX].map((id, i) => ally(i, id))
      }),
      staticData,
      TEST_POOL
    )
    expect(insights.allySplit.physical).toBeGreaterThanOrEqual(4)
    expect(insights.tips.some((tip) => tip.includes('casi todo AD'))).toBe(true)
  })
})

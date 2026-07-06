import { beforeAll, describe, expect, it } from 'vitest'
import {
  champSelectInsights,
  loadChampionTraits,
  type MetaSource,
  type OwnerHistoryRow
} from '@main/champselect'
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

function row(
  champion: string,
  role: string,
  win: boolean,
  enemyChampions: string[] = []
): OwnerHistoryRow {
  return { champion, role, win, enemyChampions }
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
      ...Array.from({ length: 10 }, (_, i) => row('Jinx', 'BOTTOM', i < 8)),
      ...Array.from({ length: 10 }, (_, i) => row('Kaisa', 'BOTTOM', i < 4)),
      ...Array.from({ length: 5 }, () => row('Ahri', 'MIDDLE', true))
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
    const history: OwnerHistoryRow[] = Array.from({ length: 10 }, (_, i) =>
      row('Jinx', 'BOTTOM', i < 8)
    )
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
      // Two 50% champions in role: Jinx (physical) vs Ahri (magic) as ADC.
      ...Array.from({ length: 6 }, (_, i) => row('Jinx', 'BOTTOM', i < 3)),
      ...Array.from({ length: 6 }, (_, i) => row('Ahri', 'BOTTOM', i < 3))
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

  it('pick suggestions weigh the own record against the visible enemy comp', () => {
    const history: OwnerHistoryRow[] = [
      // Jinx and Kai'Sa both 50% overall — but Jinx is 4-0 vs Yasuo comps
      // and Kai'Sa 0-3 vs them.
      ...Array.from({ length: 4 }, () => row('Jinx', 'BOTTOM', true, ['Yasuo'])),
      ...Array.from({ length: 4 }, () => row('Jinx', 'BOTTOM', false)),
      ...Array.from({ length: 4 }, () => row('Kaisa', 'BOTTOM', true)),
      ...Array.from({ length: 4 }, (_, i) => row('Kaisa', 'BOTTOM', i > 2, ['Yasuo']))
    ]
    const insights = champSelectInsights(
      state({
        localPlayerCellId: 0,
        ownPosition: 'bottom',
        myTeam: [ally(0, 0, 'bottom')],
        theirTeam: [{ cellId: 5, championId: YASUO }]
      }),
      staticData,
      TEST_POOL,
      history
    )
    expect(insights.picks[0]?.championId).toBe('Jinx')
    expect(
      insights.picks[0]?.reasons.some((reason) => reason.includes('contra campeones de esta comp'))
    ).toBe(true)
  })

  it('pick suggestions favor frontline when the team has none', () => {
    const history: OwnerHistoryRow[] = [
      // Leona (Tank) and Lux (Mage) both 50% as support.
      ...Array.from({ length: 6 }, (_, i) => row('Leona', 'UTILITY', i < 3)),
      ...Array.from({ length: 6 }, (_, i) => row('Lux', 'UTILITY', i < 3))
    ]
    const insights = champSelectInsights(
      state({
        localPlayerCellId: 4,
        ownPosition: 'utility',
        // Squishy allies only: Ahri, Jinx, Draven.
        myTeam: [ally(0, AHRI), ally(1, JINX), ally(2, DRAVEN), ally(4, 0, 'utility')]
      }),
      staticData,
      TEST_POOL,
      history
    )
    expect(insights.picks[0]?.championId).toBe('Leona')
    expect(insights.picks[0]?.reasons.some((reason) => reason.includes('frontline'))).toBe(true)
  })

  it('pick suggestions blend Master+ winrates and lane matchups', () => {
    const history: OwnerHistoryRow[] = [
      // Both 50% personally over 8 games.
      ...Array.from({ length: 8 }, (_, i) => row('Jinx', 'BOTTOM', i < 4)),
      ...Array.from({ length: 8 }, (_, i) => row('Kaisa', 'BOTTOM', i < 4))
    ]
    // Meta strongly favors Kai'Sa overall and into Draven.
    const meta: MetaSource = {
      championWinrate: (champion) =>
        champion === 'Kaisa' ? { games: 400, wins: 230 } : { games: 400, wins: 190 },
      laneMatchup: (champion, _role, enemy) =>
        champion === 'Kaisa' && enemy === 'Draven' ? { games: 60, wins: 40 } : null
    }
    const insights = champSelectInsights(
      state({
        localPlayerCellId: 0,
        ownPosition: 'bottom',
        myTeam: [ally(0, 0, 'bottom')],
        theirTeam: [{ cellId: 5, championId: DRAVEN }]
      }),
      staticData,
      TEST_POOL,
      history,
      meta
    )
    expect(insights.picks[0]?.championId).toBe('Kaisa')
    const reasons = insights.picks[0]?.reasons.join(' | ') ?? ''
    expect(reasons).toContain('Master+ este parche')
    expect(reasons).toContain('en Master+ contra Draven')
  })

  it('meta samples below the thresholds are ignored', () => {
    const history: OwnerHistoryRow[] = [
      ...Array.from({ length: 8 }, (_, i) => row('Jinx', 'BOTTOM', i < 4))
    ]
    const meta: MetaSource = {
      championWinrate: () => ({ games: 10, wins: 9 }), // < 30 games
      laneMatchup: () => ({ games: 5, wins: 5 }) // < 10 games
    }
    const insights = champSelectInsights(
      state({
        localPlayerCellId: 0,
        ownPosition: 'bottom',
        myTeam: [ally(0, 0, 'bottom')],
        theirTeam: [{ cellId: 5, championId: DRAVEN }]
      }),
      staticData,
      TEST_POOL,
      history,
      meta
    )
    expect(insights.picks[0]?.reasons.some((reason) => reason.includes('Master+'))).toBe(false)
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

// Malphite 54, Leona 89 (numeric ddragon keys).
const MALPHITE = 54
const LEONA = 89

describe('champion traits (owner feedback 2026-07-06)', () => {
  it('every curated champion id exists in the current patch', () => {
    for (const championId of Object.keys(loadChampionTraits())) {
      expect(staticData.champions.has(championId), `traits: ${championId}`).toBe(true)
    }
  })

  it('AD-heavy comp with own ADC picked → carry defense, not tank armor', () => {
    const insights = champSelectInsights(
      state({
        localPlayerCellId: 0,
        ownPosition: 'bottom',
        myTeam: [ally(0, JINX, 'bottom')],
        theirTeam: [AATROX, YASUO, ZED, DRAVEN].map((id, i) => ({ cellId: i, championId: id }))
      }),
      staticData,
      TEST_POOL
    )
    const armorTip = insights.tips.find((tip) => tip.includes('muy AD'))
    const gaName = staticData.itemGraph.nodes.get(3026)?.name ?? 'GA'
    expect(armorTip).toContain('carry')
    expect(armorTip).toContain(gaName)
    // Jinx deals physical damage: the AP option (Zhonya) must not be offered.
    const zhonyaName = staticData.itemGraph.nodes.get(3157)?.name ?? 'Zhonya'
    expect(armorTip).not.toContain(zhonyaName)
  })

  it('tanky enemy comp → the tank-shredder outranks the equal-WR immobile ADC', () => {
    const history: OwnerHistoryRow[] = [
      ...Array.from({ length: 6 }, (_, i) => row('Vayne', 'BOTTOM', i < 3)),
      ...Array.from({ length: 6 }, (_, i) => row('Jinx', 'BOTTOM', i < 3))
    ]
    const insights = champSelectInsights(
      state({
        localPlayerCellId: 0,
        ownPosition: 'bottom',
        myTeam: [ally(0, 0, 'bottom')],
        theirTeam: [MALPHITE, LEONA].map((id, i) => ({ cellId: i, championId: id }))
      }),
      staticData,
      TEST_POOL,
      history
    )
    expect(insights.picks[0]?.championId).toBe('Vayne')
    expect(insights.picks[0]?.reasons.some((reason) => reason.includes('tanques'))).toBe(true)
    // The immobile low-shred pick carries the warning, not silence.
    const jinx = insights.picks.find((pick) => pick.championId === 'Jinx')
    expect(jinx?.reasons.some((reason) => reason.includes('cuesta matarlos'))).toBe(true)
  })

  it('no assigned position (blind pick): meta lookups use the most-played role', () => {
    const history: OwnerHistoryRow[] = Array.from({ length: 8 }, (_, i) =>
      row('Kaisa', 'BOTTOM', i < 4)
    )
    const meta: MetaSource = {
      championWinrate: (champion, role) =>
        champion === 'Kaisa' && role === 'BOTTOM' ? { games: 1800, wins: 900 } : null,
      laneMatchup: () => null
    }
    const insights = champSelectInsights(
      state({ localPlayerCellId: 0, ownPosition: null, myTeam: [ally(0, 0)] }),
      staticData,
      TEST_POOL,
      history,
      meta
    )
    expect(insights.picks[0]?.championId).toBe('Kaisa')
    expect(insights.picks[0]?.reasons.some((reason) => reason.includes('Master+'))).toBe(true)
  })

  it('unpicked but assigned BOTTOM: the armor tip already speaks carry', () => {
    const insights = champSelectInsights(
      state({
        localPlayerCellId: 0,
        ownPosition: 'bottom',
        myTeam: [ally(0, 0, 'bottom')],
        theirTeam: [AATROX, YASUO, ZED, DRAVEN].map((id, i) => ({ cellId: i, championId: id }))
      }),
      staticData,
      TEST_POOL
    )
    const armorTip = insights.tips.find((tip) => tip.includes('muy AD'))
    const gaName = staticData.itemGraph.nodes.get(3026)?.name ?? 'GA'
    expect(armorTip).toContain('carry')
    expect(armorTip).toContain(gaName)
  })

  it('assassin-heavy comp → mobility outranks the equal-WR immobile ADC', () => {
    const history: OwnerHistoryRow[] = [
      ...Array.from({ length: 6 }, (_, i) => row('Ezreal', 'BOTTOM', i < 3)),
      ...Array.from({ length: 6 }, (_, i) => row('Jinx', 'BOTTOM', i < 3))
    ]
    const insights = champSelectInsights(
      state({
        localPlayerCellId: 0,
        ownPosition: 'bottom',
        myTeam: [ally(0, 0, 'bottom')],
        theirTeam: [ZED, AHRI].map((id, i) => ({ cellId: i, championId: id }))
      }),
      staticData,
      TEST_POOL,
      history
    )
    expect(insights.picks[0]?.championId).toBe('Ezreal')
    expect(insights.picks[0]?.reasons.some((reason) => reason.includes('movilidad'))).toBe(true)
    const jinx = insights.picks.find((pick) => pick.championId === 'Jinx')
    expect(jinx?.reasons.some((reason) => reason.includes('inmóvil'))).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import {
  computeWeaknesses,
  extractWeaknessEvents,
  WEAKNESS_THRESHOLDS,
  type WeaknessGameInput
} from '@main/stats-weaknesses'

/** A clean, unremarkable game: nothing should fire on a pile of these. */
function cleanGame(overrides: Partial<WeaknessGameInput> = {}): WeaknessGameInput {
  return {
    durationS: 30 * 60,
    role: 'BOTTOM',
    win: true,
    kills: 6,
    deaths: 3,
    assists: 7,
    vision: 25, // ~0.83/min
    teamKills: 25,
    ownDeaths: [
      { ts: 8 * 60_000, enemyJunglerInvolved: false },
      { ts: 20 * 60_000, enemyJunglerInvolved: false },
      { ts: 28 * 60_000, enemyJunglerInvolved: false }
    ],
    enemyEliteKills: [{ ts: 15 * 60_000 }],
    ...overrides
  }
}

function games(count: number, overrides: Partial<WeaknessGameInput> = {}): WeaknessGameInput[] {
  return Array.from({ length: count }, () => cleanGame(overrides))
}

describe('computeWeaknesses', () => {
  it('stays silent on a healthy history', () => {
    expect(computeWeaknesses(games(12))).toEqual([])
  })

  it('stays silent below the minimum sample regardless of how bad the games are', () => {
    const disasters = games(WEAKNESS_THRESHOLDS.MIN_GAMES - 1, {
      deaths: 10,
      vision: 2,
      kills: 0,
      assists: 1
    })
    expect(computeWeaknesses(disasters)).toEqual([])
  })

  it('flags early-game deaths (dying in lane phase)', () => {
    const laneDisaster = games(10, {
      deaths: 5,
      ownDeaths: [
        { ts: 4 * 60_000, enemyJunglerInvolved: false },
        { ts: 7 * 60_000, enemyJunglerInvolved: false },
        { ts: 11 * 60_000, enemyJunglerInvolved: false },
        { ts: 20 * 60_000, enemyJunglerInvolved: false },
        { ts: 28 * 60_000, enemyJunglerInvolved: false }
      ]
    })
    const insights = computeWeaknesses(laneDisaster)
    const early = insights.find((insight) => insight.key === 'deaths-early')
    expect(early).toBeDefined()
    expect(early?.finding).toMatch(/\d/)
    expect(early?.advice.length).toBeGreaterThan(0)
  })

  it('flags gank susceptibility when the enemy jungler keeps killing you early', () => {
    const ganked = games(10, {
      ownDeaths: [
        { ts: 5 * 60_000, enemyJunglerInvolved: true },
        { ts: 10 * 60_000, enemyJunglerInvolved: true },
        { ts: 22 * 60_000, enemyJunglerInvolved: false }
      ]
    })
    const insights = computeWeaknesses(ganked)
    expect(insights.some((insight) => insight.key === 'gankable')).toBe(true)
  })

  it('flags low vision with a role-aware benchmark (support held higher)', () => {
    // 0.5 vision/min: fine for BOTTOM, terrible for UTILITY.
    const asAdc = computeWeaknesses(games(10, { vision: 15 }))
    expect(asAdc.some((insight) => insight.key === 'low-vision')).toBe(false)
    const asSupport = computeWeaknesses(games(10, { vision: 15, role: 'UTILITY' }))
    expect(asSupport.some((insight) => insight.key === 'low-vision')).toBe(true)
  })

  it('flags objectives falling while dead', () => {
    const feeder = games(10, {
      ownDeaths: [
        { ts: 14 * 60_000, enemyJunglerInvolved: false },
        { ts: 24 * 60_000, enemyJunglerInvolved: false }
      ],
      enemyEliteKills: [
        { ts: 14 * 60_000 + 30_000 }, // 30 s after a death → conceded
        { ts: 24 * 60_000 + 20_000 }, // conceded
        { ts: 8 * 60_000 } // clean
      ]
    })
    const insights = computeWeaknesses(feeder)
    const objectives = insights.find((insight) => insight.key === 'objectives-while-dead')
    expect(objectives).toBeDefined()
  })

  it('flags low kill participation', () => {
    const spectator = games(10, { kills: 1, assists: 3, teamKills: 30 })
    expect(
      computeWeaknesses(spectator).some((insight) => insight.key === 'low-kill-participation')
    ).toBe(true)
  })

  it('skips timeline detectors when few games carry timelines, keeps scalar ones', () => {
    const noTimelines = games(10, {
      kills: 1,
      assists: 3,
      teamKills: 30
    }).map((game) => ({ ...game, ownDeaths: undefined, enemyEliteKills: undefined }))
    const insights = computeWeaknesses(noTimelines)
    expect(insights.some((insight) => insight.key === 'low-kill-participation')).toBe(true)
    expect(insights.some((insight) => insight.key === 'gankable')).toBe(false)
    expect(insights.some((insight) => insight.key === 'deaths-early')).toBe(false)
  })

  it('orders insights high severity first', () => {
    const mess = games(10, {
      deaths: 6,
      vision: 6,
      role: 'UTILITY',
      kills: 0,
      assists: 2,
      teamKills: 30,
      ownDeaths: [
        { ts: 3 * 60_000, enemyJunglerInvolved: true },
        { ts: 6 * 60_000, enemyJunglerInvolved: true },
        { ts: 9 * 60_000, enemyJunglerInvolved: true },
        { ts: 12 * 60_000, enemyJunglerInvolved: false },
        { ts: 20 * 60_000, enemyJunglerInvolved: false },
        { ts: 30 * 60_000, enemyJunglerInvolved: false }
      ]
    })
    const insights = computeWeaknesses(mess)
    expect(insights.length).toBeGreaterThan(1)
    const severities = insights.map((insight) => insight.severity)
    const firstMedium = severities.indexOf('medium')
    const lastHigh = severities.lastIndexOf('high')
    if (firstMedium !== -1 && lastHigh !== -1) expect(lastHigh).toBeLessThan(firstMedium)
  })
})

describe('extractWeaknessEvents', () => {
  /** Own participantId 3; enemy jungler 7; enemy team 6-10. */
  const timeline = {
    metadata: { participants: ['P1', 'P2', 'OWN', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'] },
    info: {
      frames: [
        { events: [] },
        {
          events: [
            // Solo kill by mid: not a gank.
            { type: 'CHAMPION_KILL', timestamp: 300_000, killerId: 8, victimId: 3 },
            // Enemy jungler assists: gank.
            {
              type: 'CHAMPION_KILL',
              timestamp: 600_000,
              killerId: 9,
              victimId: 3,
              assistingParticipantIds: [7]
            },
            // Own team kills someone: irrelevant.
            { type: 'CHAMPION_KILL', timestamp: 700_000, killerId: 3, victimId: 9 }
          ]
        },
        {
          events: [
            // Enemy jungler kills own player directly: gank.
            { type: 'CHAMPION_KILL', timestamp: 780_000, killerId: 7, victimId: 3 },
            // Enemy takes a dragon.
            { type: 'ELITE_MONSTER_KILL', timestamp: 800_000, killerId: 7, monsterType: 'DRAGON' },
            // Own team takes a dragon: not conceded.
            { type: 'ELITE_MONSTER_KILL', timestamp: 900_000, killerId: 2, monsterType: 'DRAGON' }
          ]
        }
      ]
    }
  }

  it('collects own deaths (jungler involvement) and enemy elite kills', () => {
    const events = extractWeaknessEvents(timeline, {
      ownParticipantId: 3,
      enemyParticipantIds: new Set([6, 7, 8, 9, 10]),
      enemyJunglerIds: new Set([7])
    })
    expect(events.ownDeaths).toEqual([
      { ts: 300_000, enemyJunglerInvolved: false },
      { ts: 600_000, enemyJunglerInvolved: true },
      { ts: 780_000, enemyJunglerInvolved: true }
    ])
    expect(events.enemyEliteKills).toEqual([{ ts: 800_000 }])
  })
})

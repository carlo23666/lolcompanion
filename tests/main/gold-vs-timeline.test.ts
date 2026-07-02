import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { timelineSchema } from '@shared/schemas/riot'
import { estimateGoldEarned } from '@main/engine/normalize'

/**
 * Gold-model validation against a match timeline (WP-006 acceptance).
 * NOTE: currently runs against the synthetic timeline fixture — the shape is
 * realistic but the true calibration test needs real ingested timelines
 * (owner action; the same assertion is reused by the backtest harness).
 */
const timeline = timelineSchema.parse(
  JSON.parse(
    readFileSync(join(import.meta.dirname, '..', '..', 'fixtures', 'riot', 'timeline.json'), 'utf8')
  )
)

function scoresAtFrame(minute: number, participantId: number): {
  kills: number
  assists: number
  creepScore: number
} {
  let kills = 0
  let assists = 0
  for (const frame of timeline.info.frames) {
    if (frame.timestamp > minute * 60000) break
    for (const event of frame.events) {
      if (event.type !== 'CHAMPION_KILL') continue
      if (event.killerId === participantId) kills += 1
      const assisters = (event as Record<string, unknown>)['assistingParticipantIds']
      if (Array.isArray(assisters) && assisters.includes(participantId)) assists += 1
    }
  }
  const frame = timeline.info.frames.find((f) => f.timestamp === minute * 60000)
  const pf = frame?.participantFrames[String(participantId)]
  if (!pf) throw new Error(`no frame for participant ${String(participantId)} at min ${String(minute)}`)
  return { kills, assists, creepScore: pf.minionsKilled + pf.jungleMinionsKilled }
}

describe('gold estimation vs timeline (±15%)', () => {
  for (const minute of [10, 20]) {
    it(`all 10 participants within ±15% at minute ${String(minute)}`, () => {
      const frame = timeline.info.frames.find((f) => f.timestamp === minute * 60000)
      if (!frame) throw new Error('frame missing')
      for (let p = 1; p <= 10; p++) {
        const actual = frame.participantFrames[String(p)]?.totalGold
        if (actual === undefined) throw new Error('participant frame missing')
        const estimate = estimateGoldEarned(minute * 60, scoresAtFrame(minute, p))
        const deviation = Math.abs(estimate - actual) / actual
        expect(deviation, `participant ${String(p)} deviation ${(deviation * 100).toFixed(1)}%`).toBeLessThan(0.15)
      }
    })
  }
})

import { readFileSync, readdirSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@main/db'
import { MatchRepo, TimelineRepo } from '@main/db/repos'
import { SettingsRepo, SETTING_KEYS } from '@main/db/repos/settings'
import { reconstructFrames } from '@main/backtest/reconstruct'
import { runBacktest } from '@main/backtest/harness'
import { runCliBacktest } from '@main/backtest/cli'
import { matchToRows } from '@main/riot/ingest'
import type { StaticData } from '@main/staticdata/manager'
import { matchSchema, timelineSchema } from '@shared/schemas/riot'
import { loadFixtureStaticData } from './helpers/staticdata'

const fixtureDir = join(import.meta.dirname, '..', '..', 'fixtures', 'riot')
const match = matchSchema.parse(JSON.parse(readFileSync(join(fixtureDir, 'match.json'), 'utf8')))
const timeline = timelineSchema.parse(
  JSON.parse(readFileSync(join(fixtureDir, 'timeline.json'), 'utf8'))
)
const OWNER = 'PUUID_PLAYER_3' // Jinx

let staticData: StaticData
beforeAll(async () => {
  staticData = await loadFixtureStaticData()
})

describe('reconstructFrames (sanity — WP-011 acceptance)', () => {
  it('gold at every frame matches the timeline exactly (it is the source)', () => {
    const frames = reconstructFrames(match, timeline, OWNER, staticData)
    expect(frames.length).toBe(31)
    for (const frame of frames) {
      const pf = timeline.info.frames.find((f) => Math.round(f.timestamp / 60000) === frame.minute)
        ?.participantFrames['3']
      expect(frame.state.self.estimatedGoldEarned).toBe(pf?.totalGold)
      expect(frame.state.self.currentGold).toBe(pf?.currentGold)
    }
  })

  it('items at the final frame match the final build (trinket excluded)', () => {
    const frames = reconstructFrames(match, timeline, OWNER, staticData)
    const last = frames[frames.length - 1]
    if (!last) throw new Error('no frames')
    const reconstructed = last.state.self.items.map((item) => item.id).sort((a, b) => a - b)
    const ownerParticipant = match.info.participants.find((p) => p.puuid === OWNER)
    if (!ownerParticipant) throw new Error('owner missing')
    const finalBuild = [
      ownerParticipant.item0,
      ownerParticipant.item1,
      ownerParticipant.item2,
      ownerParticipant.item3,
      ownerParticipant.item4,
      ownerParticipant.item5
    ]
      .filter((id) => id > 0)
      .sort((a, b) => a - b)
    expect(reconstructed).toEqual(finalBuild)
  })

  it('levels come from the frames and kills from the event feed', () => {
    const frames = reconstructFrames(match, timeline, OWNER, staticData)
    const atMin12 = frames.find((frame) => frame.minute === 12)
    expect(atMin12?.state.self.level).toBe(
      timeline.info.frames.find((f) => f.timestamp === 12 * 60000)?.participantFrames['3']?.level
    )
    // p3 killed p8 at min 10.
    expect(atMin12?.state.self.scores.kills).toBe(1)
    const atMin9 = frames.find((frame) => frame.minute === 9)
    expect(atMin9?.state.self.scores.kills).toBe(0)
  })

  it('objectives accumulate from elite monster and building events', () => {
    const frames = reconstructFrames(match, timeline, OWNER, staticData)
    const last = frames[frames.length - 1]
    // Synthetic timeline: dragon (killerId 5, team ORDER) + tower of team 200.
    expect(last?.state.objectives.dragons.ORDER).toEqual(['FIRE'])
    expect(last?.state.objectives.towers.ORDER).toBe(1)
  })

  it('actualNextPurchase points at the next COMPLETED purchase only', () => {
    const frames = reconstructFrames(match, timeline, OWNER, staticData)
    // Before min 14 the next completed purchase is the IE (3031) at min 14.
    expect(frames.find((frame) => frame.minute === 5)?.actualNextPurchase).toBe(3031)
    // Between IE and Berserker's (min 19): next is 3006.
    expect(frames.find((frame) => frame.minute === 16)?.actualNextPurchase).toBe(3006)
    // After the last completed purchase (LDR at min 27): null.
    expect(frames.find((frame) => frame.minute === 30)?.actualNextPurchase).toBeNull()
  })
})

describe('runBacktest', () => {
  it('produces agreement metrics and disagreement samples without errors', () => {
    const report = runBacktest(
      [
        { match, timeline, ownerPuuid: OWNER },
        { match, timeline, ownerPuuid: OWNER }
      ],
      staticData
    )
    expect(report.errors).toEqual([])
    expect(report.matches).toBe(2)
    expect(report.frames).toBe(62)
    expect(report.comparisons).toBeGreaterThan(10)
    expect(report.top1Rate).toBeGreaterThanOrEqual(0)
    expect(report.top1Rate).toBeLessThanOrEqual(1)
    expect(report.top3Rate).toBeGreaterThanOrEqual(report.top1Rate)
    expect(report.byChampion['Jinx']?.comparisons).toBe(report.comparisons)
    const phaseSum =
      report.byPhase.early.comparisons +
      report.byPhase.mid.comparisons +
      report.byPhase.late.comparisons
    expect(phaseSum).toBe(report.comparisons)
    for (const disagreement of report.disagreements) {
      expect(disagreement.actualName).not.toBe('')
      expect(disagreement.top3.length).toBeGreaterThan(0)
    }
  })

  it('scores hits where the fixture follows the baseline and misses where it deviates', () => {
    // The synthetic player builds IE BEFORE boots (deviating from the
    // baseline core order), then buys Berserker's exactly when the baseline
    // expects it. The harness must report both honestly. Uses a fixed pool
    // (the fixture was authored against it), not the owner's evolving one.
    const testPool = {
      champions: [
        {
          championId: 'Jinx',
          role: 'BOTTOM' as const,
          core: [3006, 3031, 3085, 3036],
          situational: [3026, 3139, 3153]
        }
      ]
    }
    const report = runBacktest([{ match, timeline, ownerPuuid: OWNER }], staticData, testPool)
    // Hits exist (the Berserker's window, frames 14+).
    expect(report.byPhase.mid.top1Hits).toBeGreaterThanOrEqual(3)
    // Misses exist (early frames: actual IE vs baseline boots-first).
    expect(report.disagreements.length).toBeGreaterThan(0)
    expect(
      report.disagreements.some(
        (disagreement) => disagreement.actual === 3031 && disagreement.minute < 14
      )
    ).toBe(true)
    expect(report.top3Rate).toBeGreaterThan(0.1)
    expect(report.top3Rate).toBeLessThan(0.9)
  })
})

describe('runCliBacktest (end to end over a real DB file)', () => {
  it('reads the DB, runs the harness and writes the JSON report', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'backtest-'))
    const dbPath = join(dir, 'test.db')
    const db = new Database(dbPath)
    runMigrations(db)
    new SettingsRepo(db).set(SETTING_KEYS.puuid, OWNER)
    const { row, participants } = matchToRows(match)
    new MatchRepo(db).insertMatch(row, match, participants)
    new TimelineRepo(db).insertTimeline(match.metadata.matchId, timeline)
    db.close()

    const report = await runCliBacktest({
      dbPath,
      staticDataDir: join(import.meta.dirname, '..', '..', 'fixtures', 'ddragon'),
      reportsDir: dir,
      last: 50,
      now: () => new Date('2026-07-02T12:00:00Z')
    })
    expect(report.matches).toBe(1)
    expect(report.errors).toEqual([])
    const reportFile = readdirSync(dir).find((file) => file.startsWith('backtest-'))
    expect(reportFile).toBeDefined()
    rmSync(dir, { recursive: true, force: true })
  })

  it('filters by champion', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'backtest-'))
    const dbPath = join(dir, 'test.db')
    const db = new Database(dbPath)
    runMigrations(db)
    new SettingsRepo(db).set(SETTING_KEYS.puuid, OWNER)
    const { row, participants } = matchToRows(match)
    new MatchRepo(db).insertMatch(row, match, participants)
    new TimelineRepo(db).insertTimeline(match.metadata.matchId, timeline)
    db.close()

    const report = await runCliBacktest({
      dbPath,
      staticDataDir: join(import.meta.dirname, '..', '..', 'fixtures', 'ddragon'),
      reportsDir: dir,
      champion: 'Teemo'
    })
    expect(report.matches).toBe(0)
    rmSync(dir, { recursive: true, force: true })
  })
})

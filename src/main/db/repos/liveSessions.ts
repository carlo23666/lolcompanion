import { gzipSync, gunzipSync } from 'node:zlib'
import { z } from 'zod'
import type { AppDatabase } from '../index'

export interface LiveSessionRow {
  id: number
  startedAt: string
  patch: string | null
  championName: string | null
  result: string | null
  matchId: string | null
  /** Live Client gameMode (e.g. CLASSIC, PRACTICETOOL). NULL on old rows. */
  gameMode: string | null
}

const storedJsonSchema = z.record(z.string(), z.unknown())

/**
 * live_sessions + live_snapshots. Snapshots are stored gzip-compressed: a
 * full game at 2s cadence is ~900 snapshots × ~30KB raw JSON ≈ 27MB, which
 * would blow the 20MB-per-game budget; gzip brings it down ~10×.
 */
export class LiveSessionRepo {
  constructor(private readonly db: AppDatabase) {}

  createSession(
    startedAt: string,
    championName: string | null,
    patch: string | null,
    gameMode: string | null = null
  ): number {
    const result = this.db
      .prepare(
        'INSERT INTO live_sessions (startedAt, championName, patch, gameMode) VALUES (?, ?, ?, ?)'
      )
      .run(startedAt, championName, patch, gameMode)
    return Number(result.lastInsertRowid)
  }

  appendSnapshot(sessionId: number, gameTimeS: number, raw: unknown): void {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO live_snapshots (sessionId, gameTimeS, raw) VALUES (?, ?, ?)'
      )
      .run(sessionId, gameTimeS, gzipSync(JSON.stringify(raw)))
  }

  setResult(sessionId: number, result: string, matchId: string | null): void {
    this.db
      .prepare('UPDATE live_sessions SET result = ?, matchId = ? WHERE id = ?')
      .run(result, matchId, sessionId)
  }

  /** Post-game link: attaches the published match to the live session. */
  linkMatch(sessionId: number, link: { matchId: string; result: string; patch: string }): void {
    this.db
      .prepare('UPDATE live_sessions SET matchId = ?, result = ?, patch = ? WHERE id = ?')
      .run(link.matchId, link.result, link.patch, sessionId)
  }

  getSession(id: number): LiveSessionRow | null {
    const row = this.db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(id) as
      | LiveSessionRow
      | undefined
    return row ?? null
  }

  latestSessions(limit: number): LiveSessionRow[] {
    return this.db
      .prepare('SELECT * FROM live_sessions ORDER BY id DESC LIMIT ?')
      .all(limit) as LiveSessionRow[]
  }

  /** Newest session linked to a given match (report recommendations lookup). */
  sessionByMatchId(matchId: string): LiveSessionRow | null {
    const row = this.db
      .prepare('SELECT * FROM live_sessions WHERE matchId = ? ORDER BY id DESC LIMIT 1')
      .get(matchId) as LiveSessionRow | undefined
    return row ?? null
  }

  /** Newest session without a linked match, for post-game linking (WP-010). */
  latestUnlinkedSession(): LiveSessionRow | null {
    const row = this.db
      .prepare('SELECT * FROM live_sessions WHERE matchId IS NULL ORDER BY id DESC LIMIT 1')
      .get() as LiveSessionRow | undefined
    return row ?? null
  }

  getSnapshots(sessionId: number): { gameTimeS: number; raw: Record<string, unknown> }[] {
    const rows = this.db
      .prepare(
        'SELECT gameTimeS, raw FROM live_snapshots WHERE sessionId = ? ORDER BY gameTimeS'
      )
      .all(sessionId) as { gameTimeS: number; raw: Buffer }[]
    return rows.map((row) => ({
      gameTimeS: row.gameTimeS,
      raw: storedJsonSchema.parse(JSON.parse(gunzipSync(row.raw).toString('utf8')))
    }))
  }

  snapshotCount(sessionId: number): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM live_snapshots WHERE sessionId = ?')
      .get(sessionId) as { n: number }
    return row.n
  }

  /** Persists the recommendations emitted at a given game time (WP-009). */
  appendRecommendations(sessionId: number, gameTimeS: number, recommendations: unknown): void {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO live_recommendations (sessionId, gameTimeS, recommendations) VALUES (?, ?, ?)'
      )
      .run(sessionId, gameTimeS, JSON.stringify(recommendations))
  }

  getRecommendations(sessionId: number): { gameTimeS: number; recommendations: unknown }[] {
    const rows = this.db
      .prepare(
        'SELECT gameTimeS, recommendations FROM live_recommendations WHERE sessionId = ? ORDER BY gameTimeS'
      )
      .all(sessionId) as { gameTimeS: number; recommendations: string }[]
    return rows.map((row) => ({
      gameTimeS: row.gameTimeS,
      recommendations: storedJsonArraySchema.parse(JSON.parse(row.recommendations))
    }))
  }
}

const storedJsonArraySchema = z.array(z.unknown())

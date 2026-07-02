import { z } from 'zod'
import type { AppDatabase } from '../index'

/**
 * Row shapes for the matches/participants/timelines tables.
 * `raw` columns store the original Riot payload; they are validated as JSON
 * objects on read (full match-v5 schema validation happens at ingestion time,
 * WP-004 — reads only re-check structural integrity).
 */
export interface MatchRow {
  matchId: string
  queueId: number
  patch: string
  gameCreation: number
  durationS: number
  win: boolean | null
}

export interface ParticipantRow {
  matchId: string
  puuid: string
  champion: string
  role: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  gold: number
  damage: number
  vision: number
  items: [number, number, number, number, number, number, number]
}

const storedJsonSchema = z.record(z.string(), z.unknown())

interface DbMatchRow {
  matchId: string
  queueId: number
  patch: string
  gameCreation: number
  durationS: number
  win: number | null
}

interface DbParticipantRow {
  matchId: string
  puuid: string
  champion: string
  role: string
  win: number
  kills: number
  deaths: number
  assists: number
  cs: number
  gold: number
  damage: number
  vision: number
  item0: number
  item1: number
  item2: number
  item3: number
  item4: number
  item5: number
  item6: number
}

function toMatchRow(row: DbMatchRow): MatchRow {
  return {
    matchId: row.matchId,
    queueId: row.queueId,
    patch: row.patch,
    gameCreation: row.gameCreation,
    durationS: row.durationS,
    win: row.win === null ? null : row.win === 1
  }
}

function toParticipantRow(row: DbParticipantRow): ParticipantRow {
  return {
    matchId: row.matchId,
    puuid: row.puuid,
    champion: row.champion,
    role: row.role,
    win: row.win === 1,
    kills: row.kills,
    deaths: row.deaths,
    assists: row.assists,
    cs: row.cs,
    gold: row.gold,
    damage: row.damage,
    vision: row.vision,
    items: [row.item0, row.item1, row.item2, row.item3, row.item4, row.item5, row.item6]
  }
}

export class MatchRepo {
  constructor(private readonly db: AppDatabase) {}

  /** Idempotent: inserting the same matchId twice leaves a single row. */
  insertMatch(match: MatchRow, raw: unknown, participants: ParticipantRow[]): boolean {
    const insertMatch = this.db.prepare(
      `INSERT OR IGNORE INTO matches (matchId, queueId, patch, gameCreation, durationS, win, raw)
       VALUES (@matchId, @queueId, @patch, @gameCreation, @durationS, @win, @raw)`
    )
    const insertParticipant = this.db.prepare(
      `INSERT OR IGNORE INTO participants
       (matchId, puuid, champion, role, win, kills, deaths, assists, cs, gold, damage, vision,
        item0, item1, item2, item3, item4, item5, item6)
       VALUES (@matchId, @puuid, @champion, @role, @win, @kills, @deaths, @assists, @cs, @gold,
        @damage, @vision, @item0, @item1, @item2, @item3, @item4, @item5, @item6)`
    )
    let inserted = false
    this.db.transaction(() => {
      const result = insertMatch.run({
        matchId: match.matchId,
        queueId: match.queueId,
        patch: match.patch,
        gameCreation: match.gameCreation,
        durationS: match.durationS,
        win: match.win === null ? null : match.win ? 1 : 0,
        raw: JSON.stringify(raw)
      })
      inserted = result.changes > 0
      if (!inserted) return
      for (const p of participants) {
        insertParticipant.run({
          matchId: p.matchId,
          puuid: p.puuid,
          champion: p.champion,
          role: p.role,
          win: p.win ? 1 : 0,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          cs: p.cs,
          gold: p.gold,
          damage: p.damage,
          vision: p.vision,
          item0: p.items[0],
          item1: p.items[1],
          item2: p.items[2],
          item3: p.items[3],
          item4: p.items[4],
          item5: p.items[5],
          item6: p.items[6]
        })
      }
    })()
    return inserted
  }

  hasMatch(matchId: string): boolean {
    return (
      this.db.prepare('SELECT 1 FROM matches WHERE matchId = ?').get(matchId) !== undefined
    )
  }

  getMatch(matchId: string): MatchRow | null {
    const row = this.db
      .prepare('SELECT matchId, queueId, patch, gameCreation, durationS, win FROM matches WHERE matchId = ?')
      .get(matchId) as DbMatchRow | undefined
    return row ? toMatchRow(row) : null
  }

  /** Raw Riot payload, re-validated as a JSON object on read. */
  getMatchRaw(matchId: string): Record<string, unknown> | null {
    const row = this.db.prepare('SELECT raw FROM matches WHERE matchId = ?').get(matchId) as
      | { raw: string }
      | undefined
    if (!row) return null
    return storedJsonSchema.parse(JSON.parse(row.raw))
  }

  latestMatches(limit: number): MatchRow[] {
    const rows = this.db
      .prepare(
        `SELECT matchId, queueId, patch, gameCreation, durationS, win
         FROM matches ORDER BY gameCreation DESC LIMIT ?`
      )
      .all(limit) as DbMatchRow[]
    return rows.map(toMatchRow)
  }

  getMatchesByChampion(champion: string, puuid: string, limit = 50): MatchRow[] {
    const rows = this.db
      .prepare(
        `SELECT m.matchId, m.queueId, m.patch, m.gameCreation, m.durationS, m.win
         FROM matches m
         JOIN participants p ON p.matchId = m.matchId
         WHERE p.champion = ? AND p.puuid = ?
         ORDER BY m.gameCreation DESC LIMIT ?`
      )
      .all(champion, puuid, limit) as DbMatchRow[]
    return rows.map(toMatchRow)
  }

  getParticipants(matchId: string): ParticipantRow[] {
    const rows = this.db
      .prepare('SELECT * FROM participants WHERE matchId = ?')
      .all(matchId) as DbParticipantRow[]
    return rows.map(toParticipantRow)
  }

  matchIds(): Set<string> {
    const rows = this.db.prepare('SELECT matchId FROM matches').all() as { matchId: string }[]
    return new Set(rows.map((row) => row.matchId))
  }

  /** Matches joined with the owner's participant row, newest first. */
  ownerMatches(
    puuid: string,
    options: { champion?: string; limit?: number } = {}
  ): { match: MatchRow; own: ParticipantRow }[] {
    const filter = options.champion !== undefined ? 'AND p.champion = @champion' : ''
    const rows = this.db
      .prepare(
        `SELECT m.matchId AS m_matchId, m.queueId, m.patch, m.gameCreation, m.durationS, m.win AS m_win,
                p.*
         FROM matches m
         JOIN participants p ON p.matchId = m.matchId
         WHERE p.puuid = @puuid ${filter}
         ORDER BY m.gameCreation DESC LIMIT @limit`
      )
      .all(
        options.champion !== undefined
          ? { puuid, champion: options.champion, limit: options.limit ?? 100 }
          : { puuid, limit: options.limit ?? 100 }
      ) as (DbParticipantRow & {
      m_matchId: string
      queueId: number
      patch: string
      gameCreation: number
      durationS: number
      m_win: number | null
    })[]
    return rows.map((row) => ({
      match: toMatchRow({
        matchId: row.m_matchId,
        queueId: row.queueId,
        patch: row.patch,
        gameCreation: row.gameCreation,
        durationS: row.durationS,
        win: row.m_win
      }),
      own: toParticipantRow(row)
    }))
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM matches').get() as { n: number }
    return row.n
  }
}

export class TimelineRepo {
  constructor(private readonly db: AppDatabase) {}

  /** Idempotent per matchId. */
  insertTimeline(matchId: string, raw: unknown): boolean {
    const result = this.db
      .prepare('INSERT OR IGNORE INTO timelines (matchId, raw) VALUES (?, ?)')
      .run(matchId, JSON.stringify(raw))
    return result.changes > 0
  }

  hasTimeline(matchId: string): boolean {
    return (
      this.db.prepare('SELECT 1 FROM timelines WHERE matchId = ?').get(matchId) !== undefined
    )
  }

  getTimelineRaw(matchId: string): Record<string, unknown> | null {
    const row = this.db.prepare('SELECT raw FROM timelines WHERE matchId = ?').get(matchId) as
      | { raw: string }
      | undefined
    if (!row) return null
    return storedJsonSchema.parse(JSON.parse(row.raw))
  }

  matchIdsWithTimeline(): Set<string> {
    const rows = this.db.prepare('SELECT matchId FROM timelines').all() as {
      matchId: string
    }[]
    return new Set(rows.map((row) => row.matchId))
  }
}

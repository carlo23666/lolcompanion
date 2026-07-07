import type { MetaSeed } from '@shared/schemas/meta-seed'
import type { MetaMatchAggregate } from '../../riot/meta-aggregate'
import { comparePatchDesc } from '../../staticdata/manager'
import type { AppDatabase } from '../index'

export interface MetaWinrate {
  patch: string
  games: number
  wins: number
}

export interface MetaItemStat {
  itemId: number
  games: number
  wins: number
}

/**
 * Aggregated Master+ meta statistics (migration 005). Reads pick the newest
 * patch that actually has data (numeric patch comparison — "16.9" < "16.13").
 */
export class MetaRepo {
  constructor(private readonly db: AppDatabase) {}

  hasMatch(matchId: string): boolean {
    return (
      this.db.prepare('SELECT 1 FROM meta_matches WHERE matchId = ?').get(matchId) !== undefined
    )
  }

  /** Applies one match's deltas atomically; idempotent per matchId. */
  applyAggregate(aggregate: MetaMatchAggregate): boolean {
    const mark = this.db.prepare('INSERT OR IGNORE INTO meta_matches (matchId, patch) VALUES (?, ?)')
    const bumpStat = this.db.prepare(
      `INSERT INTO meta_champion_stats (patch, champion, role, games, wins) VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(patch, champion, role) DO UPDATE SET games = games + 1, wins = wins + excluded.wins`
    )
    const bumpMatchup = this.db.prepare(
      `INSERT INTO meta_matchups (patch, champion, role, enemyChampion, games, wins) VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(patch, champion, role, enemyChampion) DO UPDATE SET games = games + 1, wins = wins + excluded.wins`
    )
    const bumpItem = this.db.prepare(
      `INSERT INTO meta_champion_items (patch, champion, role, itemId, games, wins) VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(patch, champion, role, itemId) DO UPDATE SET games = games + 1, wins = wins + excluded.wins`
    )
    let applied = false
    this.db.transaction(() => {
      const inserted = mark.run(aggregate.matchId, aggregate.patch).changes > 0
      if (!inserted) return // already aggregated (dedupe/resume)
      applied = true
      for (const stat of aggregate.championStats) {
        bumpStat.run(aggregate.patch, stat.champion, stat.role, stat.win ? 1 : 0)
      }
      for (const matchup of aggregate.matchups) {
        bumpMatchup.run(
          aggregate.patch,
          matchup.champion,
          matchup.role,
          matchup.enemyChampion,
          matchup.win ? 1 : 0
        )
      }
      for (const item of aggregate.items) {
        bumpItem.run(aggregate.patch, item.champion, item.role, item.itemId, item.win ? 1 : 0)
      }
    })()
    return applied
  }

  /** Marks a fetched-but-unusable match so it is never fetched again. */
  markSkipped(matchId: string): void {
    this.db
      .prepare('INSERT OR IGNORE INTO meta_matches (matchId, patch) VALUES (?, ?)')
      .run(matchId, 'skip')
  }

  /** Newest patch (numeric order) with any aggregated data. */
  latestPatch(): string | null {
    const rows = this.db
      .prepare("SELECT DISTINCT patch FROM meta_matches WHERE patch != 'skip'")
      .all() as { patch: string }[]
    const patches = rows.map((row) => row.patch).sort(comparePatchDesc)
    return patches[0] ?? null
  }

  championWinrate(champion: string, role: string, patch: string): MetaWinrate | null {
    const row = this.db
      .prepare(
        'SELECT games, wins FROM meta_champion_stats WHERE patch = ? AND champion = ? AND role = ?'
      )
      .get(patch, champion, role) as { games: number; wins: number } | undefined
    return row ? { patch, ...row } : null
  }

  laneMatchup(
    champion: string,
    role: string,
    enemyChampion: string,
    patch: string
  ): MetaWinrate | null {
    const row = this.db
      .prepare(
        `SELECT games, wins FROM meta_matchups
         WHERE patch = ? AND champion = ? AND role = ? AND enemyChampion = ?`
      )
      .get(patch, champion, role, enemyChampion) as { games: number; wins: number } | undefined
    return row ? { patch, ...row } : null
  }

  /** Most-bought final items for a champion+role, most games first. */
  topItems(champion: string, role: string, patch: string, limit: number): MetaItemStat[] {
    return this.db
      .prepare(
        `SELECT itemId, games, wins FROM meta_champion_items
         WHERE patch = ? AND champion = ? AND role = ?
         ORDER BY games DESC LIMIT ?`
      )
      .all(patch, champion, role, limit) as MetaItemStat[]
  }

  /** The champion's most-played role at Master+ (for role-less lobbies). */
  topRoleFor(champion: string, patch: string): string | null {
    const row = this.db
      .prepare(
        `SELECT role FROM meta_champion_stats
         WHERE patch = ? AND champion = ? AND role != ''
         ORDER BY games DESC LIMIT 1`
      )
      .get(patch, champion) as { role: string } | undefined
    return row?.role ?? null
  }

  /**
   * Champion item distribution with ROLE FALLBACK: custom/blind lobbies carry
   * no assigned position, and a role with no crawl data says nothing — in
   * both cases fall back to the champion's most-played Master+ role so the
   * engine never goes silent for lack of a label (owner report 2026-07-07).
   */
  itemsFor(
    champion: string,
    role: string,
    patch: string,
    limit: number
  ): { role: string; games: number; items: MetaItemStat[] } | null {
    const direct = role === '' ? null : this.championWinrate(champion, role, patch)
    let effectiveRole = role
    let winrate = direct
    if (winrate === null) {
      const fallback = this.topRoleFor(champion, patch)
      if (fallback === null) return null
      effectiveRole = fallback
      winrate = this.championWinrate(champion, fallback, patch)
      if (winrate === null) return null
    }
    return {
      role: effectiveRole,
      games: winrate.games,
      items: this.topItems(champion, effectiveRole, patch, limit)
    }
  }

  /** Everything needed to seed another install, for the given patch. */
  exportSeed(patch: string): Omit<MetaSeed, 'version' | 'exportedAt'> {
    const matchIds = (
      this.db.prepare('SELECT matchId FROM meta_matches WHERE patch = ?').all(patch) as {
        matchId: string
      }[]
    ).map((row) => row.matchId)
    const championStats = this.db
      .prepare('SELECT champion, role, games, wins FROM meta_champion_stats WHERE patch = ?')
      .all(patch) as MetaSeed['championStats']
    const matchups = this.db
      .prepare(
        'SELECT champion, role, enemyChampion, games, wins FROM meta_matchups WHERE patch = ?'
      )
      .all(patch) as MetaSeed['matchups']
    const items = this.db
      .prepare('SELECT champion, role, itemId, games, wins FROM meta_champion_items WHERE patch = ?')
      .all(patch) as MetaSeed['items']
    return { patch, matchIds, championStats, matchups, items }
  }

  /**
   * Imports a seed into an EMPTY meta store (only-empty rule: aggregates
   * can't be merged with partially-overlapping local crawls without double
   * counting). The seed's matchIds land in the ledger, so a local crawl
   * started later skips them cleanly.
   */
  importSeed(seed: MetaSeed): boolean {
    if (this.latestPatch() !== null) return false
    const mark = this.db.prepare('INSERT OR IGNORE INTO meta_matches (matchId, patch) VALUES (?, ?)')
    const putStat = this.db.prepare(
      'INSERT OR REPLACE INTO meta_champion_stats (patch, champion, role, games, wins) VALUES (?, ?, ?, ?, ?)'
    )
    const putMatchup = this.db.prepare(
      'INSERT OR REPLACE INTO meta_matchups (patch, champion, role, enemyChampion, games, wins) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const putItem = this.db.prepare(
      'INSERT OR REPLACE INTO meta_champion_items (patch, champion, role, itemId, games, wins) VALUES (?, ?, ?, ?, ?, ?)'
    )
    this.db.transaction(() => {
      for (const matchId of seed.matchIds) mark.run(matchId, seed.patch)
      for (const row of seed.championStats) {
        putStat.run(seed.patch, row.champion, row.role, row.games, row.wins)
      }
      for (const row of seed.matchups) {
        putMatchup.run(seed.patch, row.champion, row.role, row.enemyChampion, row.games, row.wins)
      }
      for (const row of seed.items) {
        putItem.run(seed.patch, row.champion, row.role, row.itemId, row.games, row.wins)
      }
    })()
    return true
  }

  /** Aggregated matches per patch (status panel). */
  status(): { patch: string; matches: number }[] {
    const rows = this.db
      .prepare(
        "SELECT patch, COUNT(*) AS matches FROM meta_matches WHERE patch != 'skip' GROUP BY patch"
      )
      .all() as { patch: string; matches: number }[]
    return rows.sort((a, b) => comparePatchDesc(a.patch, b.patch))
  }
}

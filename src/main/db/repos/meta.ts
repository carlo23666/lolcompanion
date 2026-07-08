import type { MetaSeed } from '@shared/schemas/meta-seed'
import type { MetaMatchAggregate, MetaOrderAggregate } from '../../riot/meta-aggregate'
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
  /** Completion-order stats (migration 006); absent until timelines land. */
  orderGames?: number
  slotSum?: number
  firstGames?: number
}

export interface MetaOrderStat {
  itemId: number
  orderGames: number
  slotSum: number
  firstGames: number
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

  /**
   * Applies one timeline's order deltas atomically. Idempotency rides the
   * hasTimeline flag: the first call per match wins, repeats are no-ops.
   * Requires the match to be in the ledger (applyAggregate/importSeed first).
   */
  applyOrderAggregate(aggregate: MetaOrderAggregate): boolean {
    const claim = this.db.prepare(
      'UPDATE meta_matches SET hasTimeline = 1 WHERE matchId = ? AND hasTimeline = 0'
    )
    const bump = this.db.prepare(
      `INSERT INTO meta_champion_item_order (patch, champion, role, itemId, games, slotSum, firstGames)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(patch, champion, role, itemId) DO UPDATE SET
         games = games + 1, slotSum = slotSum + excluded.slotSum,
         firstGames = firstGames + excluded.firstGames`
    )
    let applied = false
    this.db.transaction(() => {
      if (claim.run(aggregate.matchId).changes === 0) return
      applied = true
      for (const row of aggregate.items) {
        bump.run(aggregate.patch, row.champion, row.role, row.itemId, row.slot, row.first ? 1 : 0)
      }
    })()
    return applied
  }

  /** Aggregated matches still missing their timeline pass (backfill queue). */
  matchesNeedingTimeline(limit: number): string[] {
    return (
      this.db
        .prepare(
          `SELECT matchId FROM meta_matches
           WHERE hasTimeline = 0 AND patch != 'skip' LIMIT ?`
        )
        .all(limit) as { matchId: string }[]
    ).map((row) => row.matchId)
  }

  /** Completion-order stats for a champion+role. */
  orderStatsFor(champion: string, role: string, patch: string): MetaOrderStat[] {
    return this.db
      .prepare(
        `SELECT itemId, games AS orderGames, slotSum, firstGames
         FROM meta_champion_item_order
         WHERE patch = ? AND champion = ? AND role = ?`
      )
      .all(patch, champion, role) as MetaOrderStat[]
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

  /** Most-bought final items for a champion+role (order stats joined in). */
  topItems(champion: string, role: string, patch: string, limit: number): MetaItemStat[] {
    const rows = this.db
      .prepare(
        `SELECT i.itemId, i.games, i.wins,
                o.games AS orderGames, o.slotSum, o.firstGames
         FROM meta_champion_items i
         LEFT JOIN meta_champion_item_order o
           ON o.patch = i.patch AND o.champion = i.champion
          AND o.role = i.role AND o.itemId = i.itemId
         WHERE i.patch = ? AND i.champion = ? AND i.role = ?
         ORDER BY i.games DESC LIMIT ?`
      )
      .all(patch, champion, role, limit) as (MetaItemStat & {
      orderGames: number | null
      slotSum: number | null
      firstGames: number | null
    })[]
    return rows.map((row) => ({
      itemId: row.itemId,
      games: row.games,
      wins: row.wins,
      ...(row.orderGames !== null
        ? { orderGames: row.orderGames, slotSum: row.slotSum ?? 0, firstGames: row.firstGames ?? 0 }
        : {})
    }))
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
    const itemOrder = this.db
      .prepare(
        `SELECT champion, role, itemId, games, slotSum, firstGames
         FROM meta_champion_item_order WHERE patch = ?`
      )
      .all(patch) as NonNullable<MetaSeed['itemOrder']>
    return { patch, matchIds, championStats, matchups, items, itemOrder }
  }

  /**
   * Imports a seed into an EMPTY meta store (only-empty rule: aggregates
   * can't be merged with partially-overlapping local crawls without double
   * counting). The seed's matchIds land in the ledger, so a local crawl
   * started later skips them cleanly.
   */
  importSeed(seed: MetaSeed): boolean {
    if (this.latestPatch() !== null) return false
    // A seed carrying order rows already contains whatever timeline data the
    // exporter had; re-backfilling those matches locally would double-count
    // the slots, so their ledger rows arrive with hasTimeline = 1. v1 seeds
    // (no order rows) leave the flag at 0 → a local crawl may backfill.
    const hasOrderData = (seed.itemOrder?.length ?? 0) > 0
    const mark = this.db.prepare(
      'INSERT OR IGNORE INTO meta_matches (matchId, patch, hasTimeline) VALUES (?, ?, ?)'
    )
    const putStat = this.db.prepare(
      'INSERT OR REPLACE INTO meta_champion_stats (patch, champion, role, games, wins) VALUES (?, ?, ?, ?, ?)'
    )
    const putMatchup = this.db.prepare(
      'INSERT OR REPLACE INTO meta_matchups (patch, champion, role, enemyChampion, games, wins) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const putItem = this.db.prepare(
      'INSERT OR REPLACE INTO meta_champion_items (patch, champion, role, itemId, games, wins) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const putOrder = this.db.prepare(
      `INSERT OR REPLACE INTO meta_champion_item_order
       (patch, champion, role, itemId, games, slotSum, firstGames) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    this.db.transaction(() => {
      for (const matchId of seed.matchIds) mark.run(matchId, seed.patch, hasOrderData ? 1 : 0)
      for (const row of seed.championStats) {
        putStat.run(seed.patch, row.champion, row.role, row.games, row.wins)
      }
      for (const row of seed.matchups) {
        putMatchup.run(seed.patch, row.champion, row.role, row.enemyChampion, row.games, row.wins)
      }
      for (const row of seed.items) {
        putItem.run(seed.patch, row.champion, row.role, row.itemId, row.games, row.wins)
      }
      for (const row of seed.itemOrder ?? []) {
        putOrder.run(
          seed.patch,
          row.champion,
          row.role,
          row.itemId,
          row.games,
          row.slotSum,
          row.firstGames
        )
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

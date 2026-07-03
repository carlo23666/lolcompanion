import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@main/db'
import { MetaRepo } from '@main/db/repos'
import { aggregateMatch, patchOf } from '@main/riot/meta-aggregate'
import { MetaCrawler, type MetaCrawlerClient } from '@main/riot/metacrawler'
import { RiotApiError } from '@main/riot/client'
import { matchSchema, type RiotMatch } from '@shared/schemas/riot'

const baseMatch = matchSchema.parse(
  JSON.parse(
    readFileSync(join(import.meta.dirname, '..', '..', 'fixtures', 'riot', 'match.json'), 'utf8')
  )
)

describe('aggregateMatch', () => {
  it('derives the short patch', () => {
    expect(patchOf('16.13.688.1290')).toBe('16.13')
  })

  it('aggregates champions, lane matchups and final items from a ranked game', () => {
    const aggregate = aggregateMatch(baseMatch)
    expect(aggregate).not.toBeNull()
    if (!aggregate) return
    expect(aggregate.patch).toBe('16.13')
    expect(aggregate.championStats).toHaveLength(10)
    // 10 lane matchups (each participant vs its same-position rival).
    expect(aggregate.matchups).toHaveLength(10)
    // Matchups are symmetric: every (A vs B, win) has (B vs A, loss).
    for (const matchup of aggregate.matchups) {
      const mirror = aggregate.matchups.find(
        (candidate) =>
          candidate.champion === matchup.enemyChampion &&
          candidate.enemyChampion === matchup.champion &&
          candidate.role === matchup.role
      )
      expect(mirror).toBeDefined()
      expect(mirror?.win).toBe(!matchup.win)
    }
    // Items: no zeros, no trinket slot.
    expect(aggregate.items.length).toBeGreaterThan(0)
    expect(aggregate.items.every((item) => item.itemId > 0)).toBe(true)
  })

  it('rejects other queues and remakes', () => {
    const aram = structuredClone(baseMatch)
    aram.info.queueId = 450
    expect(aggregateMatch(aram)).toBeNull()

    const remake = structuredClone(baseMatch)
    remake.info.gameDuration = 180
    expect(aggregateMatch(remake)).toBeNull()
  })
})

describe('MetaRepo', () => {
  function repo(): MetaRepo {
    const db = new Database(':memory:')
    runMigrations(db)
    return new MetaRepo(db)
  }

  it('applies an aggregate once (dedupe) and reads winrates back', () => {
    const meta = repo()
    const aggregate = aggregateMatch(baseMatch)
    if (!aggregate) throw new Error('aggregate null')
    expect(meta.applyAggregate(aggregate)).toBe(true)
    expect(meta.applyAggregate(aggregate)).toBe(false) // same match again

    const first = aggregate.championStats[0]
    if (!first) throw new Error('no stats')
    const winrate = meta.championWinrate(first.champion, first.role, '16.13')
    expect(winrate?.games).toBe(1)
    expect(winrate?.wins).toBe(first.win ? 1 : 0)

    const matchup = aggregate.matchups[0]
    if (!matchup) throw new Error('no matchups')
    expect(
      meta.laneMatchup(matchup.champion, matchup.role, matchup.enemyChampion, '16.13')?.games
    ).toBe(1)

    expect(meta.status()).toEqual([{ patch: '16.13', matches: 1 }])
  })

  it('latestPatch compares patches numerically (16.9 < 16.13)', () => {
    const meta = repo()
    const older = aggregateMatch(baseMatch)
    if (!older) throw new Error('aggregate null')
    meta.applyAggregate({ ...older, matchId: 'M_OLD', patch: '16.9' })
    meta.applyAggregate({ ...older, matchId: 'M_NEW', patch: '16.13' })
    expect(meta.latestPatch()).toBe('16.13')
  })

  it('topItems ranks by frequency', () => {
    const meta = repo()
    const aggregate = aggregateMatch(baseMatch)
    if (!aggregate) throw new Error('aggregate null')
    meta.applyAggregate(aggregate)
    const sample = aggregate.items[0]
    if (!sample) throw new Error('no items')
    const top = meta.topItems(sample.champion, sample.role, '16.13', 10)
    expect(top.length).toBeGreaterThan(0)
    expect(top.every((item) => item.games >= 1)).toBe(true)
  })
})

describe('MetaCrawler', () => {
  function fakeClient(matches: RiotMatch[]): MetaCrawlerClient & { matchFetches: string[] } {
    const byId = new Map(matches.map((match) => [match.metadata.matchId, match]))
    const matchFetches: string[] = []
    return {
      matchFetches,
      apexLeague: (tier) =>
        Promise.resolve({
          ok: true as const,
          value: { tier, entries: tier === 'master' ? [{ puuid: 'SEED_1' }] : [] }
        }),
      matchIds: () => Promise.resolve({ ok: true as const, value: [...byId.keys()] }),
      match: (matchId) => {
        matchFetches.push(matchId)
        const match = byId.get(matchId)
        return Promise.resolve(
          match
            ? { ok: true as const, value: match }
            : { ok: false as const, error: new RiotApiError('notFound', '404') }
        )
      }
    }
  }

  it('crawls seed histories, aggregates, and dedupes across runs', async () => {
    const db = new Database(':memory:')
    runMigrations(db)
    const meta = new MetaRepo(db)
    const second = structuredClone(baseMatch)
    second.metadata.matchId = 'EUW1_SECOND'
    const client = fakeClient([baseMatch, second])

    const crawler = new MetaCrawler({ client, repo: meta, onProgress: () => undefined })
    crawler.start()
    await vipollUntilDone(crawler)
    expect(crawler.status().stored).toBe(2)
    expect(meta.status()[0]?.matches).toBe(2)

    // Second run: everything already aggregated → no match refetches.
    client.matchFetches.length = 0
    crawler.start()
    await vipollUntilDone(crawler)
    expect(client.matchFetches).toEqual([])
    expect(meta.status()[0]?.matches).toBe(2)
  })

  it('stops with a clear error when the key is rejected', async () => {
    const db = new Database(':memory:')
    runMigrations(db)
    const crawler = new MetaCrawler({
      client: {
        apexLeague: () =>
          Promise.resolve({ ok: false as const, error: new RiotApiError('forbidden', '403', 403) }),
        matchIds: () => Promise.resolve({ ok: true as const, value: [] }),
        match: () => Promise.resolve({ ok: false as const, error: new RiotApiError('notFound', '404') })
      },
      repo: new MetaRepo(db),
      onProgress: () => undefined
    })
    crawler.start()
    await vipollUntilDone(crawler)
    expect(crawler.status().error).toContain('403')
  })
})

/** Waits until the crawler's async loop finishes (bounded). */
async function vipollUntilDone(crawler: MetaCrawler): Promise<void> {
  for (let i = 0; i < 200 && crawler.status().running; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Buffer } from 'node:buffer'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@main/db'
import { MetaRepo } from '@main/db/repos'
import { importMetaSeedIfEmpty } from '@main/meta-seed'
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
      },
      // Minimal valid timeline per match: order aggregation yields no rows
      // but the hasTimeline flag settles, keeping the dedupe assertions exact.
      timeline: (matchId) =>
        Promise.resolve({
          ok: true as const,
          value: {
            metadata: { matchId, participants: [] },
            info: { frames: [] }
          }
        })
    }
  }
  /** Order predicate for crawler tests: anything counts (no static data here). */
  const anyOrderable = (): boolean => true

  it('crawls seed histories, aggregates, and dedupes across runs', async () => {
    const db = new Database(':memory:')
    runMigrations(db)
    const meta = new MetaRepo(db)
    const second = structuredClone(baseMatch)
    second.metadata.matchId = 'EUW1_SECOND'
    const client = fakeClient([baseMatch, second])

    const crawler = new MetaCrawler({
      client,
      repo: meta,
      onProgress: () => undefined,
      isOrderable: anyOrderable
    })
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
        match: () => Promise.resolve({ ok: false as const, error: new RiotApiError('notFound', '404') }),
        timeline: () =>
          Promise.resolve({ ok: false as const, error: new RiotApiError('notFound', '404') })
      },
      repo: new MetaRepo(db),
      onProgress: () => undefined,
      isOrderable: anyOrderable
    })
    crawler.start()
    await vipollUntilDone(crawler)
    expect(crawler.status().error).toContain('403')
  })

  it('deep-pages a seed with a resumable cursor (WP-020)', async () => {
    const db = new Database(':memory:')
    runMigrations(db)
    const meta = new MetaRepo(db)
    const ids = Array.from({ length: 150 }, (_, i) => `M_${String(i)}`)
    const byId = new Map(
      ids.map((id) => {
        const match = structuredClone(baseMatch)
        match.metadata.matchId = id
        return [id, match] as const
      })
    )
    const matchFetches: string[] = []
    const client: MetaCrawlerClient = {
      apexLeague: (tier) =>
        Promise.resolve({
          ok: true as const,
          value: { tier, entries: tier === 'master' ? [{ puuid: 'SEED_1' }] : [] }
        }),
      matchIds: (_puuid, options) => {
        const start = options?.start ?? 0
        const count = options?.count ?? 100
        return Promise.resolve({ ok: true as const, value: ids.slice(start, start + count) })
      },
      match: (matchId) => {
        matchFetches.push(matchId)
        const match = byId.get(matchId)
        return Promise.resolve(
          match
            ? { ok: true as const, value: match }
            : { ok: false as const, error: new RiotApiError('notFound', '404') }
        )
      },
      timeline: (matchId) =>
        Promise.resolve({
          ok: true as const,
          value: { metadata: { matchId, participants: [] }, info: { frames: [] } }
        })
    }
    const crawler = new MetaCrawler({ client, repo: meta, onProgress: () => undefined, isOrderable: anyOrderable })
    crawler.start()
    await vipollUntilDone(crawler)
    expect(crawler.status().stored).toBe(150)
    expect(meta.status()[0]?.matches).toBe(150)
    // Two pages of 100 → cursor at 200 and marked exhausted.
    const cursor = db
      .prepare('SELECT nextStart, exhausted FROM meta_crawl_seeds WHERE puuid = ?')
      .get('SEED_1') as { nextStart: number; exhausted: number }
    expect(cursor).toEqual({ nextStart: 200, exhausted: 1 })

    // A BRAND-NEW crawler on the same DB resumes from the cursor: nothing left,
    // so it refetches no matches (checkpoint survives an app "restart").
    matchFetches.length = 0
    const resumed = new MetaCrawler({ client, repo: meta, onProgress: () => undefined, isOrderable: anyOrderable })
    resumed.start()
    await vipollUntilDone(resumed)
    expect(matchFetches).toEqual([])
    expect(meta.status()[0]?.matches).toBe(150)
  })

  it('seeds the frontier from all three apex ladders (WP-020)', async () => {
    const db = new Database(':memory:')
    runMigrations(db)
    const meta = new MetaRepo(db)
    const client: MetaCrawlerClient = {
      apexLeague: (tier) =>
        Promise.resolve({
          ok: true as const,
          value: {
            tier,
            entries:
              tier === 'challenger'
                ? [{ puuid: 'C1' }, { puuid: 'C2' }]
                : tier === 'grandmaster'
                  ? [{ puuid: 'G1' }]
                  : [{ puuid: 'M1' }]
          }
        }),
      matchIds: () => Promise.resolve({ ok: true as const, value: [] }),
      match: () => Promise.resolve({ ok: false as const, error: new RiotApiError('notFound', '404') }),
      timeline: () =>
        Promise.resolve({ ok: false as const, error: new RiotApiError('notFound', '404') })
    }
    const crawler = new MetaCrawler({ client, repo: meta, onProgress: () => undefined, isOrderable: anyOrderable })
    crawler.start()
    await vipollUntilDone(crawler)
    // 4 apex players registered, each with an empty (immediately exhausted) history.
    expect(meta.seedCounts()).toEqual({ total: 4, exhausted: 4 })
  })
})

/** Waits until the crawler's async loop finishes (bounded). */
async function vipollUntilDone(crawler: MetaCrawler): Promise<void> {
  for (let i = 0; i < 200 && crawler.status().running; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

function makeDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

describe('MetaRepo.itemsFor (role fallback — customs/blind lobbies)', () => {
  it('empty role falls back to the most-played Master+ role', () => {
    const db = makeDb()
    const meta = new MetaRepo(db)
    const aggregate = aggregateMatch(baseMatch)
    if (!aggregate) throw new Error('aggregate null')
    meta.applyAggregate(aggregate)
    const sample = aggregate.championStats.find((stat) => stat.role !== '')
    if (!sample) throw new Error('no positioned champion in fixture')

    expect(meta.topRoleFor(sample.champion, '16.13')).toBe(sample.role)
    const found = meta.itemsFor(sample.champion, '', '16.13', 10)
    expect(found?.role).toBe(sample.role)
    expect(found?.games).toBeGreaterThan(0)
  })

  it('a role with no crawl data falls back instead of going silent', () => {
    const db = makeDb()
    const meta = new MetaRepo(db)
    const aggregate = aggregateMatch(baseMatch)
    if (!aggregate) throw new Error('aggregate null')
    meta.applyAggregate(aggregate)
    const sample = aggregate.championStats.find((stat) => stat.role === 'TOP')
    if (!sample) throw new Error('no TOP champion in fixture')

    const found = meta.itemsFor(sample.champion, 'UTILITY', '16.13', 10)
    expect(found?.role).toBe('TOP')
  })

  it('unknown champion → null', () => {
    const meta = new MetaRepo(makeDb())
    expect(meta.itemsFor('Teemo', '', '16.13', 10)).toBeNull()
  })
})

describe('meta seed (export → import)', () => {
  function seededSource(): { meta: MetaRepo; aggregate: NonNullable<ReturnType<typeof aggregateMatch>> } {
    const meta = new MetaRepo(makeDb())
    const aggregate = aggregateMatch(baseMatch)
    if (!aggregate) throw new Error('aggregate null')
    meta.applyAggregate(aggregate)
    return { meta, aggregate }
  }

  it('round-trips into an empty store, ledger included (no re-crawl double count)', () => {
    const { meta: source, aggregate } = seededSource()
    const seed = { version: 1 as const, exportedAt: 'test', ...source.exportSeed('16.13') }

    const target = new MetaRepo(makeDb())
    expect(target.importSeed(seed)).toBe(true)
    expect(target.latestPatch()).toBe('16.13')

    const sample = aggregate.championStats[0]
    if (!sample) throw new Error('empty aggregate')
    expect(target.championWinrate(sample.champion, sample.role, '16.13')).toEqual(
      source.championWinrate(sample.champion, sample.role, '16.13')
    )
    // The seeded ledger makes a later crawl of the same match a no-op.
    expect(target.applyAggregate(aggregate)).toBe(false)
  })

  it('refuses to import over existing data (only-empty rule)', () => {
    const { meta: source } = seededSource()
    const seed = { version: 1 as const, exportedAt: 'test', ...source.exportSeed('16.13') }
    expect(source.importSeed(seed)).toBe(false)
  })

  it('records the imported base patch + exportedAt for freshness (WP-019)', () => {
    const { meta: source } = seededSource()
    const seed = { version: 2 as const, exportedAt: '2026-07-09T00:00:00.000Z', ...source.exportSeed('16.13') }
    const target = new MetaRepo(makeDb())
    expect(target.seedInfo()).toBeNull()
    target.importSeed(seed)
    expect(target.seedInfo()).toEqual({ patch: '16.13', exportedAt: '2026-07-09T00:00:00.000Z' })
  })

  it('matchCountForPatch counts one patch (WP-020 current-patch total)', () => {
    const meta = new MetaRepo(makeDb())
    const aggregate = aggregateMatch(baseMatch)
    if (!aggregate) throw new Error('aggregate null')
    meta.applyAggregate({ ...aggregate, matchId: 'A', patch: '16.13' })
    meta.applyAggregate({ ...aggregate, matchId: 'B', patch: '16.13' })
    meta.applyAggregate({ ...aggregate, matchId: 'C', patch: '16.9' })
    expect(meta.matchCountForPatch('16.13')).toBe(2)
    expect(meta.matchCountForPatch('16.9')).toBe(1)
  })
})

describe('importMetaSeedIfEmpty (first-run bootstrap)', () => {
  function seedPayload(): Buffer {
    const meta = new MetaRepo(makeDb())
    const aggregate = aggregateMatch(baseMatch)
    if (!aggregate) throw new Error('aggregate null')
    meta.applyAggregate(aggregate)
    const seed = { version: 1, exportedAt: 'test', ...meta.exportSeed('16.13') }
    return gzipSync(Buffer.from(JSON.stringify(seed)))
  }

  const fetchOk =
    (body: Buffer): typeof fetch =>
    () =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () =>
          Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength))
      } as Response)

  it('downloads, validates and imports into an empty store', async () => {
    const db = makeDb()
    const result = await importMetaSeedIfEmpty(db, { fetchImpl: fetchOk(seedPayload()) })
    expect(result).toBe('imported')
    expect(new MetaRepo(db).latestPatch()).toBe('16.13')
  })

  it('does nothing when the store already has data', async () => {
    const db = makeDb()
    const aggregate = aggregateMatch(baseMatch)
    if (!aggregate) throw new Error('aggregate null')
    new MetaRepo(db).applyAggregate(aggregate)
    let called = false
    const spy: typeof fetch = () => {
      called = true
      return Promise.reject(new Error('should not fetch'))
    }
    expect(await importMetaSeedIfEmpty(db, { fetchImpl: spy })).toBe('skipped-not-empty')
    expect(called).toBe(false)
  })

  it('offline → unavailable, store stays empty, nothing throws', async () => {
    const db = makeDb()
    const offline: typeof fetch = () => Promise.reject(new Error('ENOTFOUND github.com'))
    expect(await importMetaSeedIfEmpty(db, { fetchImpl: offline })).toBe('unavailable')
    expect(new MetaRepo(db).latestPatch()).toBeNull()
  })

  it('malformed payload → invalid, store stays empty', async () => {
    const db = makeDb()
    const junk = gzipSync(Buffer.from(JSON.stringify({ version: 2, nope: true })))
    expect(await importMetaSeedIfEmpty(db, { fetchImpl: fetchOk(junk) })).toBe('invalid')
    expect(new MetaRepo(db).latestPatch()).toBeNull()
  })
})

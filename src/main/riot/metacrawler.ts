import type { RiotLeagueList, RiotMatch, RiotTimeline } from '@shared/schemas/riot'
import { t as translators, type Translator } from '@shared/i18n'
import type { MetaRepo } from '../db/repos'
import { aggregateMatch, aggregateTimelineOrder, patchOf } from './meta-aggregate'
import type { Result } from './client'

/** The slice of RiotClient the crawler needs (fake-able in tests). */
export interface MetaCrawlerClient {
  apexLeague(
    tier: 'challenger' | 'grandmaster' | 'master',
    priority?: number
  ): Promise<Result<RiotLeagueList>>
  matchIds(
    puuid: string,
    options?: { start?: number; count?: number; queue?: number },
    priority?: number
  ): Promise<Result<string[]>>
  match(matchId: string, priority?: number): Promise<Result<RiotMatch>>
  timeline(matchId: string, priority?: number): Promise<Result<RiotTimeline>>
}

export interface MetaCrawlStatus {
  running: boolean
  /** Matches fetched this run (stored + skipped). */
  processed: number
  /** Matches aggregated this run. */
  stored: number
  /** Seed players fully paged / total in the frontier. */
  seedsDone: number
  seedsTotal: number
  /** Matches aggregated per hour this run (0 until enough has elapsed). */
  gamesPerHour: number
  error: string | null
}

const RANKED_SOLO_QUEUE = 420
/** match-v5 returns up to 100 ids per call; deep, resumable paging per seed. */
const PAGE_SIZE = 100
/** Lowest priority: the crawler must never starve owner-facing requests. */
const CRAWL_PRIORITY = 50
/** Timeline backfill per run: 2 API calls each, bounded so seeds still crawl. */
const BACKFILL_PER_RUN = 2000

/**
 * Background Master+ meta crawler: seeds from the apex league lists
 * (challenger/grandmaster/master — every game in those histories is Master+
 * by construction) and deep-pages each player's ranked-solo history into the
 * aggregate tables. Only AGGREGATES leave the machine; seed puuids live in the
 * local `meta_crawl_seeds` cursor table purely for resume and are never
 * exported or shown. Fully resumable: `meta_matches` dedupes fetched matches
 * and each seed's pagination cursor survives restarts.
 */
export class MetaCrawler {
  private running = false
  private stopRequested = false
  private runStartMs = 0
  private state: MetaCrawlStatus = {
    running: false,
    processed: 0,
    stored: 0,
    seedsDone: 0,
    seedsTotal: 0,
    gamesPerHour: 0,
    error: null
  }

  constructor(
    private readonly options: {
      client: MetaCrawlerClient
      repo: MetaRepo
      onProgress: (status: MetaCrawlStatus) => void
      /** Which items count for completion-order stats (from the item graph). */
      isOrderable: (itemId: number) => boolean
      /** Localized status/error strings (ADR-009); defaults to Spanish. */
      t?: Translator
      log?: (message: string) => void
    }
  ) {}

  private get t(): Translator {
    return this.options.t ?? translators.es
  }

  status(): MetaCrawlStatus {
    return { ...this.state, running: this.running, gamesPerHour: this.gamesPerHour() }
  }

  /** Aggregated matches / hour this run — needs ≥30 s of runtime to settle. */
  private gamesPerHour(): number {
    const elapsed = Date.now() - this.runStartMs
    if (this.runStartMs === 0 || elapsed < 30_000) return 0
    return Math.round(this.state.stored / (elapsed / 3_600_000))
  }

  start(): { started: boolean; error?: string } {
    if (this.running) return { started: false, error: this.t('err.crawlInProgress') }
    this.running = true
    this.stopRequested = false
    this.runStartMs = Date.now()
    this.state = {
      running: true,
      processed: 0,
      stored: 0,
      seedsDone: 0,
      seedsTotal: 0,
      gamesPerHour: 0,
      error: null
    }
    void this.loop().finally(() => {
      this.running = false
      this.emit()
    })
    return { started: true }
  }

  stop(): void {
    this.stopRequested = true
  }

  private emit(): void {
    this.options.onProgress(this.status())
  }

  /**
   * Fetches and folds the timeline for an already-aggregated match. Failure
   * leaves hasTimeline = 0 (a later run backfills); an unusable timeline still
   * claims the flag so it is never refetched.
   */
  private async foldTimeline(match: RiotMatch): Promise<void> {
    const timeline = await this.options.client.timeline(match.metadata.matchId, CRAWL_PRIORITY)
    if (!timeline.ok) return
    const order = aggregateTimelineOrder(match, timeline.value, this.options.isOrderable)
    this.options.repo.applyOrderAggregate(
      order ?? {
        matchId: match.metadata.matchId,
        patch: patchOf(match.info.gameVersion),
        items: []
      }
    )
  }

  /**
   * Upgrades matches aggregated before WP-015 (or whose timeline fetch
   * failed) with completion-order data. Costs a match + a timeline call per
   * entry, all at crawl priority; runs before new seeds because these games
   * are already counted — order data for them is pure value.
   */
  private async backfillTimelines(): Promise<void> {
    const pending = this.options.repo.matchesNeedingTimeline(BACKFILL_PER_RUN)
    if (pending.length === 0) return
    this.options.log?.(`[meta] backfilling timelines for ${String(pending.length)} matches`)
    for (const matchId of pending) {
      if (this.stopRequested) return
      const match = await this.options.client.match(matchId, CRAWL_PRIORITY)
      if (!match.ok) {
        if (match.error.kind === 'forbidden') {
          this.state.error = this.t('err.apiKeyRejected')
          return
        }
        continue
      }
      await this.foldTimeline(match.value)
    }
  }

  private async loop(): Promise<void> {
    await this.backfillTimelines()
    if (this.stopRequested || this.state.error !== null) return

    // Refresh the seed frontier from the apex ladders (idempotent — keeps any
    // existing pagination cursors so a restart resumes deep paging).
    const apex = await this.collectSeeds()
    if (this.state.error !== null) return
    if (apex.length > 0) this.options.repo.addSeeds(apex)
    if (this.options.repo.seedCounts().total === 0) {
      this.state.error ??= this.t('err.noSeeds')
      return
    }

    // Page seeds round-robin (least-recently-touched first) until stopped or
    // every seed's history is exhausted. Runs for as long as the owner leaves
    // it on; the cursor table means the next run picks up where this left off.
    while (!this.stopRequested && this.state.error === null) {
      const seed = this.options.repo.nextPendingSeed()
      if (seed === null) break
      await this.crawlSeedPage(seed.puuid, seed.nextStart)
      const counts = this.options.repo.seedCounts()
      this.state.seedsTotal = counts.total
      this.state.seedsDone = counts.exhausted
      this.emit()
    }
  }

  /** One page of a seed player's ranked-solo history; advances its cursor. */
  private async crawlSeedPage(puuid: string, start: number): Promise<void> {
    const ids = await this.options.client.matchIds(
      puuid,
      { start, count: PAGE_SIZE, queue: RANKED_SOLO_QUEUE },
      CRAWL_PRIORITY
    )
    if (!ids.ok) {
      if (ids.error.kind === 'forbidden') {
        this.state.error = this.t('err.apiKeyRejected')
        return
      }
      // Transient: touch the cursor (unchanged start) so we rotate to another
      // seed now and retry this one later instead of spinning on it.
      this.options.repo.advanceSeed(puuid, start, false, Date.now())
      return
    }
    const exhausted = ids.value.length < PAGE_SIZE
    for (const matchId of ids.value) {
      if (this.stopRequested) return
      if (this.options.repo.hasMatch(matchId)) continue // dedupe/resume
      const match = await this.options.client.match(matchId, CRAWL_PRIORITY)
      if (!match.ok) {
        if (match.error.kind === 'forbidden') {
          this.state.error = this.t('err.apiKeyRejected')
          return
        }
        continue
      }
      const aggregate = aggregateMatch(match.value)
      if (aggregate) {
        this.options.repo.applyAggregate(aggregate)
        await this.foldTimeline(match.value)
        this.state.stored += 1
      } else {
        this.options.repo.markSkipped(matchId)
      }
      this.state.processed += 1
      if (this.state.processed % 5 === 0) this.emit()
    }
    this.options.repo.advanceSeed(puuid, start + PAGE_SIZE, exhausted, Date.now())
  }

  /** Apex league puuids, interleaved across tiers and shuffled. */
  private async collectSeeds(): Promise<string[]> {
    const puuids: string[] = []
    for (const tier of ['challenger', 'grandmaster', 'master'] as const) {
      const result = await this.options.client.apexLeague(tier, CRAWL_PRIORITY)
      if (!result.ok) {
        if (result.error.kind === 'forbidden') {
          this.state.error = this.t('err.apiKeyRejected')
          return []
        }
        this.options.log?.(`[meta] ${tier} list failed: ${result.error.message}`)
        continue
      }
      for (const entry of result.value.entries) {
        if (entry.puuid !== undefined && entry.puuid !== '') puuids.push(entry.puuid)
      }
    }
    // Shuffle so consecutive runs don't hammer the same histories.
    for (let i = puuids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const a = puuids[i]
      const b = puuids[j]
      if (a !== undefined && b !== undefined) {
        puuids[i] = b
        puuids[j] = a
      }
    }
    return puuids
  }
}

import type { RiotLeagueList, RiotMatch, RiotTimeline } from '@shared/schemas/riot'
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
  seedsDone: number
  seedsTotal: number
  error: string | null
}

const RANKED_SOLO_QUEUE = 420
const MATCHES_PER_PLAYER = 20
/** Lowest priority: the crawler must never starve owner-facing requests. */
const CRAWL_PRIORITY = 50
/** Timeline backfill per run: 2 API calls each, bounded so seeds still crawl. */
const BACKFILL_PER_RUN = 2000

/**
 * Background Master+ meta crawler: seeds from the apex league lists
 * (challenger/grandmaster/master — every game in those histories is Master+
 * by construction), walks each player's recent ranked-solo matches, and folds
 * them into the aggregate tables. Only aggregates are stored; puuids stay in
 * memory for the run. Resumable: meta_matches dedupes across runs.
 */
export class MetaCrawler {
  private running = false
  private stopRequested = false
  private state: MetaCrawlStatus = {
    running: false,
    processed: 0,
    stored: 0,
    seedsDone: 0,
    seedsTotal: 0,
    error: null
  }

  constructor(
    private readonly options: {
      client: MetaCrawlerClient
      repo: MetaRepo
      onProgress: (status: MetaCrawlStatus) => void
      /** Which items count for completion-order stats (from the item graph). */
      isOrderable: (itemId: number) => boolean
      log?: (message: string) => void
    }
  ) {}

  status(): MetaCrawlStatus {
    return { ...this.state, running: this.running }
  }

  start(): { started: boolean; error?: string } {
    if (this.running) return { started: false, error: 'ya hay un rastreo en marcha' }
    this.running = true
    this.stopRequested = false
    this.state = { running: true, processed: 0, stored: 0, seedsDone: 0, seedsTotal: 0, error: null }
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
          this.state.error = 'clave API rechazada (403): renuévala en Ajustes/.env'
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
    const seeds = await this.collectSeeds()
    if (seeds.length === 0) {
      this.state.error ??= 'sin jugadores semilla (¿clave API caducada?)'
      return
    }
    this.state.seedsTotal = seeds.length
    this.emit()

    for (const puuid of seeds) {
      if (this.stopRequested) return
      const ids = await this.options.client.matchIds(
        puuid,
        { count: MATCHES_PER_PLAYER, queue: RANKED_SOLO_QUEUE },
        CRAWL_PRIORITY
      )
      if (!ids.ok) {
        if (ids.error.kind === 'forbidden') {
          this.state.error = 'clave API rechazada (403): renuévala en Ajustes/.env'
          return
        }
        continue // transient: move to the next seed
      }
      for (const matchId of ids.value) {
        if (this.stopRequested) return
        if (this.options.repo.hasMatch(matchId)) continue
        const match = await this.options.client.match(matchId, CRAWL_PRIORITY)
        if (!match.ok) {
          if (match.error.kind === 'forbidden') {
            this.state.error = 'clave API rechazada (403): renuévala en Ajustes/.env'
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
      this.state.seedsDone += 1
      this.emit()
    }
  }

  /** Apex league puuids, interleaved across tiers and shuffled. */
  private async collectSeeds(): Promise<string[]> {
    const puuids: string[] = []
    for (const tier of ['challenger', 'grandmaster', 'master'] as const) {
      const result = await this.options.client.apexLeague(tier, CRAWL_PRIORITY)
      if (!result.ok) {
        if (result.error.kind === 'forbidden') {
          this.state.error = 'clave API rechazada (403): renuévala en Ajustes/.env'
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

/**
 * Token-bucket rate limiter for the Riot Web API.
 *
 * - App limits (personal key): 20 req / 1s AND 100 req / 120s, enforced
 *   together (fixed windows, matching Riot's counting).
 * - Per-method limits enforced on top of app limits.
 * - Honors `Retry-After` on 429: the whole limiter pauses and the request is
 *   replayed through the queue (consuming fresh tokens), never dropped.
 * - 403 (bad/expired key) is persistent: everything queued and future rejects
 *   fast with a typed error so callers surface it to the UI instead of
 *   retry-storming.
 * - Priority queue: lower number = sooner (interactive lookups win over
 *   backfill ingestion).
 */

export interface RateLimit {
  limit: number
  windowMs: number
}

export const APP_LIMITS: RateLimit[] = [
  { limit: 20, windowMs: 1_000 },
  { limit: 100, windowMs: 120_000 }
]

/** Conservative per-method defaults for a personal key. */
export const DEFAULT_METHOD_LIMITS: Record<string, RateLimit[]> = {
  'match-v5.ids': [{ limit: 200, windowMs: 10_000 }],
  'match-v5.match': [{ limit: 200, windowMs: 10_000 }],
  'match-v5.timeline': [{ limit: 200, windowMs: 10_000 }],
  'account-v1.by-riot-id': [{ limit: 100, windowMs: 60_000 }],
  'league-v4.entries': [{ limit: 100, windowMs: 60_000 }]
}

export class RiotKeyInvalidError extends Error {
  constructor() {
    super('Riot API key rejected (403). Update the key in Ajustes (or RIOT_API_KEY in .env)')
    this.name = 'RiotKeyInvalidError'
  }
}

export class RiotRateLimitExhaustedError extends Error {
  constructor(retries: number) {
    super(`Still rate limited after ${String(retries)} replays`)
    this.name = 'RiotRateLimitExhaustedError'
  }
}

interface BucketState {
  limit: RateLimit
  windowStart: number
  used: number
}

interface QueuedRequest {
  method: string
  priority: number
  seq: number
  retries: number
  request: () => Promise<Response>
  resolve: (response: Response) => void
  reject: (error: Error) => void
}

export interface RiotRateLimiterOptions {
  appLimits?: RateLimit[]
  methodLimits?: Record<string, RateLimit[]>
  now?: () => number
  maxRetriesPerRequest?: number
}

export class RiotRateLimiter {
  private readonly appBuckets: BucketState[]
  private readonly methodBuckets = new Map<string, BucketState[]>()
  private readonly methodLimits: Record<string, RateLimit[]>
  private readonly now: () => number
  private readonly maxRetries: number

  private queue: QueuedRequest[] = []
  private seqCounter = 0
  private processing = false
  private blockedUntil = 0
  private keyInvalid = false

  constructor(options: RiotRateLimiterOptions = {}) {
    this.now = options.now ?? (() => Date.now())
    this.methodLimits = options.methodLimits ?? DEFAULT_METHOD_LIMITS
    this.maxRetries = options.maxRetriesPerRequest ?? 5
    this.appBuckets = (options.appLimits ?? APP_LIMITS).map((limit) => ({
      limit,
      windowStart: 0,
      used: 0
    }))
  }

  /** True once a 403 has been seen; cleared via reset() after a key change. */
  isKeyInvalid(): boolean {
    return this.keyInvalid
  }

  reset(): void {
    this.keyInvalid = false
  }

  execute(method: string, request: () => Promise<Response>, priority = 10): Promise<Response> {
    if (this.keyInvalid) {
      return Promise.reject(new RiotKeyInvalidError())
    }
    return new Promise<Response>((resolve, reject) => {
      this.enqueue({
        method,
        priority,
        seq: this.seqCounter++,
        retries: 0,
        request,
        resolve,
        reject
      })
    })
  }

  private enqueue(item: QueuedRequest): void {
    this.queue.push(item)
    this.queue.sort((a, b) => a.priority - b.priority || a.seq - b.seq)
    void this.process()
  }

  private bucketsFor(method: string): BucketState[] {
    let buckets = this.methodBuckets.get(method)
    if (!buckets) {
      buckets = (this.methodLimits[method] ?? []).map((limit) => ({
        limit,
        windowStart: 0,
        used: 0
      }))
      this.methodBuckets.set(method, buckets)
    }
    return buckets
  }

  private delayFor(buckets: BucketState[]): number {
    const now = this.now()
    let delay = 0
    for (const bucket of buckets) {
      if (now - bucket.windowStart >= bucket.limit.windowMs) continue
      if (bucket.used >= bucket.limit.limit) {
        delay = Math.max(delay, bucket.windowStart + bucket.limit.windowMs - now)
      }
    }
    return delay
  }

  private consume(buckets: BucketState[]): void {
    const now = this.now()
    for (const bucket of buckets) {
      if (now - bucket.windowStart >= bucket.limit.windowMs) {
        bucket.windowStart = now
        bucket.used = 0
      }
      bucket.used += 1
    }
  }

  private async process(): Promise<void> {
    if (this.processing) return
    this.processing = true
    try {
      while (this.queue.length > 0) {
        if (this.keyInvalid) {
          const item = this.queue.shift()
          item?.reject(new RiotKeyInvalidError())
          continue
        }

        // Pick the first item (priority order) whose buckets allow a request
        // NOW — a method-limited request must not block other methods.
        const globalWait = this.blockedUntil - this.now()
        const appWait = this.delayFor(this.appBuckets)
        let index = -1
        let minWait = Infinity
        for (let i = 0; i < this.queue.length; i++) {
          const candidate = this.queue[i]
          if (!candidate) continue
          const wait = Math.max(
            globalWait,
            appWait,
            this.delayFor(this.bucketsFor(candidate.method))
          )
          if (wait <= 0) {
            index = i
            break
          }
          minWait = Math.min(minWait, wait)
        }
        if (index === -1) {
          await sleep(Math.max(minWait, 1))
          continue // re-evaluate: higher-priority items may have arrived
        }

        const [item] = this.queue.splice(index, 1)
        if (!item) continue
        const methodBuckets = this.bucketsFor(item.method)
        this.consume(this.appBuckets)
        this.consume(methodBuckets)

        try {
          const response = await item.request()
          if (response.status === 429) {
            item.retries += 1
            if (item.retries > this.maxRetries) {
              item.reject(new RiotRateLimitExhaustedError(this.maxRetries))
              continue
            }
            const retryAfterS = Number(response.headers.get('Retry-After') ?? '1')
            this.blockedUntil = this.now() + Math.max(retryAfterS, 1) * 1000
            // Replay through the queue so the retry consumes fresh tokens.
            this.queue.unshift(item)
            continue
          }
          if (response.status === 403) {
            this.keyInvalid = true
            item.reject(new RiotKeyInvalidError())
            continue
          }
          item.resolve(response)
        } catch (error) {
          item.reject(error instanceof Error ? error : new Error(String(error)))
        }
      }
    } finally {
      this.processing = false
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

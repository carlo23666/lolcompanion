import {
  accountSchema,
  leagueEntriesSchema,
  matchIdsSchema,
  matchSchema,
  timelineSchema,
  type RiotAccount,
  type RiotLeagueEntry,
  type RiotMatch,
  type RiotTimeline
} from '@shared/schemas/riot'
import type { z } from 'zod'
import { RiotRateLimiter } from './limiter'

/** Result-style return for connector failures (CLAUDE.md conventions). */
export type Result<T> = { ok: true; value: T } | { ok: false; error: RiotApiError }

export type RiotErrorKind =
  | 'forbidden'
  | 'notFound'
  | 'rateLimited'
  | 'server'
  | 'network'
  | 'invalidPayload'

export class RiotApiError extends Error {
  constructor(
    readonly kind: RiotErrorKind,
    message: string,
    readonly status?: number
  ) {
    // Never include the API key or full URLs (they don't carry the key, but
    // keep messages minimal anyway).
    super(message)
    this.name = 'RiotApiError'
  }
}

/** Platform routing (league-v4) → regional routing (account-v1, match-v5). */
export const PLATFORM_TO_REGIONAL: Record<string, string> = {
  euw1: 'europe',
  eun1: 'europe',
  tr1: 'europe',
  ru: 'europe',
  me1: 'europe',
  na1: 'americas',
  br1: 'americas',
  la1: 'americas',
  la2: 'americas',
  oc1: 'americas',
  kr: 'asia',
  jp1: 'asia',
  sg2: 'sea',
  tw2: 'sea',
  vn2: 'sea'
}

export interface RiotClientOptions {
  apiKey: string
  platform: string // e.g. 'euw1'
  limiter?: RiotRateLimiter
  fetchFn?: typeof fetch
}

export class RiotClient {
  private readonly apiKey: string
  private readonly platform: string
  private readonly regional: string
  private readonly limiter: RiotRateLimiter
  private readonly fetchFn: typeof fetch

  constructor(options: RiotClientOptions) {
    this.apiKey = options.apiKey
    this.platform = options.platform
    this.regional = PLATFORM_TO_REGIONAL[options.platform] ?? 'europe'
    this.limiter = options.limiter ?? new RiotRateLimiter()
    this.fetchFn = options.fetchFn ?? fetch
  }

  accountByRiotId(gameName: string, tagLine: string, priority = 1): Promise<Result<RiotAccount>> {
    const path = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    return this.get('account-v1.by-riot-id', this.regional, path, accountSchema, priority)
  }

  matchIds(
    puuid: string,
    options: { start?: number; count?: number } = {},
    priority = 10
  ): Promise<Result<string[]>> {
    const params = new URLSearchParams({
      start: String(options.start ?? 0),
      count: String(options.count ?? 100)
    })
    const path = `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?${params.toString()}`
    return this.get('match-v5.ids', this.regional, path, matchIdsSchema, priority)
  }

  match(matchId: string, priority = 10): Promise<Result<RiotMatch>> {
    const path = `/lol/match/v5/matches/${encodeURIComponent(matchId)}`
    return this.get('match-v5.match', this.regional, path, matchSchema, priority)
  }

  timeline(matchId: string, priority = 10): Promise<Result<RiotTimeline>> {
    const path = `/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`
    return this.get('match-v5.timeline', this.regional, path, timelineSchema, priority)
  }

  leagueEntries(puuid: string, priority = 5): Promise<Result<RiotLeagueEntry[]>> {
    const path = `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`
    return this.get('league-v4.entries', this.platform, path, leagueEntriesSchema, priority)
  }

  private async get<S extends z.ZodType>(
    method: string,
    routing: string,
    path: string,
    schema: S,
    priority: number
  ): Promise<Result<z.infer<S>>> {
    try {
      const response = await this.limiter.execute(
        method,
        () =>
          this.fetchFn(`https://${routing}.api.riotgames.com${path}`, {
            headers: { 'X-Riot-Token': this.apiKey }
          }),
        priority
      )
      if (!response.ok) {
        return { ok: false, error: httpError(response.status) }
      }
      const parsed = schema.safeParse(await response.json())
      if (!parsed.success) {
        return {
          ok: false,
          error: new RiotApiError('invalidPayload', `${method}: ${parsed.error.message}`)
        }
      }
      return { ok: true, value: parsed.data }
    } catch (error) {
      if (error instanceof RiotApiError) return { ok: false, error }
      const kind = error instanceof Error && error.name === 'RiotKeyInvalidError'
        ? 'forbidden'
        : error instanceof Error && error.name === 'RiotRateLimitExhaustedError'
          ? 'rateLimited'
          : 'network'
      return {
        ok: false,
        error: new RiotApiError(kind, error instanceof Error ? error.message : String(error))
      }
    }
  }
}

function httpError(status: number): RiotApiError {
  if (status === 403) return new RiotApiError('forbidden', 'API key rejected (403)', 403)
  if (status === 404) return new RiotApiError('notFound', 'Not found (404)', 404)
  if (status === 429) return new RiotApiError('rateLimited', 'Rate limited (429)', 429)
  return new RiotApiError('server', `HTTP ${String(status)}`, status)
}

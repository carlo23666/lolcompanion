import type { SessionPhase } from '@shared/session'
import type { AppDatabase } from './db'
import { LiveSessionRepo, MatchRepo, TimelineRepo } from './db/repos'
import { matchToRows } from './riot/ingest'
import type { RiotClient } from './riot/client'

export interface PostGameIngestorOptions {
  db: AppDatabase
  /** Returns a ready client + puuid, or null when not configured. */
  getContext: () => { client: RiotClient; puuid: string } | null
  /** Called after a match lands in the DB (renderer refresh). */
  onStored?: (matchId: string) => void
  /** Riot publishes matches 1-3 min after the game; retry accordingly. */
  attemptDelaysMs?: number[]
  log?: (message: string) => void
}

const DEFAULT_DELAYS = [30_000, 60_000, 60_000, 60_000, 120_000]

/**
 * Watches for the postGame phase and pulls the just-finished match
 * (match-v5 + timeline) into the DB, linking it to the live session.
 */
export class PostGameIngestor {
  private readonly delays: number[]
  private timer: ReturnType<typeof setTimeout> | null = null
  private attempt = 0
  private active = false

  constructor(private readonly options: PostGameIngestorOptions) {
    this.delays = options.attemptDelaysMs ?? DEFAULT_DELAYS
  }

  onPhase(phase: SessionPhase): void {
    if (phase === 'postGame' && !this.active) {
      this.active = true
      this.attempt = 0
      this.schedule()
    }
    // A new game cancels any pending fetch (it will re-trigger post-game).
    if (phase === 'inGame') this.cancel()
  }

  cancel(): void {
    this.active = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private schedule(): void {
    const delay = this.delays[this.attempt]
    if (delay === undefined) {
      this.options.log?.('[postgame] giving up: match not published after all retries')
      this.active = false
      return
    }
    this.timer = setTimeout(() => {
      void this.tryFetch()
    }, delay)
  }

  private async tryFetch(): Promise<void> {
    if (!this.active) return
    this.attempt += 1
    const context = this.options.getContext()
    if (!context) {
      this.options.log?.('[postgame] no API key / riotId configured, skipping auto-ingest')
      this.active = false
      return
    }

    try {
      const { client, puuid } = context
      const ids = await client.matchIds(puuid, { start: 0, count: 1 }, 1)
      if (!ids.ok || ids.value.length === 0) {
        this.schedule()
        return
      }
      const matchId = ids.value[0]
      if (matchId === undefined) {
        this.schedule()
        return
      }

      const matchRepo = new MatchRepo(this.options.db)
      const timelineRepo = new TimelineRepo(this.options.db)

      if (!matchRepo.hasMatch(matchId)) {
        const match = await client.match(matchId, 1)
        if (!match.ok) {
          this.schedule()
          return
        }
        const { row, participants } = matchToRows(match.value)
        const own = participants.find((participant) => participant.puuid === puuid)
        row.win = own?.win ?? null
        matchRepo.insertMatch(row, match.value, participants)
      }
      if (!timelineRepo.hasTimeline(matchId)) {
        const timeline = await client.timeline(matchId, 1)
        if (timeline.ok) timelineRepo.insertTimeline(matchId, timeline.value)
      }

      // Link the newest unlinked live session to the published match.
      const sessions = new LiveSessionRepo(this.options.db)
      const session = sessions.latestUnlinkedSession()
      const stored = matchRepo.getMatch(matchId)
      if (session && stored) {
        sessions.linkMatch(session.id, {
          matchId,
          result: stored.win === null ? 'UNKNOWN' : stored.win ? 'WIN' : 'LOSS',
          patch: stored.patch
        })
      }

      this.active = false
      this.options.onStored?.(matchId)
    } catch (error) {
      this.options.log?.(
        `[postgame] attempt failed: ${error instanceof Error ? error.message : String(error)}`
      )
      this.schedule()
    }
  }
}

import type { LiveClientSnapshot } from '@shared/schemas/liveclient'
import type { LiveSessionRepo } from '../db/repos'

/**
 * Persists live snapshots into live_sessions/live_snapshots. A new session
 * starts when game time goes backwards (new game) or on the first snapshot.
 */
export class LiveSessionPersister {
  private sessionId: number | null = null
  private lastGameTimeS = -1

  constructor(
    private readonly repo: LiveSessionRepo,
    private readonly now: () => Date = () => new Date()
  ) {}

  currentSessionId(): number | null {
    return this.sessionId
  }

  persist(snapshot: LiveClientSnapshot, raw: unknown): void {
    const gameTimeS = snapshot.gameData.gameTime
    if (this.sessionId === null || gameTimeS < this.lastGameTimeS) {
      this.sessionId = this.repo.createSession(
        this.now().toISOString(),
        findOwnChampion(snapshot),
        null // patch unknown from Live Client; filled at post-game link (WP-010)
      )
    }
    this.lastGameTimeS = gameTimeS
    this.repo.appendSnapshot(this.sessionId, gameTimeS, raw)
  }

  /** Called when the game ends (port closes); next snapshot starts fresh. */
  endSession(): void {
    this.sessionId = null
    this.lastGameTimeS = -1
  }
}

/** The active player's champion, matched by riotId (fallback summonerName). */
export function findOwnChampion(snapshot: LiveClientSnapshot): string | null {
  const self = snapshot.activePlayer
  const ownName = self.riotId ?? self.summonerName
  if (ownName === undefined) return null
  const player = snapshot.allPlayers.find(
    (p) => (p.riotId ?? p.summonerName) === ownName
  )
  return player?.championName ?? null
}

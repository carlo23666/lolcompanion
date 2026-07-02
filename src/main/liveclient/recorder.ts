import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Dumps every raw Live Client snapshot to
 * `<baseDir>/<session>/<gameTime>.json` for fixture recording.
 * Dev tool only: enabled via `RECORD_LIVE=1`, never in the packaged app.
 */
export class SnapshotRecorder {
  private readonly baseDir: string
  private sessionDir: string | null = null
  private lastGameTimeS = -1

  constructor(baseDir: string, private readonly now: () => Date = () => new Date()) {
    this.baseDir = baseDir
  }

  /** Called on every snapshot; gameTimeS resets → new session directory. */
  record(raw: unknown, gameTimeS: number): string {
    if (this.sessionDir === null || gameTimeS < this.lastGameTimeS) {
      const stamp = this.now().toISOString().replace(/[:.]/g, '-')
      this.sessionDir = join(this.baseDir, stamp)
      mkdirSync(this.sessionDir, { recursive: true })
    }
    this.lastGameTimeS = gameTimeS
    const file = join(this.sessionDir, `${String(Math.round(gameTimeS)).padStart(6, '0')}.json`)
    writeFileSync(file, JSON.stringify(raw, null, 2))
    return file
  }
}

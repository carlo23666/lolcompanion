import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { allGameDataSchema, type LiveClientSnapshot } from '@shared/schemas/liveclient'

export interface ReplaySource {
  id: string
  label: string
  snapshots: number
}

export interface ReplayDriverOptions {
  /** Directories scanned for snapshot folders (e.g. fixtures/recordings). */
  roots: { dir: string; prefix: string }[]
  process: (snapshot: LiveClientSnapshot, raw: unknown) => void
  onStateChange: (state: 'unavailable' | 'polling') => void
  /** End-of-replay hook (after onStateChange('unavailable')). */
  onDone?: () => void
}

const SNAPSHOT_FILE_RE = /^\d+\.json$/

/**
 * Dev tool: replays a recorded game (fixtures/recordings dumps) through the
 * same snapshot pipeline as the real Live Client poller, so the whole app —
 * session phases, live view, engine, overlay, alerts — behaves as if a game
 * were running. Never active in the packaged app (guarded at registration).
 */
export class ReplayDriver {
  private timer: ReturnType<typeof setTimeout> | null = null
  private files: string[] = []
  private index = 0
  private intervalMs = 500
  private activeId: string | null = null

  constructor(private readonly options: ReplayDriverOptions) {}

  /** Snapshot folders available for replay, newest first per root. */
  list(): ReplaySource[] {
    const sources: ReplaySource[] = []
    for (const root of this.options.roots) {
      if (!existsSync(root.dir)) continue
      const dirs = readdirSync(root.dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .reverse()
      for (const dir of dirs) {
        const snapshots = readdirSync(join(root.dir, dir)).filter((file) =>
          SNAPSHOT_FILE_RE.test(file)
        ).length
        if (snapshots > 0) {
          sources.push({
            id: `${root.prefix}/${dir}`,
            label: `${dir} (${String(snapshots)} snapshots)`,
            snapshots
          })
        }
      }
    }
    return sources
  }

  status(): { running: boolean; id: string | null; progressPct: number } {
    return {
      running: this.timer !== null,
      id: this.activeId,
      progressPct: this.files.length > 0 ? (this.index / this.files.length) * 100 : 0
    }
  }

  start(id: string, intervalMs = 500): { started: boolean; error?: string } {
    this.stop()
    const [prefix, ...rest] = id.split('/')
    const dirName = rest.join('/')
    const root = this.options.roots.find((candidate) => candidate.prefix === prefix)
    if (!root || dirName === '' || dirName.includes('..')) {
      return { started: false, error: `replay desconocido: ${id}` }
    }
    const dir = join(root.dir, dirName)
    if (!existsSync(dir)) return { started: false, error: `no existe: ${id}` }
    this.files = readdirSync(dir)
      .filter((file) => SNAPSHOT_FILE_RE.test(file))
      .sort()
      .map((file) => join(dir, file))
    if (this.files.length === 0) return { started: false, error: 'sin snapshots' }

    this.index = 0
    this.intervalMs = Math.max(50, intervalMs)
    this.activeId = id
    this.options.onStateChange('polling')
    this.tick()
    return { started: true }
  }

  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
      this.activeId = null
      this.options.onStateChange('unavailable')
      this.options.onDone?.()
    }
  }

  private tick(): void {
    const file = this.files[this.index]
    if (file === undefined) {
      this.stop()
      return
    }
    this.index += 1
    try {
      const raw: unknown = JSON.parse(readFileSync(file, 'utf8'))
      const parsed = allGameDataSchema.safeParse(raw)
      if (parsed.success) this.options.process(parsed.data, raw)
    } catch {
      // Unreadable snapshot: skip it, keep replaying.
    }
    this.timer = setTimeout(() => {
      this.tick()
    }, this.intervalMs)
  }
}

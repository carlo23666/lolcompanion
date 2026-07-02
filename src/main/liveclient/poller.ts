import { allGameDataSchema, type LiveClientSnapshot } from '@shared/schemas/liveclient'
import type { FetchAllGameData } from './transport'

export type LiveClientState = 'unavailable' | 'polling'

export interface LiveClientPollerOptions {
  transport: FetchAllGameData
  /** Poll cadence while the game is up. Default 2000ms. */
  intervalMs?: number
  /** Backoff cap while the port is closed. Default 10000ms. */
  maxBackoffMs?: number
  onSnapshot: (snapshot: LiveClientSnapshot, raw: unknown) => void
  onStateChange?: (state: LiveClientState) => void
  /** Called when the payload arrives but fails schema validation. */
  onValidationError?: (error: Error, raw: unknown) => void
}

/**
 * Polls the Live Client Data API. States:
 * - `unavailable`: port closed (no game). Exponential backoff 2s→4s→8s→10s cap.
 * - `polling`: game up, fixed 2s cadence.
 * Never throws out of the loop; the app must run fine with LoL closed.
 */
export class LiveClientPoller {
  private readonly transport: FetchAllGameData
  private readonly intervalMs: number
  private readonly maxBackoffMs: number
  private readonly onSnapshot: LiveClientPollerOptions['onSnapshot']
  private readonly onStateChange: LiveClientPollerOptions['onStateChange']
  private readonly onValidationError: LiveClientPollerOptions['onValidationError']

  private state: LiveClientState = 'unavailable'
  private currentDelay: number
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private inFlight = false

  constructor(options: LiveClientPollerOptions) {
    this.transport = options.transport
    this.intervalMs = options.intervalMs ?? 2000
    this.maxBackoffMs = options.maxBackoffMs ?? 10000
    this.onSnapshot = options.onSnapshot
    this.onStateChange = options.onStateChange
    this.onValidationError = options.onValidationError
    this.currentDelay = this.intervalMs
  }

  getState(): LiveClientState {
    return this.state
  }

  start(): void {
    if (this.running) return
    this.running = true
    void this.tick()
  }

  stop(): void {
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private setState(next: LiveClientState): void {
    if (this.state === next) return
    this.state = next
    this.onStateChange?.(next)
  }

  private schedule(delay: number): void {
    if (!this.running) return
    this.timer = setTimeout(() => void this.tick(), delay)
  }

  private async tick(): Promise<void> {
    if (!this.running || this.inFlight) return
    this.inFlight = true
    try {
      const raw = await this.transport()
      const parsed = allGameDataSchema.safeParse(raw)
      if (parsed.success) {
        this.setState('polling')
        this.currentDelay = this.intervalMs
        this.onSnapshot(parsed.data, raw)
      } else {
        // Reachable but malformed: stay in polling cadence, report the error.
        this.setState('polling')
        this.currentDelay = this.intervalMs
        this.onValidationError?.(new Error(parsed.error.message), raw)
      }
      this.schedule(this.currentDelay)
    } catch {
      // Port closed or request failed → no game. Back off exponentially:
      // wait currentDelay now, double it for the next failure (2→4→8→10 cap).
      const wasPolling = this.state === 'polling'
      this.setState('unavailable')
      const delay = wasPolling ? this.intervalMs : this.currentDelay
      this.currentDelay = Math.min(delay * 2, this.maxBackoffMs)
      this.schedule(delay)
    } finally {
      this.inFlight = false
    }
  }
}

import {
  authenticate,
  createHttp1Request,
  createWebSocketConnection,
  type Credentials,
  type LeagueWebSocket
} from 'league-connect'

/**
 * The ONLY module (with ./index.ts) that touches league-connect.
 * Reconnect loop: waits for the client process, connects the WS, resubscribes
 * after client restarts. Endpoints used are listed in docs/lcu-endpoints.md.
 */

export interface LcuConnectorEvents {
  onConnected?: () => void
  onDisconnected?: () => void
  onGameflowPhase?: (phase: string) => void
  /** Raw champ select session — consumer must sanitize before forwarding. */
  onChampSelect?: (rawSession: unknown) => void
}

const GAMEFLOW_PHASE = '/lol-gameflow/v1/gameflow-phase'
const CHAMP_SELECT_SESSION = '/lol-champ-select/v1/session'

export class LcuConnector {
  private running = false
  private ws: LeagueWebSocket | null = null

  constructor(
    private readonly events: LcuConnectorEvents,
    private readonly retryDelayMs = 2500
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    void this.loop()
  }

  stop(): void {
    this.running = false
    this.ws?.close()
    this.ws = null
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const credentials = await authenticate({
          awaitConnection: true,
          pollInterval: this.retryDelayMs
        })
        if (!this.running) return

        const ws = await createWebSocketConnection({ pollInterval: 1000, maxRetries: 30 })
        if (!this.running) {
          ws.close()
          return
        }
        this.ws = ws
        this.events.onConnected?.()

        ws.subscribe(GAMEFLOW_PHASE, (data: unknown) => {
          if (typeof data === 'string') this.events.onGameflowPhase?.(data)
        })
        ws.subscribe(CHAMP_SELECT_SESSION, (data: unknown) => {
          this.events.onChampSelect?.(data)
        })

        // Subscriptions only fire on change — fetch the current phase once.
        await this.emitCurrentPhase(credentials)

        await new Promise<void>((resolve) => {
          ws.once('close', () => resolve())
          ws.once('error', () => resolve())
        })
        this.ws = null
        this.events.onDisconnected?.()
      } catch {
        this.ws = null
        this.events.onDisconnected?.()
        await sleep(this.retryDelayMs)
      }
    }
  }

  private async emitCurrentPhase(credentials: Credentials): Promise<void> {
    try {
      const response = await createHttp1Request(
        { method: 'GET', url: GAMEFLOW_PHASE },
        credentials
      )
      const phase = response.json<string>()
      if (typeof phase === 'string') this.events.onGameflowPhase?.(phase)
    } catch {
      // Endpoint not ready yet — the subscription will deliver the next change.
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

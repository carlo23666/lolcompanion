import { join } from 'node:path'
import { app } from 'electron'
import type { GameState } from '@shared/gamestate'
import type { LiveClientSnapshot } from '@shared/schemas/liveclient'
import type { AppDatabase } from '../db'
import { LiveSessionRepo } from '../db/repos'
import { SettingsRepo, SETTING_KEYS } from '../db/repos/settings'
import { diffGameStates } from '../engine/diff'
import { normalizeSnapshot } from '../engine/normalize'
import { recommend } from '../engine/recommend'
import { broadcast } from '../ipc'
import { getStaticDataManager } from '../staticdata'
import type { StaticData } from '../staticdata/manager'
import { LiveClientPoller } from './poller'
import { LiveSessionPersister } from './persist'
import { SnapshotRecorder } from './recorder'
import { createLiveClientTransport } from './transport'

export { LiveClientPoller } from './poller'
export type { LiveClientState } from './poller'
export { LiveSessionPersister, findOwnChampion } from './persist'

function certPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'certs', 'riotgames.pem')
    : join(app.getAppPath(), 'certs', 'riotgames.pem')
}

export interface SnapshotProcessor {
  /** Full pipeline for one snapshot: broadcast, normalize, events, recommend. */
  process(snapshot: LiveClientSnapshot, raw: unknown): void
  /** Forget the previous state (game ended); next snapshot starts fresh. */
  reset(): void
}

/**
 * The snapshot → IPC pipeline shared by the real poller and the dev replay
 * driver: broadcast raw snapshot, normalize to GameState, diff into events,
 * run the engine, and (live only) persist session data.
 */
export function createSnapshotProcessor(
  db: AppDatabase,
  options: { persist: boolean }
): SnapshotProcessor {
  const persister = options.persist ? new LiveSessionPersister(new LiveSessionRepo(db)) : null

  // Static data loads in the background; snapshots normalize once ready.
  let staticData: StaticData | null = null
  getStaticDataManager()
    .load()
    .then((data) => {
      staticData = data
    })
    .catch((error: unknown) => {
      console.error(
        '[staticdata] load failed, GameState disabled:',
        error instanceof Error ? error.message : String(error)
      )
    })

  let previousState: GameState | null = null
  let lastPersistedTop = ''

  return {
    process(snapshot, raw): void {
      broadcast('live:snapshot', snapshot)
      persister?.persist(snapshot, raw)

      if (!staticData) return
      const state = normalizeSnapshot(snapshot, staticData)
      if (!state) return
      broadcast('gamestate:update', state)
      if (previousState && previousState.gameTimeS < state.gameTimeS) {
        const events = diffGameStates(previousState, state)
        if (events.length > 0) broadcast('gamestate:events', events)
      }
      previousState = state

      const recommendations = recommend(state, staticData)
      broadcast('gamestate:recommendations', {
        gameTimeS: state.gameTimeS,
        recommendations
      })
      // Persist for post-game auditing/backtesting, but only when the
      // recommended set actually changes (not every 2s tick).
      const sessionId = persister?.currentSessionId() ?? null
      const topKey = recommendations
        .slice(0, 3)
        .map((rec) => `${String(rec.itemId ?? rec.category)}:${rec.action}`)
        .join('|')
      if (sessionId !== null && topKey !== lastPersistedTop) {
        lastPersistedTop = topKey
        new LiveSessionRepo(db).appendRecommendations(
          sessionId,
          state.gameTimeS,
          recommendations
        )
      }
    },
    reset(): void {
      persister?.endSession()
      previousState = null
      lastPersistedTop = ''
    }
  }
}

/**
 * Starts the Live Client poller wired to IPC, DB persistence
 * (live_sessions/live_snapshots) and, in dev with RECORD_LIVE=1, the fixture
 * file recorder.
 */
export function startLiveClient(
  db: AppDatabase,
  onStateChange?: (state: 'unavailable' | 'polling') => void
): LiveClientPoller {
  // Recorder is a dev-only tool: refuses to run in the packaged app.
  // Enabled via RECORD_LIVE=1 or the settings toggle (Ajustes).
  const settings = new SettingsRepo(db)
  const recorder = app.isPackaged
    ? null
    : new SnapshotRecorder(join(app.getAppPath(), 'fixtures', 'recordings'))
  const recordingEnabled = (): boolean =>
    process.env['RECORD_LIVE'] === '1' || settings.get(SETTING_KEYS.recordLive) === '1'

  const processor = createSnapshotProcessor(db, { persist: true })

  const poller = new LiveClientPoller({
    transport: createLiveClientTransport(certPath()),
    onSnapshot: (snapshot, raw) => {
      if (recorder && recordingEnabled()) {
        recorder.record(raw, snapshot.gameData.gameTime)
      }
      processor.process(snapshot, raw)
    },
    onStateChange: (state) => {
      broadcast('live:state', state)
      if (state === 'unavailable') processor.reset()
      onStateChange?.(state)
    },
    onValidationError: (error) => {
      console.error('[liveclient] payload failed validation:', error.message)
    }
  })
  poller.start()
  return poller
}

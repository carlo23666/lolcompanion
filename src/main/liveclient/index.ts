import { join } from 'node:path'
import { app } from 'electron'
import type { GameState } from '@shared/gamestate'
import type { AppDatabase } from '../db'
import { LiveSessionRepo } from '../db/repos'
import { diffGameStates } from '../engine/diff'
import { normalizeSnapshot } from '../engine/normalize'
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

/**
 * Starts the Live Client poller wired to IPC, DB persistence
 * (live_sessions/live_snapshots) and, in dev with RECORD_LIVE=1, the fixture
 * file recorder.
 */
export function startLiveClient(
  db: AppDatabase,
  onStateChange?: (state: 'unavailable' | 'polling') => void
): LiveClientPoller {
  // Recorder is a dev-only tool: refuse to run in the packaged app.
  const recorder =
    process.env['RECORD_LIVE'] === '1' && !app.isPackaged
      ? new SnapshotRecorder(join(app.getAppPath(), 'fixtures', 'recordings'))
      : null

  const persister = new LiveSessionPersister(new LiveSessionRepo(db))

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

  const poller = new LiveClientPoller({
    transport: createLiveClientTransport(certPath()),
    onSnapshot: (snapshot, raw) => {
      broadcast('live:snapshot', snapshot)
      persister.persist(snapshot, raw)
      recorder?.record(raw, snapshot.gameData.gameTime)

      if (staticData) {
        const state = normalizeSnapshot(snapshot, staticData)
        if (state) {
          broadcast('gamestate:update', state)
          if (previousState && previousState.gameTimeS < state.gameTimeS) {
            const events = diffGameStates(previousState, state)
            if (events.length > 0) broadcast('gamestate:events', events)
          }
          previousState = state
        }
      }
    },
    onStateChange: (state) => {
      broadcast('live:state', state)
      if (state === 'unavailable') {
        persister.endSession()
        previousState = null
      }
      onStateChange?.(state)
    },
    onValidationError: (error) => {
      console.error('[liveclient] payload failed validation:', error.message)
    }
  })
  poller.start()
  return poller
}

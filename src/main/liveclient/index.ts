import { join } from 'node:path'
import { app } from 'electron'
import type { AppDatabase } from '../db'
import { LiveSessionRepo } from '../db/repos'
import { broadcast } from '../ipc'
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
export function startLiveClient(db: AppDatabase): LiveClientPoller {
  // Recorder is a dev-only tool: refuse to run in the packaged app.
  const recorder =
    process.env['RECORD_LIVE'] === '1' && !app.isPackaged
      ? new SnapshotRecorder(join(app.getAppPath(), 'fixtures', 'recordings'))
      : null

  const persister = new LiveSessionPersister(new LiveSessionRepo(db))

  const poller = new LiveClientPoller({
    transport: createLiveClientTransport(certPath()),
    onSnapshot: (snapshot, raw) => {
      broadcast('live:snapshot', snapshot)
      persister.persist(snapshot, raw)
      recorder?.record(raw, snapshot.gameData.gameTime)
    },
    onStateChange: (state) => {
      broadcast('live:state', state)
      if (state === 'unavailable') persister.endSession()
    },
    onValidationError: (error) => {
      console.error('[liveclient] payload failed validation:', error.message)
    }
  })
  poller.start()
  return poller
}

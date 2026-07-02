import { join } from 'node:path'
import { app } from 'electron'
import { broadcast } from '../ipc'
import { LiveClientPoller } from './poller'
import { SnapshotRecorder } from './recorder'
import { createLiveClientTransport } from './transport'

export { LiveClientPoller } from './poller'
export type { LiveClientState } from './poller'

function certPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'certs', 'riotgames.pem')
    : join(app.getAppPath(), 'certs', 'riotgames.pem')
}

/** Starts the Live Client poller wired to IPC (and the fixture recorder in dev). */
export function startLiveClient(): LiveClientPoller {
  // Recorder is a dev-only tool: refuse to run in the packaged app.
  const recorder =
    process.env['RECORD_LIVE'] === '1' && !app.isPackaged
      ? new SnapshotRecorder(join(app.getAppPath(), 'fixtures', 'recordings'))
      : null

  const poller = new LiveClientPoller({
    transport: createLiveClientTransport(certPath()),
    onSnapshot: (snapshot, raw) => {
      broadcast('live:snapshot', snapshot)
      recorder?.record(raw, snapshot.gameData.gameTime)
    },
    onStateChange: (state) => broadcast('live:state', state),
    onValidationError: (error) => {
      console.error('[liveclient] payload failed validation:', error.message)
    }
  })
  poller.start()
  return poller
}

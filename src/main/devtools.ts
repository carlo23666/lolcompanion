import { join } from 'node:path'
import { app } from 'electron'
import type { ChampSelectState } from '@shared/schemas/lcu'
import type { AppDatabase } from './db'
import { broadcast, handleInvoke } from './ipc'
import { createSnapshotProcessor } from './liveclient'
import { ReplayDriver } from './liveclient/replay'
import type { SessionMachine } from './session/machine'

/**
 * Canned 5v5 draft (real champion keys) to exercise the champ select panel:
 * own cell hovers Kai'Sa (plan visible) without locking (pick suggestions
 * visible); enemies include 3 AD + a healer so the comp tips fire.
 */
const MOCK_CHAMP_SELECT: ChampSelectState = {
  localPlayerCellId: 3,
  ownPosition: 'bottom',
  myTeam: [
    { cellId: 0, championId: 266, championPickIntent: 0, position: 'top' }, // Aatrox
    { cellId: 1, championId: 104, championPickIntent: 0, position: 'jungle' }, // Graves
    { cellId: 2, championId: 103, championPickIntent: 0, position: 'middle' }, // Ahri
    { cellId: 3, championId: 0, championPickIntent: 145, position: 'bottom' }, // Kai'Sa (hover)
    { cellId: 4, championId: 89, championPickIntent: 0, position: 'utility' } // Leona
  ],
  theirTeam: [
    { cellId: 5, championId: 157 }, // Yasuo
    { cellId: 6, championId: 238 }, // Zed
    { cellId: 7, championId: 16 }, // Soraka (healer tip)
    { cellId: 8, championId: 99 }, // Lux
    { cellId: 9, championId: 119 } // Draven
  ],
  bans: { mine: [24, 11], theirs: [55, 122] }, // Jax, Yi / Katarina, Darius
  timerPhase: 'BAN_PICK'
}

/**
 * Dev-only simulation IPC (Ajustes → Herramientas de prueba): replay recorded
 * games through the real pipeline and fake a champ select. Every handler
 * refuses in the packaged app.
 */
export function registerDevTools(db: AppDatabase, machine: SessionMachine): void {
  const packaged = app.isPackaged

  const processor = createSnapshotProcessor(db, { persist: false })
  const replay = new ReplayDriver({
    roots: [
      { dir: join(app.getAppPath(), 'fixtures', 'recordings'), prefix: 'rec' },
      { dir: join(app.getAppPath(), 'fixtures', 'liveclient'), prefix: 'fix' }
    ],
    process: (snapshot, raw) => processor.process(snapshot, raw),
    onStateChange: (state) => machine.setLiveState(state),
    onDone: () => processor.reset()
  })

  handleInvoke('dev:replays', () => (packaged ? [] : replay.list()))
  handleInvoke('dev:replay:start', (id, intervalMs) => {
    if (packaged) return { started: false, error: 'solo disponible en desarrollo' }
    return replay.start(id, intervalMs)
  })
  handleInvoke('dev:replay:stop', () => {
    replay.stop()
    return { stopped: true }
  })
  handleInvoke('dev:replay:status', () => replay.status())

  handleInvoke('dev:champselect:start', () => {
    if (packaged) return { started: false }
    broadcast('session:phase', 'champSelect')
    broadcast('session:champselect', MOCK_CHAMP_SELECT)
    return { started: true }
  })
  handleInvoke('dev:champselect:stop', () => {
    broadcast('session:champselect', null)
    broadcast('session:phase', machine.getPhase())
    return { stopped: true }
  })
}

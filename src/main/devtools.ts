import { join } from 'node:path'
import { app } from 'electron'
import type { GameScenario } from '@shared/scenario'
import type { ChampSelectState } from '@shared/schemas/lcu'
import type { LiveClientSnapshot } from '@shared/schemas/liveclient'
import type { AppDatabase } from './db'
import { buildScenarioSnapshot } from './devtools-scenario'
import { broadcast, handleInvoke } from './ipc'
import { createSnapshotProcessor } from './liveclient'
import { ReplayDriver } from './liveclient/replay'
import type { SessionMachine } from './session/machine'
import { getStaticDataManager } from './staticdata'

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

  handleInvoke('dev:enabled', () => !packaged)
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
  handleInvoke('dev:champselect:custom', (state) => {
    if (packaged) return { started: false }
    broadcast('session:phase', 'champSelect')
    broadcast('session:champselect', state)
    return { started: true }
  })
  handleInvoke('dev:champselect:stop', () => {
    broadcast('session:champselect', null)
    broadcast('session:phase', machine.getPhase())
    return { stopped: true }
  })

  // ---- Forced game situations (synthetic snapshots, same pipeline) ----
  let scenarioTimer: ReturnType<typeof setInterval> | null = null
  let scenarioSnapshot: LiveClientSnapshot | null = null

  const stopScenario = (): void => {
    if (scenarioTimer !== null) {
      clearInterval(scenarioTimer)
      scenarioTimer = null
      scenarioSnapshot = null
      machine.setLiveState('unavailable')
      processor.reset()
    }
  }

  const applyScenario = async (
    scenario: GameScenario
  ): Promise<{ ok: boolean; error?: string }> => {
    const data = await getStaticDataManager()
      .load()
      .catch(() => null)
    if (data === null) return { ok: false, error: 'static data no disponible' }
    const { snapshot, errors } = buildScenarioSnapshot(scenario, data)
    if (snapshot === null) return { ok: false, error: errors.join('; ') }
    // Keep advanced time monotonic so the diff engine sees updates, not a
    // new game (a lower gameTime resets the session).
    const currentTime = scenarioSnapshot?.gameData.gameTime ?? 0
    snapshot.gameData.gameTime = Math.max(scenario.gameTimeS, currentTime)
    scenarioSnapshot = snapshot
    if (scenarioTimer === null) {
      machine.setLiveState('polling')
      scenarioTimer = setInterval(() => {
        if (scenarioSnapshot === null) return
        scenarioSnapshot.gameData.gameTime += 2
        processor.process(scenarioSnapshot, scenarioSnapshot)
      }, 2000)
    }
    processor.process(snapshot, snapshot)
    return { ok: true }
  }

  handleInvoke('dev:scenario:start', async (scenario) => {
    if (packaged) return { started: false, error: 'solo disponible en desarrollo' }
    replay.stop() // a replay and a scenario can't both own the live state
    const result = await applyScenario(scenario)
    return { started: result.ok, error: result.error }
  })
  handleInvoke('dev:scenario:update', async (scenario) => {
    if (packaged || scenarioTimer === null) {
      return { updated: false, error: 'no hay situación activa' }
    }
    const result = await applyScenario(scenario)
    return { updated: result.ok, error: result.error }
  })
  handleInvoke('dev:scenario:stop', () => {
    stopScenario()
    return { stopped: true }
  })
}

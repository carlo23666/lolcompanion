import { join } from 'node:path'
import { app } from 'electron'
import type { GameState, GameStateEvent } from '@shared/gamestate'
import { mascotNameFor } from '@shared/themes'
import type { LiveClientSnapshot } from '@shared/schemas/liveclient'
import { DEFAULT_COACH_MODEL, generateWithInstalledModel } from '../coach'
import { LiveCoach } from '../coach-live'
import type { AppDatabase } from '../db'
import { LiveSessionRepo, MetaRepo } from '../db/repos'
import { SettingsRepo, SETTING_KEYS } from '../db/repos/settings'
import { diffGameStates } from '../engine/diff'
import { normalizeSnapshot } from '../engine/normalize'
import { recommend, type MetaItemsInput } from '../engine/recommend'
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

  // Live macro coach: Hexi speaks a short local-AI tip every ~60s in game.
  // Also runs during replays/scenarios, which is how the owner tests it.
  const coachSettings = new SettingsRepo(db)
  const liveCoach = new LiveCoach({
    isEnabled: () =>
      coachSettings.get(SETTING_KEYS.coachEnabled) === '1' &&
      coachSettings.get(SETTING_KEYS.coachLive) !== '0',
    generate: (prompt) =>
      generateWithInstalledModel(
        coachSettings.get(SETTING_KEYS.coachModel) ?? DEFAULT_COACH_MODEL,
        prompt
      ),
    onTip: (tip) => broadcast('coach:tip', tip),
    onDirection: (tip) => broadcast('coach:direction', tip),
    personaName: () => mascotNameFor(coachSettings.get(SETTING_KEYS.theme)),
    log: (message) => console.log(message)
  })

  // Master+ items for the own champion+role — backs the build advice when
  // the champion has no pool.json entry. One lookup per champion+role.
  let metaKey = ''
  let metaItems: MetaItemsInput | undefined
  const lookupMetaItems = (champion: string, role: string): MetaItemsInput | undefined => {
    const repo = new MetaRepo(db)
    const patch = repo.latestPatch()
    if (patch === null) return undefined
    const winrate = repo.championWinrate(champion, role, patch)
    if (winrate === null) return undefined
    // 30 items: the rules intersect their candidates with this distribution
    // (antiheal/defensives/pen), so it must reach past the core build.
    return { items: repo.topItems(champion, role, patch, 30), games: winrate.games }
  }

  return {
    process(snapshot, raw): void {
      broadcast('live:snapshot', snapshot)
      persister?.persist(snapshot, raw)

      if (!staticData) return
      const state = normalizeSnapshot(snapshot, staticData)
      if (!state) return
      broadcast('gamestate:update', state)
      let events: GameStateEvent[] = []
      if (previousState && previousState.gameTimeS < state.gameTimeS) {
        events = diffGameStates(previousState, state)
        if (events.length > 0) broadcast('gamestate:events', events)
      }
      previousState = state

      const key = `${state.self.championId}|${state.self.position}`
      if (key !== metaKey) {
        metaKey = key
        metaItems = lookupMetaItems(state.self.championId, state.self.position)
      }
      const recommendations = recommend(state, staticData, undefined, metaItems)
      broadcast('gamestate:recommendations', {
        gameTimeS: state.gameTimeS,
        recommendations
      })
      liveCoach.onGameState(state, events, recommendations[0] ?? null)
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
      liveCoach.reset()
      // Re-query next game: the crawler may have aggregated more since.
      metaKey = ''
      metaItems = undefined
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
  onStateChange?: (state: 'unavailable' | 'loading' | 'polling') => void
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

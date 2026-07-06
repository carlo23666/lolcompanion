import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { champSelectInsights, type MetaSource } from './champselect'
import { registerCoachIpc } from './coach-ipc'
import { openDatabase, type AppDatabase } from './db'
import { MatchRepo, MetaRepo } from './db/repos'
import { registerDevTools } from './devtools'
import { loadDotEnv } from './env'
import { registerHistoryIpc } from './history-ipc'
import { registerIconProtocol, registerIconScheme } from './icons'
import { broadcast, handleInvoke } from './ipc'
import { startLcu, type LcuConnector } from './lcu'
import { startLiveClient, type LiveClientPoller } from './liveclient'
import { OverlayManager } from './overlay'
import { SettingsRepo, SETTING_KEYS } from './db/repos/settings'
import { catchUpMissedMatches, PostGameIngestor } from './postgame'
import { getOwnerPuuid, getRiotContext, registerRiotIpc } from './riot'
import { SessionMachine } from './session/machine'
import { getStaticDataManager } from './staticdata'

registerIconScheme()

let db: AppDatabase | null = null
let liveClient: LiveClientPoller | null = null
let lcu: LcuConnector | null = null
let overlay: OverlayManager | null = null

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1100,
    height: 750,
    title: 'LoL Companion',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

/** Master+ aggregates as a MetaSource, pinned to the newest crawled patch. */
function metaSource(db: AppDatabase): MetaSource | null {
  const repo = new MetaRepo(db)
  const patch = repo.latestPatch()
  if (patch === null) return null
  return {
    championWinrate: (champion, role) => repo.championWinrate(champion, role, patch),
    laneMatchup: (champion, role, enemy) => repo.laneMatchup(champion, role, enemy, patch)
  }
}

function registerIpcHandlers(db: AppDatabase): void {
  handleInvoke('app:ping', () => ({ pong: true, version: app.getVersion() }))
  handleInvoke('staticdata:championMeta', async () => {
    const data = await getStaticDataManager().load()
    return Object.fromEntries(
      [...data.championsByKey].map(([key, champion]) => [
        key,
        { id: champion.id, name: champion.name, damageType: data.damageProfile(champion.id) }
      ])
    )
  })
  handleInvoke('staticdata:itemCatalog', async () => {
    const data = await getStaticDataManager().load()
    return [...data.itemGraph.nodes.values()]
      .filter((node) => node.availableOnSR)
      .map((node) => ({ id: node.id, name: node.name, totalGold: node.totalGold }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  })
  handleInvoke('champselect:insights', async (state) => {
    // Static data may still be downloading right after app start.
    const data = await getStaticDataManager()
      .load()
      .catch(() => null)
    if (data === null) return null
    // Pick suggestions come from the owner's own stored history, including
    // the enemy team of each game for the matchup component.
    const puuid = getOwnerPuuid(db)
    const repo = new MatchRepo(db)
    const history =
      puuid === null
        ? []
        : repo.ownerMatches(puuid, { limit: 200 }).map(({ match, own }) => ({
            champion: own.champion,
            role: own.role,
            win: own.win,
            enemyChampions: repo
              .getParticipants(match.matchId)
              .filter((participant) => participant.win !== own.win)
              .map((participant) => participant.champion)
          }))
    return champSelectInsights(state, data, undefined, history, metaSource(db))
  })
}

void app.whenReady().then(() => {
  loadDotEnv(app.getAppPath())
  db = openDatabase(join(app.getPath('userData'), 'lol-companion.db'))
  registerIconProtocol(() => getStaticDataManager().getLoadedPatch())
  registerIpcHandlers(db)
  registerRiotIpc(db)
  registerCoachIpc(db)

  const statsService = registerHistoryIpc(db)

  const database = db
  const postGame = new PostGameIngestor({
    db: database,
    getContext: () => getRiotContext(database),
    onStored: (matchId) => {
      statsService.invalidate()
      broadcast('history:changed', { matchId })
    },
    log: (message) => console.log(message)
  })

  // Catch up on matches finished while the app (or client) was closed —
  // delayed so startup traffic (static data, LCU) settles first.
  setTimeout(() => {
    void catchUpMissedMatches({
      db: database,
      getContext: () => getRiotContext(database),
      onStored: (matchId) => {
        statsService.invalidate()
        broadcast('history:changed', { matchId })
      },
      log: (message) => console.log(message)
    }).catch((error: unknown) => {
      console.log(
        `[catchup] failed: ${error instanceof Error ? error.message : String(error)}`
      )
    })
  }, 10_000)

  overlay = new OverlayManager()
  handleInvoke('overlay:interactive', (interactive) => {
    overlay?.setInteractive(interactive)
    return { ok: true as const }
  })
  const machine = new SessionMachine((phase) => {
    broadcast('session:phase', phase)
    postGame.onPhase(phase)
    // Experimental overlay: only while in game and enabled in Ajustes.
    const overlayEnabled =
      new SettingsRepo(database).get(SETTING_KEYS.overlayEnabled) === '1'
    if (phase === 'inGame' && overlayEnabled) overlay?.show()
    else overlay?.hide()
  })
  handleInvoke('session:get', () => machine.getPhase())
  liveClient = startLiveClient(db, (state) => machine.setLiveState(state))
  lcu = startLcu(machine)
  registerDevTools(database, machine)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('quit', () => {
  overlay?.destroy()
  overlay = null
  lcu?.stop()
  lcu = null
  liveClient?.stop()
  liveClient = null
  db?.close()
  db = null
})

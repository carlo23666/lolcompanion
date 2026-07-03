import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { champSelectInsights } from './champselect'
import { openDatabase, type AppDatabase } from './db'
import { MatchRepo } from './db/repos'
import { registerDevTools } from './devtools'
import { loadDotEnv } from './env'
import { registerHistoryIpc } from './history-ipc'
import { registerIconProtocol, registerIconScheme } from './icons'
import { broadcast, handleInvoke } from './ipc'
import { startLcu, type LcuConnector } from './lcu'
import { startLiveClient, type LiveClientPoller } from './liveclient'
import { OverlayManager } from './overlay'
import { SettingsRepo, SETTING_KEYS } from './db/repos/settings'
import { PostGameIngestor } from './postgame'
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
    return champSelectInsights(state, data, undefined, history)
  })
}

void app.whenReady().then(() => {
  loadDotEnv(app.getAppPath())
  db = openDatabase(join(app.getPath('userData'), 'lol-companion.db'))
  registerIconProtocol(() => getStaticDataManager().getLoadedPatch())
  registerIpcHandlers(db)
  registerRiotIpc(db)

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

  overlay = new OverlayManager()
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

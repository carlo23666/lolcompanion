import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { openDatabase, type AppDatabase } from './db'
import { loadDotEnv } from './env'
import { registerHistoryIpc } from './history-ipc'
import { registerIconProtocol, registerIconScheme } from './icons'
import { broadcast, handleInvoke } from './ipc'
import { startLcu, type LcuConnector } from './lcu'
import { startLiveClient, type LiveClientPoller } from './liveclient'
import { PostGameIngestor } from './postgame'
import { getRiotContext, registerRiotIpc } from './riot'
import { SessionMachine } from './session/machine'
import { getStaticDataManager } from './staticdata'

registerIconScheme()

let db: AppDatabase | null = null
let liveClient: LiveClientPoller | null = null
let lcu: LcuConnector | null = null

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

function registerIpcHandlers(): void {
  handleInvoke('app:ping', () => ({ pong: true, version: app.getVersion() }))
  handleInvoke('staticdata:championNames', async () => {
    const data = await getStaticDataManager().load()
    return Object.fromEntries(
      [...data.championsByKey].map(([key, champion]) => [key, champion.name])
    )
  })
}

void app.whenReady().then(() => {
  loadDotEnv(app.getAppPath())
  db = openDatabase(join(app.getPath('userData'), 'lol-companion.db'))
  registerIconProtocol(() => getStaticDataManager().getLoadedPatch())
  registerIpcHandlers()
  registerRiotIpc(db)

  registerHistoryIpc(db)

  const database = db
  const postGame = new PostGameIngestor({
    db: database,
    getContext: () => getRiotContext(database),
    onStored: (matchId) => broadcast('history:changed', { matchId }),
    log: (message) => console.log(message)
  })

  const machine = new SessionMachine((phase) => {
    broadcast('session:phase', phase)
    postGame.onPhase(phase)
  })
  handleInvoke('session:get', () => machine.getPhase())
  liveClient = startLiveClient(db, (state) => machine.setLiveState(state))
  lcu = startLcu(machine)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('quit', () => {
  lcu?.stop()
  lcu = null
  liveClient?.stop()
  liveClient = null
  db?.close()
  db = null
})

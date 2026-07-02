import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { openDatabase, type AppDatabase } from './db'
import { handleInvoke } from './ipc'
import { startLiveClient, type LiveClientPoller } from './liveclient'

let db: AppDatabase | null = null
let liveClient: LiveClientPoller | null = null

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
}

void app.whenReady().then(() => {
  db = openDatabase(join(app.getPath('userData'), 'lol-companion.db'))
  registerIpcHandlers()
  liveClient = startLiveClient()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('quit', () => {
  liveClient?.stop()
  liveClient = null
  db?.close()
  db = null
})

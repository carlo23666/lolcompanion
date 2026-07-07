import { app, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // every 4h while the app stays open

/**
 * Auto-update against the latest GitHub release (electron-updater): checks on
 * startup and every few hours, downloads in the background, and asks before
 * restarting — never mid-game-relevant: the prompt is a plain dialog the user
 * can postpone; the update also applies on next quit automatically.
 * Dev builds skip everything (no feed, no noise).
 */
export function startAutoUpdater(log: (message: string) => void): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    log(`[updater] update available: ${info.version} — downloading`)
  })
  autoUpdater.on('update-downloaded', (info) => {
    log(`[updater] update downloaded: ${info.version}`)
    void dialog
      .showMessageBox({
        type: 'info',
        title: 'Actualización lista',
        message: `LoL Companion ${info.version} está descargada.`,
        detail: 'Puedes reiniciar ahora para aplicarla o seguir; se instalará sola al cerrar la app.',
        buttons: ['Reiniciar ahora', 'Luego'],
        defaultId: 0,
        cancelId: 1
      })
      .then((result) => {
        if (result.response === 0) autoUpdater.quitAndInstall()
      })
  })
  autoUpdater.on('error', (error) => {
    // Offline or GitHub hiccups are normal — log and retry on the next tick.
    log(`[updater] ${error.message}`)
  })

  const check = (): void => {
    autoUpdater.checkForUpdates().catch((error: unknown) => {
      log(`[updater] check failed: ${error instanceof Error ? error.message : 'unknown'}`)
    })
  }
  check()
  setInterval(check, CHECK_INTERVAL_MS)
}

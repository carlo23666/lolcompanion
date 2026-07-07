import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, dialog } from 'electron'
// electron-updater is CJS with getter-defined exports: a NAMED import from
// the ESM main bundle throws at startup ("does not provide an export named
// 'autoUpdater'") — the default-import interop is the only safe path.
import updaterPackage from 'electron-updater'

const { autoUpdater } = updaterPackage

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // every 4h while the app stays open

/** Packaged main-process stdout goes nowhere on Windows — the updater keeps
 * its own trace at <userData>/updater.log so failures are diagnosable. */
function makeFileLog(): (message: string) => void {
  const logFile = join(app.getPath('userData'), 'updater.log')
  return (message: string): void => {
    try {
      appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`)
    } catch {
      // Logging must never break the app.
    }
  }
}

/**
 * Auto-update against the latest GitHub release (electron-updater): checks on
 * startup and every few hours, downloads in the background, and asks before
 * restarting — never mid-game-relevant: the prompt is a plain dialog the user
 * can postpone; the update also applies on next quit automatically.
 * Dev builds skip everything (no feed, no noise).
 */
export function startAutoUpdater(consoleLog: (message: string) => void): void {
  if (!app.isPackaged) return

  const fileLog = makeFileLog()
  const log = (message: string): void => {
    consoleLog(message)
    fileLog(message)
  }
  // Full internal trace (feed URLs, version compare, download progress).
  const traced = (level: string) => (message: unknown) => {
    fileLog(`[${level}] ${typeof message === 'string' ? message : JSON.stringify(message)}`)
  }
  autoUpdater.logger = {
    info: traced('info'),
    warn: traced('warn'),
    error: traced('error'),
    debug: traced('debug')
  }

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

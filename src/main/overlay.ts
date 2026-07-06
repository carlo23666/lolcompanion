import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'

/**
 * Experimental in-game overlay (ADR-005 revisited at owner request):
 * a transparent, frameless, always-on-top window with the compact
 * recommendation card plus a hover-expanded stats panel. Click-through by
 * default (mouse events forward to the game); the renderer flips
 * interactivity on hover via `overlay:interactive`. Works over
 * windowed/borderless League; exclusive fullscreen hides it (documented
 * limitation).
 */
export class OverlayManager {
  private window: BrowserWindow | null = null

  /** true = the overlay accepts mouse input; false = clicks reach the game. */
  setInteractive(interactive: boolean): void {
    this.window?.setIgnoreMouseEvents(!interactive, { forward: true })
  }

  show(): void {
    if (this.window !== null) {
      this.window.showInactive()
      return
    }
    const display = screen.getPrimaryDisplay()
    const width = 400
    const height = 560
    const window = new BrowserWindow({
      width,
      height,
      x: display.workArea.x + display.workArea.width - width - 16,
      y: display.workArea.y + 16,
      transparent: true,
      frame: false,
      resizable: false,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
      webPreferences: {
        preload: join(import.meta.dirname, '../preload/index.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })
    // screen-saver level floats above borderless/windowed games.
    window.setAlwaysOnTop(true, 'screen-saver')
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    // Click-through until the pointer hovers the card (renderer flips it).
    window.setIgnoreMouseEvents(true, { forward: true })
    if (process.env['ELECTRON_RENDERER_URL']) {
      void window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?overlay=1`)
    } else {
      void window.loadFile(join(import.meta.dirname, '../renderer/index.html'), {
        query: { overlay: '1' }
      })
    }
    window.on('closed', () => {
      this.window = null
    })
    this.window = window
  }

  hide(): void {
    this.window?.hide()
  }

  destroy(): void {
    this.window?.destroy()
    this.window = null
  }
}

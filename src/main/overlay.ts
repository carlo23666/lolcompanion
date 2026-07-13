import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'
import {
  calculateOverlayBounds,
  normalizeOverlayScale,
  type OverlayPoint
} from './overlay-position'

interface OverlayManagerOptions {
  readScale(): number
  readPosition(): OverlayPoint | null
  writePosition(position: OverlayPoint): void
  clearPosition(): void
}

export interface OverlayConfiguration {
  scale?: number
  resetPosition?: boolean
  speechVisible?: boolean
}

/**
 * Experimental in-game overlay (ADR-005 revisited at owner request):
 * a transparent, frameless, always-on-top bottom dock with the active companion, the current
 * recommendation and temporary upward alerts. Click-through remains active outside the dock.
 * The authored scale is changed with Chromium zoom plus matching window bounds, so resizing never
 * crops the UI. The drag handle moves the native window and its last on-screen position persists.
 */
export class OverlayManager {
  private window: BrowserWindow | null = null
  private scale = 100
  private speechVisible = false
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly options: OverlayManagerOptions) {}

  /** true = the overlay accepts mouse input; false = clicks reach the game. */
  setInteractive(interactive: boolean): void {
    // Windows/Linux use a native input shape: only visible overlay content is
    // hit-testable, so the grip is always draggable and transparent pixels
    // fall through without renderer-driven hover toggling.
    if (process.platform === 'win32' || process.platform === 'linux') return
    this.window?.setIgnoreMouseEvents(!interactive, { forward: true })
  }

  moveBy(delta: { x: number; y: number }): void {
    const window = this.window
    if (window === null) return
    const current = window.getBounds()
    const requested = {
      x: current.x + Math.round(delta.x),
      y: current.y + Math.round(delta.y)
    }
    const display = screen.getDisplayNearestPoint(requested)
    window.setBounds(calculateOverlayBounds(display.workArea, this.scale, requested))
  }

  configure(configuration: OverlayConfiguration): void {
    if (configuration.scale !== undefined) this.applyScale(configuration.scale)
    if (configuration.resetPosition === true) this.resetPosition()
    if (configuration.speechVisible !== undefined) {
      this.speechVisible = configuration.speechVisible
      this.applyInputShape()
    }
  }

  show(): void {
    if (this.window !== null) {
      this.applyScale(this.options.readScale())
      this.window.showInactive()
      return
    }

    this.scale = normalizeOverlayScale(this.options.readScale())
    const savedPosition = this.options.readPosition()
    const display =
      savedPosition === null
        ? screen.getPrimaryDisplay()
        : screen.getDisplayNearestPoint(savedPosition)
    const bounds = calculateOverlayBounds(display.workArea, this.scale, savedPosition)
    const window = new BrowserWindow({
      ...bounds,
      transparent: true,
      frame: false,
      movable: true,
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
    window.webContents.setZoomFactor(this.scale / 100)
    window.setAlwaysOnTop(true, 'screen-saver')
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    if (process.platform === 'win32' || process.platform === 'linux') {
      window.setIgnoreMouseEvents(false)
      this.applyInputShape(bounds, window)
    } else {
      window.setIgnoreMouseEvents(true, { forward: true })
    }
    window.on('move', () => this.schedulePositionPersist())
    if (process.env['ELECTRON_RENDERER_URL']) {
      void window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?overlay=1`)
    } else {
      void window.loadFile(join(import.meta.dirname, '../renderer/index.html'), {
        query: { overlay: '1' }
      })
    }
    window.on('closed', () => {
      if (this.persistTimer !== null) clearTimeout(this.persistTimer)
      this.persistTimer = null
      this.window = null
    })
    this.window = window
  }

  hide(): void {
    this.speechVisible = false
    this.window?.hide()
  }

  destroy(): void {
    this.window?.destroy()
    this.window = null
  }

  private applyScale(value: number): void {
    this.scale = normalizeOverlayScale(value)
    const window = this.window
    if (window === null) return
    const current = window.getBounds()
    const center = {
      x: Math.round(current.x + current.width / 2),
      y: Math.round(current.y + current.height / 2)
    }
    const display = screen.getDisplayNearestPoint(center)
    const targetSize = calculateOverlayBounds(display.workArea, this.scale)
    const target = calculateOverlayBounds(display.workArea, this.scale, {
      x: Math.round(center.x - targetSize.width / 2),
      y: Math.round(center.y - targetSize.height / 2)
    })
    window.webContents.setZoomFactor(this.scale / 100)
    window.setBounds(target, true)
    this.applyInputShape(target)
  }

  private resetPosition(): void {
    this.options.clearPosition()
    const display = screen.getPrimaryDisplay()
    this.window?.setBounds(calculateOverlayBounds(display.workArea, this.scale), true)
  }

  private schedulePositionPersist(): void {
    if (this.persistTimer !== null) clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => {
      const bounds = this.window?.getBounds()
      if (bounds !== undefined) this.options.writePosition({ x: bounds.x, y: bounds.y })
      this.persistTimer = null
    }, 180)
  }

  private applyInputShape(
    bounds = this.window?.getBounds(),
    targetWindow = this.window
  ): void {
    if (
      targetWindow === null ||
      targetWindow === undefined ||
      bounds === undefined ||
      (process.platform !== 'win32' && process.platform !== 'linux')
    ) {
      return
    }
    if (this.speechVisible) {
      targetWindow.setShape([{ x: 0, y: 0, width: bounds.width, height: bounds.height }])
      return
    }
    const dockHeight = Math.min(bounds.height, Math.round(130 * (this.scale / 100)))
    targetWindow.setShape([
      { x: 0, y: bounds.height - dockHeight, width: bounds.width, height: dockHeight }
    ])
  }
}

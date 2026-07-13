import { normalizeOverlayScale, OVERLAY_SCALE_DEFAULT } from '@shared/overlay'
export { normalizeOverlayScale, OVERLAY_SCALE_DEFAULT } from '@shared/overlay'

export interface OverlayWorkArea {
  x: number
  y: number
  width: number
  height: number
}

export interface OverlayPoint {
  x: number
  y: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/**
 * Default dock position: bottom-right with an estimated minimap-width gap.
 * The window remains draggable because HUD scaling and custom layouts differ.
 */
export function calculateOverlayBounds(
  workArea: OverlayWorkArea,
  scaleValue: number | string = OVERLAY_SCALE_DEFAULT,
  savedPosition: OverlayPoint | null = null
): OverlayWorkArea {
  const scale = normalizeOverlayScale(scaleValue) / 100
  const width = Math.min(
    workArea.width - 24,
    Math.round((workArea.width < 1600 ? 360 : 420) * scale)
  )
  const height = Math.min(workArea.height - 24, Math.round(220 * scale))
  const minX = workArea.x + 12
  const maxX = workArea.x + workArea.width - width - 12
  const minY = workArea.y + 12
  const maxY = workArea.y + workArea.height - height - 12
  if (savedPosition !== null) {
    return {
      width,
      height,
      x: clamp(Math.round(savedPosition.x), minX, maxX),
      y: clamp(Math.round(savedPosition.y), minY, maxY)
    }
  }
  const shortEdge = Math.min(workArea.width, workArea.height)
  const minimapGap = Math.min(300, Math.max(190, Math.round(shortEdge * 0.23)))
  return {
    width,
    height,
    x: clamp(workArea.x + workArea.width - minimapGap - width - 18, minX, maxX),
    y: clamp(workArea.y + workArea.height - height - 16, minY, maxY)
  }
}

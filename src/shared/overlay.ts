export const OVERLAY_SCALE_MIN = 70
export const OVERLAY_SCALE_MAX = 150
export const OVERLAY_SCALE_DEFAULT = 100

export function normalizeOverlayScale(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return OVERLAY_SCALE_DEFAULT
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return OVERLAY_SCALE_DEFAULT
  return Math.min(OVERLAY_SCALE_MAX, Math.max(OVERLAY_SCALE_MIN, Math.round(parsed)))
}

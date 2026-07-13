import { describe, expect, it } from 'vitest'
import {
  calculateOverlayBounds,
  normalizeOverlayScale,
  OVERLAY_SCALE_DEFAULT
} from '@main/overlay-position'

describe('bottom overlay position', () => {
  it('reserves the minimap side and hugs the bottom on a 1080p display', () => {
    const bounds = calculateOverlayBounds({ x: 0, y: 0, width: 1920, height: 1040 })
    expect(bounds).toEqual({ width: 420, height: 220, x: 1243, y: 804 })
    expect(bounds.x + bounds.width).toBeLessThan(1920 - 190)
  })

  it('uses a narrower draggable dock on compact displays', () => {
    const bounds = calculateOverlayBounds({ x: 0, y: 0, width: 1366, height: 728 })
    expect(bounds.width).toBe(360)
    expect(bounds.height).toBe(220)
    expect(bounds.y + bounds.height).toBe(712)
    expect(bounds.x).toBeGreaterThanOrEqual(12)
  })

  it('scales the complete window while preserving the minimap gap', () => {
    const small = calculateOverlayBounds({ x: 0, y: 0, width: 1920, height: 1040 }, 70)
    const large = calculateOverlayBounds({ x: 0, y: 0, width: 1920, height: 1040 }, 150)
    expect(small).toMatchObject({ width: 294, height: 154 })
    expect(large).toMatchObject({ width: 630, height: 330 })
    expect(small.x + small.width).toBeLessThan(1920 - 190)
    expect(large.x + large.width).toBeLessThan(1920 - 190)
  })

  it('clamps a remembered position back onto the current display', () => {
    expect(
      calculateOverlayBounds(
        { x: 100, y: 50, width: 1366, height: 728 },
        100,
        { x: 4000, y: -900 }
      )
    ).toEqual({ width: 360, height: 220, x: 1094, y: 62 })
  })

  it('normalizes invalid and out-of-range scale values', () => {
    expect(normalizeOverlayScale(null)).toBe(OVERLAY_SCALE_DEFAULT)
    expect(normalizeOverlayScale('not-a-number')).toBe(OVERLAY_SCALE_DEFAULT)
    expect(normalizeOverlayScale(20)).toBe(70)
    expect(normalizeOverlayScale(190)).toBe(150)
  })
})

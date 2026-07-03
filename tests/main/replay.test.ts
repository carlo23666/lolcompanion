import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LiveClientSnapshot } from '@shared/schemas/liveclient'
import { ReplayDriver } from '@main/liveclient/replay'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

describe('ReplayDriver', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function build(): {
    driver: ReplayDriver
    processed: LiveClientSnapshot[]
    states: string[]
  } {
    const processed: LiveClientSnapshot[] = []
    const states: string[] = []
    const driver = new ReplayDriver({
      roots: [{ dir: join(fixturesDir, 'liveclient'), prefix: 'fix' }],
      process: (snapshot) => processed.push(snapshot),
      onStateChange: (state) => states.push(state)
    })
    return { driver, processed, states }
  }

  it('lists the bundled session fixture', () => {
    const { driver } = build()
    const sources = driver.list()
    const session = sources.find((source) => source.id === 'fix/session')
    expect(session).toBeDefined()
    expect(session?.snapshots).toBeGreaterThanOrEqual(6)
  })

  it('replays every snapshot in order and signals polling→unavailable', () => {
    const { driver, processed, states } = build()
    const result = driver.start('fix/session', 100)
    expect(result.started).toBe(true)
    expect(states).toEqual(['polling'])
    expect(processed.length).toBe(1) // first snapshot fires synchronously

    vi.advanceTimersByTime(2000)
    expect(processed.length).toBeGreaterThanOrEqual(6)
    // Snapshots arrive in game-time order.
    const times = processed.map((snapshot) => snapshot.gameData.gameTime)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(states).toEqual(['polling', 'unavailable'])
    expect(driver.status().running).toBe(false)
  })

  it('stop() ends the replay early', () => {
    const { driver, states } = build()
    driver.start('fix/session', 100)
    vi.advanceTimersByTime(150)
    driver.stop()
    expect(states).toEqual(['polling', 'unavailable'])
    // A stopped driver does not keep ticking.
    vi.advanceTimersByTime(1000)
    expect(driver.status().running).toBe(false)
  })

  it('unknown ids and path escapes are rejected', () => {
    const { driver } = build()
    expect(driver.start('fix/nope').started).toBe(false)
    expect(driver.start('otra/cosa').started).toBe(false)
    expect(driver.start('fix/../../secrets').started).toBe(false)
  })
})

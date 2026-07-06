import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveClientPoller, type LiveClientState } from '@main/liveclient/poller'

const samplePath = join(import.meta.dirname, '..', '..', 'fixtures', 'liveclientdata_sample.json')
const sample: unknown = JSON.parse(readFileSync(samplePath, 'utf8'))

describe('LiveClientPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('backs off exponentially while the port is closed (2→4→8→10 cap)', async () => {
    const calls: number[] = []
    let last = 0
    const transport = vi.fn().mockImplementation(() => {
      calls.push(Date.now() - last)
      last = Date.now()
      return Promise.reject(new Error('ECONNREFUSED'))
    })
    const poller = new LiveClientPoller({ transport, onSnapshot: vi.fn() })

    last = Date.now()
    poller.start()
    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(10_000)
    }
    poller.stop()

    // First call immediate, then 2s, 4s, 8s, 10s, 10s...
    expect(calls[0]).toBe(0)
    expect(calls[1]).toBe(2000)
    expect(calls[2]).toBe(4000)
    expect(calls[3]).toBe(8000)
    expect(calls[4]).toBe(10_000)
    expect(calls[5]).toBe(10_000)
    expect(poller.getState()).toBe('unavailable')
  })

  it('emits validated snapshots at fixed 2s cadence when the game is up', async () => {
    const transport = vi.fn().mockResolvedValue(sample)
    const snapshots = vi.fn()
    const states: LiveClientState[] = []
    const poller = new LiveClientPoller({
      transport,
      onSnapshot: snapshots,
      onStateChange: (s) => states.push(s)
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(snapshots).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(snapshots).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(4000)
    expect(snapshots).toHaveBeenCalledTimes(4)
    poller.stop()

    expect(states).toEqual(['polling'])
    expect(poller.getState()).toBe('polling')
  })

  it('recovers from unavailable to polling and resets the backoff', async () => {
    let failing = true
    const transport = vi.fn().mockImplementation(() =>
      failing ? Promise.reject(new Error('closed')) : Promise.resolve(sample)
    )
    const snapshots = vi.fn()
    const states: LiveClientState[] = []
    const poller = new LiveClientPoller({
      transport,
      onSnapshot: snapshots,
      onStateChange: (s) => states.push(s)
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(6000) // fails at 0, 2s, 6s
    failing = false
    await vi.advanceTimersByTimeAsync(8000) // succeeds at 14s
    expect(snapshots).toHaveBeenCalled()
    // Initial state is already 'unavailable'; only transitions are emitted.
    expect(states).toEqual(['polling'])

    // Cadence back to 2s after recovery.
    const before = snapshots.mock.calls.length
    await vi.advanceTimersByTimeAsync(2000)
    expect(snapshots.mock.calls.length).toBe(before + 1)
    poller.stop()
  })

  it('reports validation errors without emitting a snapshot', async () => {
    const transport = vi.fn().mockResolvedValue({ not: 'allgamedata' })
    const snapshots = vi.fn()
    const validationErrors = vi.fn()
    const poller = new LiveClientPoller({
      transport,
      onSnapshot: snapshots,
      onValidationError: validationErrors
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    poller.stop()

    expect(snapshots).not.toHaveBeenCalled()
    expect(validationErrors).toHaveBeenCalledTimes(1)
  })

  it('detects loading-screen payloads as a distinct loading state', async () => {
    // Game-shaped but partial: players without championName, runes null.
    const loadingPayload = {
      gameData: { gameTime: 0.05 },
      allPlayers: [{ riotIdGameName: 'PLAYER_1', runes: null }],
      events: { Events: [] }
    }
    let loading = true
    const transport = vi
      .fn()
      .mockImplementation(() => Promise.resolve(loading ? loadingPayload : sample))
    const states: LiveClientState[] = []
    const poller = new LiveClientPoller({
      transport,
      onSnapshot: vi.fn(),
      onStateChange: (s) => states.push(s)
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(4000)
    expect(poller.getState()).toBe('loading')
    loading = false
    await vi.advanceTimersByTimeAsync(2000)
    poller.stop()

    expect(states).toEqual(['loading', 'polling'])
  })

  it('reports one validation error per failure streak, not per tick', async () => {
    let malformed = true
    const transport = vi
      .fn()
      .mockImplementation(() => Promise.resolve(malformed ? { not: 'allgamedata' } : sample))
    const validationErrors = vi.fn()
    const poller = new LiveClientPoller({
      transport,
      onSnapshot: vi.fn(),
      onValidationError: validationErrors
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(10_000) // 6 malformed ticks
    expect(validationErrors).toHaveBeenCalledTimes(1)

    malformed = true
    await vi.advanceTimersByTimeAsync(2000)
    expect(validationErrors).toHaveBeenCalledTimes(1) // same streak

    malformed = false
    await vi.advanceTimersByTimeAsync(2000) // success resets the streak
    malformed = true
    await vi.advanceTimersByTimeAsync(2000)
    poller.stop()
    expect(validationErrors).toHaveBeenCalledTimes(2)
  })

  it('stops scheduling after stop()', async () => {
    const transport = vi.fn().mockResolvedValue(sample)
    const poller = new LiveClientPoller({ transport, onSnapshot: vi.fn() })
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    poller.stop()
    const calls = transport.mock.calls.length
    await vi.advanceTimersByTimeAsync(20_000)
    expect(transport.mock.calls.length).toBe(calls)
  })
})

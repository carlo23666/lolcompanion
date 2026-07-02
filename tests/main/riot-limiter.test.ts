import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RiotKeyInvalidError, RiotRateLimiter } from '@main/riot/limiter'

const ok = (): Response => new Response('{}', { status: 200 })
const tooMany = (retryAfterS: string): Response =>
  new Response('{}', { status: 429, headers: { 'Retry-After': retryAfterS } })

describe('RiotRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function makeLimiter(): { limiter: RiotRateLimiter; times: number[]; fire: () => Promise<Response> } {
    const limiter = new RiotRateLimiter({ methodLimits: {} })
    const times: number[] = []
    const start = Date.now()
    const fire = (): Promise<Response> => {
      times.push(Date.now() - start)
      return Promise.resolve(ok())
    }
    return { limiter, times, fire }
  }

  it('burst of 25: first 20 fire immediately, the rest wait for the 1s window', async () => {
    const { limiter, times, fire } = makeLimiter()
    const all = Promise.all(
      Array.from({ length: 25 }, () => limiter.execute('m', fire))
    )
    await vi.advanceTimersByTimeAsync(3000)
    await all

    expect(times.filter((t) => t < 1000)).toHaveLength(20)
    expect(times.filter((t) => t >= 1000)).toHaveLength(5)
  })

  it('respects the 100/120s window', async () => {
    const { limiter, times, fire } = makeLimiter()
    const all = Promise.all(
      Array.from({ length: 105 }, () => limiter.execute('m', fire))
    )
    await vi.advanceTimersByTimeAsync(125_000)
    await all

    expect(times.filter((t) => t < 120_000)).toHaveLength(100)
    expect(times.filter((t) => t >= 120_000)).toHaveLength(5)
  })

  it('honors Retry-After on 429 and replays the request', async () => {
    const limiter = new RiotRateLimiter({ methodLimits: {} })
    const request = vi
      .fn()
      .mockResolvedValueOnce(tooMany('3'))
      .mockResolvedValueOnce(ok())
    const start = Date.now()
    const promise = limiter.execute('m', request as () => Promise<Response>)
    await vi.advanceTimersByTimeAsync(5000)
    const response = await promise

    expect(response.status).toBe(200)
    expect(request).toHaveBeenCalledTimes(2)
    // The replay happened after the Retry-After pause.
    expect(Date.now() - start).toBeGreaterThanOrEqual(3000)
  })

  it('per-method limits apply independently of app limits', async () => {
    const limiter = new RiotRateLimiter({
      appLimits: [{ limit: 100, windowMs: 1000 }],
      methodLimits: { slow: [{ limit: 1, windowMs: 10_000 }] }
    })
    const times: number[] = []
    const start = Date.now()
    const fire = (): Promise<Response> => {
      times.push(Date.now() - start)
      return Promise.resolve(ok())
    }
    const all = Promise.all([
      limiter.execute('slow', fire),
      limiter.execute('slow', fire),
      limiter.execute('fast', fire)
    ])
    await vi.advanceTimersByTimeAsync(11_000)
    await all

    // slow #2 waited the full 10s method window; fast was unaffected.
    expect(times.filter((t) => t < 1000)).toHaveLength(2)
    expect(times.filter((t) => t >= 10_000)).toHaveLength(1)
  })

  it('403 marks the key invalid: queued and future requests fail fast', async () => {
    const limiter = new RiotRateLimiter({ methodLimits: {} })
    const forbidden = vi.fn().mockResolvedValue(new Response('{}', { status: 403 }))

    // Attach the rejection expectation BEFORE advancing timers so the
    // rejection is never momentarily unhandled.
    const first = expect(
      limiter.execute('m', forbidden as () => Promise<Response>)
    ).rejects.toThrow(RiotKeyInvalidError)
    await vi.advanceTimersByTimeAsync(10)
    await first
    await expect(limiter.execute('m', forbidden as () => Promise<Response>)).rejects.toThrow(
      RiotKeyInvalidError
    )
    expect(forbidden).toHaveBeenCalledTimes(1)
    expect(limiter.isKeyInvalid()).toBe(true)

    limiter.reset()
    expect(limiter.isKeyInvalid()).toBe(false)
  })

  it('lower priority number wins when both are queued', async () => {
    const limiter = new RiotRateLimiter({
      appLimits: [{ limit: 1, windowMs: 1000 }],
      methodLimits: {}
    })
    const order: string[] = []
    const task = (name: string) => (): Promise<Response> => {
      order.push(name)
      return Promise.resolve(ok())
    }
    // First request consumes the only token; the next two queue and reorder.
    const all = Promise.all([
      limiter.execute('m', task('first'), 10),
      limiter.execute('m', task('backfill'), 20),
      limiter.execute('m', task('interactive'), 1)
    ])
    await vi.advanceTimersByTimeAsync(3000)
    await all

    expect(order).toEqual(['first', 'interactive', 'backfill'])
  })
})

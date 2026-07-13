import { describe, expect, it, vi } from 'vitest'
import { createDevSourceCoordinator } from '@main/dev-source-coordinator'

describe('debug snapshot source ownership', () => {
  it('stops replay and scenario before resetting the normalized pipeline', () => {
    const calls: string[] = []
    const coordinator = createDevSourceCoordinator({
      stopReplay: vi.fn(() => calls.push('replay')),
      stopScenario: vi.fn(() => calls.push('scenario')),
      resetProcessor: vi.fn(() => calls.push('reset'))
    })

    coordinator.switchSource()

    expect(calls).toEqual(['replay', 'scenario', 'reset'])
  })
})

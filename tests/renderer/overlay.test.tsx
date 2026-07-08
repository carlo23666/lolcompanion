import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GameState } from '@shared/gamestate'
import type { IpcEventChannel, IpcEventChannels, RendererApi } from '@shared/ipc'
import OverlayApp from '@renderer/OverlayApp'
import midGameState from '../../fixtures/gamestate/mid.json'

const midState = midGameState as unknown as GameState

function stubOverlayApi(): {
  invoke: ReturnType<typeof vi.fn>
  emit<C extends IpcEventChannel>(channel: C, payload: IpcEventChannels[C]): void
} {
  const listeners = new Map<string, ((payload: unknown) => void)[]>()
  const invoke = vi.fn().mockImplementation((channel: string) => {
    if (channel === 'overlay:interactive') return Promise.resolve({ ok: true })
    // The overlay loads its locale from settings (existing-install default es).
    if (channel === 'settings:get') return Promise.resolve({ locale: 'es' })
    return Promise.resolve(null)
  })
  const api: RendererApi = {
    invoke,
    on(channel, listener) {
      const list = listeners.get(channel) ?? []
      list.push(listener as (payload: unknown) => void)
      listeners.set(channel, list)
      return () => void 0
    }
  }
  vi.stubGlobal('api', api)
  return {
    invoke,
    emit: (channel, payload) => {
      act(() => {
        for (const listener of listeners.get(channel) ?? []) listener(payload)
      })
    }
  }
}

describe('OverlayApp', () => {
  it('shows the top recommendation in the compact bubble', async () => {
    const stub = stubOverlayApi()
    render(<OverlayApp />)
    stub.emit('gamestate:recommendations', {
      gameTimeS: 600,
      recommendations: [
        {
          itemId: 3031,
          itemName: 'Filo Infinito',
          category: null,
          action: 'prioritize',
          score: 90,
          reasons: ['razón principal']
        }
      ]
    })
    expect(screen.getByText(/Filo Infinito/)).toBeInTheDocument()
    // Label localizes once the overlay's settings-driven locale resolves (es).
    expect(await screen.findByText('COMPRA YA')).toBeInTheDocument()
  })

  it('a coach tip makes Hexi walk in with the message, then leave', () => {
    vi.useFakeTimers()
    try {
      const stub = stubOverlayApi()
      render(<OverlayApp />)
      stub.emit('coach:tip', { gameTimeS: 700, text: 'Pon visión en el río, el dragón sale ya.' })
      expect(screen.getByTestId('coach-walk')).toBeInTheDocument()
      expect(screen.getByText(/Pon visión en el río/)).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(11_000) // stay elapsed → leaving
      })
      expect(screen.getByTestId('coach-walk').className).toContain('hexi-walk-out')
      act(() => {
        vi.advanceTimersByTime(1500) // walk-out done → gone
      })
      expect(screen.queryByTestId('coach-walk')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('expands the stats panel on hover, requests interactivity, and pins', async () => {
    const stub = stubOverlayApi()
    const user = userEvent.setup()
    render(<OverlayApp />)
    stub.emit('gamestate:update', midState)

    expect(screen.queryByTestId('overlay-expanded')).not.toBeInTheDocument()

    await user.hover(screen.getByText('LoL Companion'))
    expect(screen.getByTestId('overlay-expanded')).toBeInTheDocument()
    expect(stub.invoke).toHaveBeenCalledWith('overlay:interactive', true)
    // Game facts render: clock and objective chips.
    expect(screen.getByText(/⏱/)).toBeInTheDocument()
    expect(screen.getByText(/🐉/)).toBeInTheDocument()

    // Pinned: stays open after unhover, stays interactive.
    fireEvent.click(screen.getByRole('button', { name: '📌' }))
    expect(screen.getByRole('button', { name: '📌' })).toHaveAttribute('aria-pressed', 'true')
    await user.unhover(screen.getByText('LoL Companion'))
    expect(screen.getByTestId('overlay-expanded')).toBeInTheDocument()
    expect(stub.invoke).not.toHaveBeenCalledWith('overlay:interactive', false)
  })
})

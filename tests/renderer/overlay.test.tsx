import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
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
    if (
      channel === 'overlay:interactive' ||
      channel === 'overlay:move' ||
      channel === 'overlay:configure'
    ) {
      return Promise.resolve({ ok: true })
    }
    if (channel === 'settings:get') return Promise.resolve({ locale: 'es', theme: 'rift' })
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

function emitRecommendation(stub: ReturnType<typeof stubOverlayApi>): void {
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
}

describe('OverlayApp', () => {
  it('keeps Hexi and the top recommendation in a persistent bottom dock', async () => {
    const stub = stubOverlayApi()
    render(<OverlayApp />)
    emitRecommendation(stub)
    expect(screen.getByTestId('overlay-dock')).toBeInTheDocument()
    expect(screen.getByTestId('overlay-root')).toHaveClass('select-none')
    expect(screen.getByTestId('overlay-interaction-zone')).toHaveClass('-mt-5', 'pt-5')
    expect(screen.getByTestId('overlay-drag-approach')).toHaveClass('top-0', 'h-5')
    expect(screen.getByTestId('overlay-drag-handle')).toHaveClass(
      'overlay-native-drag',
      'right-0',
      'left-0',
      'h-5'
    )
    const handle = screen.getByTestId('overlay-drag-handle')
    fireEvent.pointerDown(handle, { pointerId: 7, screenX: 100, screenY: 100 })
    fireEvent.pointerMove(handle, { pointerId: 7, screenX: 124, screenY: 82 })
    fireEvent.pointerUp(handle, { pointerId: 7, screenX: 124, screenY: 82 })
    expect(stub.invoke).toHaveBeenCalledWith('overlay:move', { x: 24, y: -18 })
    expect(screen.getAllByText(/Filo Infinito/).length).toBeGreaterThanOrEqual(1)
    expect(await screen.findByText('ASEQUIBLE')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Hexi/ })).toBeInTheDocument()
  })

  it('shows a coach tip above the stable dock, then hides only the speech', () => {
    vi.useFakeTimers()
    try {
      const stub = stubOverlayApi()
      render(<OverlayApp />)
      stub.emit('coach:tip', {
        gameTimeS: 700,
        text: 'Si mantenéis prioridad, considera preparar visión antes del dragón.'
      })
      expect(screen.getByTestId('overlay-speech')).toBeInTheDocument()
      expect(screen.getByTestId('overlay-root')).toHaveClass('gap-2')
      expect(screen.getByTestId('overlay-speech')).not.toHaveClass('absolute')
      expect(screen.getByText(/considera preparar visión/)).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(10_600)
      })
      expect(screen.queryByTestId('overlay-speech')).not.toBeInTheDocument()
      expect(screen.getByTestId('overlay-dock')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows a typed item icon and name when the next-buy recommendation changes', async () => {
    const stub = stubOverlayApi()
    render(<OverlayApp />)
    await screen.findByText('Esperando recomendación…')
    emitRecommendation(stub)

    const speech = screen.getByTestId('overlay-speech')
    const item = within(speech).getByRole('img', { name: 'Filo Infinito' })
    expect(item).toHaveAttribute('src', 'ddicon://item/3031.png')
    expect(within(speech).getByText('PRÓXIMA COMPRA')).toBeInTheDocument()
    expect(within(speech).getByText('Filo Infinito')).toBeInTheDocument()
    expect(within(speech).getByText('razón principal')).toBeInTheDocument()
  })

  it('shows a conditional visible-material duel signal without hidden-gold claims', async () => {
    const stub = stubOverlayApi()
    render(<OverlayApp />)
    await screen.findByText('Esperando recomendación…')
    stub.emit('gamestate:duel', {
      gameTimeS: 900,
      opponentChampionName: 'Caitlyn',
      score: 9,
      advantages: [
        { kind: 'levels', amount: 2 },
        { kind: 'completedItems', amount: 1 }
      ]
    })

    const speech = screen.getByTestId('overlay-speech')
    expect(within(speech).getByText(/2 niveles y un objeto completado/)).toBeInTheDocument()
    expect(within(speech).getByText(/si el duelo está realmente aislado/)).toBeInTheDocument()
    expect(speech).not.toHaveTextContent(/oro enemigo|cooldown|enfriamiento/i)
  })

  it('shows compact live facts and only requests input over the dock', () => {
    const stub = stubOverlayApi()
    render(<OverlayApp />)
    stub.emit('gamestate:update', midState)

    const dock = screen.getByTestId('overlay-dock')
    const approach = screen.getByTestId('overlay-drag-approach')
    expect(screen.getByText('15:00')).toBeInTheDocument()
    expect(screen.getByText('1250g')).toBeInTheDocument()
    fireEvent.mouseMove(approach)
    expect(stub.invoke).toHaveBeenCalledWith('overlay:interactive', true)
    fireEvent.mouseEnter(dock)
    expect(stub.invoke).toHaveBeenCalledWith('overlay:interactive', true)
    fireEvent.mouseLeave(dock)
    expect(stub.invoke).toHaveBeenCalledWith('overlay:interactive', false)
  })

  it('switches the live overlay identity when the main window previews a theme', async () => {
    const stub = stubOverlayApi()
    render(<OverlayApp />)
    expect(await screen.findByRole('img', { name: /Hexi/ })).toBeInTheDocument()

    stub.emit('appearance:theme', 'dark')
    expect(document.documentElement.dataset['theme']).toBe('dark')
    expect(screen.getByRole('img', { name: /Sombra/ })).toHaveAttribute('data-mascot', 'dark')
  })

  it('clears recommendations and transient speech on an explicit session reset', () => {
    const stub = stubOverlayApi()
    render(<OverlayApp />)
    emitRecommendation(stub)
    stub.emit('coach:tip', { gameTimeS: 700, text: 'Mensaje de la partida anterior.' })
    expect(screen.getByText('Mensaje de la partida anterior.')).toBeInTheDocument()
    expect(screen.getByText(/Filo Infinito/)).toBeInTheDocument()

    stub.emit('gamestate:reset', { atMs: 123 })
    expect(screen.queryByText('Mensaje de la partida anterior.')).not.toBeInTheDocument()
    expect(screen.queryByText(/Filo Infinito/)).not.toBeInTheDocument()
    expect(screen.getByText(/recommendation|recomendación/i)).toBeInTheDocument()
  })
})

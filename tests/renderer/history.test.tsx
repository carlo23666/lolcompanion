import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RendererApi } from '@shared/ipc'
import type { HistoryAggregate, HistoryDetail, HistoryRow } from '@shared/history'
import HistoryView from '@renderer/components/HistoryView'

const rows: HistoryRow[] = [
  {
    matchId: 'EUW1_2',
    champion: 'Jinx',
    role: 'BOTTOM',
    kills: 11,
    deaths: 3,
    assists: 5,
    csPerMin: 7.1,
    win: true,
    durationS: 1854,
    patch: '16.13',
    gameCreation: 1751400000000,
    queueId: 420
  },
  {
    matchId: 'EUW1_1',
    champion: 'Ahri',
    role: 'MIDDLE',
    kills: 3,
    deaths: 6,
    assists: 9,
    csPerMin: 6.2,
    win: false,
    durationS: 1500,
    patch: '16.13',
    gameCreation: 1751300000000,
    queueId: 420
  }
]

const aggregates: HistoryAggregate[] = [
  { champion: 'Jinx', games: 12, winratePct: 58.3, csPerMin: 7.0 },
  { champion: 'Ahri', games: 8, winratePct: 42, csPerMin: 6.1 }
]

const detail: HistoryDetail = {
  matchId: 'EUW1_2',
  champion: 'Jinx',
  win: true,
  kills: 11,
  deaths: 3,
  assists: 5,
  cs: 218,
  gold: 14900,
  damage: 31500,
  vision: 15,
  durationS: 1854,
  patch: '16.13',
  items: [3031, 3006, 3085],
  goldCurve: [500, 1200, 2100, 3300, 4700]
}

function stubHistoryApi(): ReturnType<typeof vi.fn> {
  const invoke = vi.fn().mockImplementation((channel: string, ...args: unknown[]) => {
    if (channel === 'history:list') {
      const filter = args[0] as { champion?: string } | undefined
      return Promise.resolve(
        filter?.champion !== undefined
          ? rows.filter((row) => row.champion === filter.champion)
          : rows
      )
    }
    if (channel === 'history:aggregates') return Promise.resolve(aggregates)
    if (channel === 'history:champions') return Promise.resolve(['Ahri', 'Jinx'])
    if (channel === 'history:detail') return Promise.resolve(detail)
    return Promise.resolve(null)
  })
  const api: RendererApi = {
    invoke: invoke,
    on: () => () => void 0
  }
  vi.stubGlobal('api', api)
  return invoke
}

describe('HistoryView', () => {
  it('renders aggregates header and the match list', async () => {
    stubHistoryApi()
    render(<HistoryView />)
    expect(await screen.findByText(/Jinx · 12p ·/)).toBeInTheDocument()
    expect(screen.getByText('58% WR')).toBeInTheDocument()
    expect(screen.getByText('11/3/5')).toBeInTheDocument()
    expect(screen.getByText('Victoria')).toBeInTheDocument()
    expect(screen.getByText('Derrota')).toBeInTheDocument()
    expect(screen.getByText('7.1 CS/min')).toBeInTheDocument()
  })

  it('filters by champion', async () => {
    const invoke = stubHistoryApi()
    const user = userEvent.setup()
    render(<HistoryView />)
    await screen.findByText('Victoria')

    await user.selectOptions(screen.getByLabelText('Filtrar por campeón'), 'Jinx')
    expect(await screen.findByText('11/3/5')).toBeInTheDocument()
    expect(screen.queryByText('Derrota')).not.toBeInTheDocument()
    expect(invoke).toHaveBeenCalledWith('history:list', { champion: 'Jinx' })
  })

  it('opens the detail drawer with build and gold sparkline', async () => {
    stubHistoryApi()
    const user = userEvent.setup()
    render(<HistoryView />)

    await user.click(await screen.findByText('11/3/5'))
    expect(await screen.findByText('Build final')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Curva de oro por minuto' })).toBeInTheDocument()
    expect(screen.getByAltText('objeto 3031').getAttribute('src')).toBe('ddicon://item/3031.png')
  })
})

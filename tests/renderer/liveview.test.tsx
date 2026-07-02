import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { GameState } from '@shared/gamestate'
import LiveView from '@renderer/components/LiveView'
import midGameState from '../../fixtures/gamestate/mid.json'

const mid = midGameState as unknown as GameState

describe('LiveView', () => {
  it('renders every designed empty state', () => {
    const { rerender } = render(<LiveView phase="idle" gameState={null} champSelect={null} />)
    expect(screen.getByText('Sin cliente de LoL')).toBeInTheDocument()

    rerender(<LiveView phase="clientOpen" gameState={null} champSelect={null} />)
    expect(screen.getByText(/Entra en cola/)).toBeInTheDocument()

    rerender(<LiveView phase="postGame" gameState={null} champSelect={null} />)
    expect(screen.getByText(/se guardará en el historial/)).toBeInTheDocument()

    rerender(<LiveView phase="inGame" gameState={null} champSelect={null} />)
    expect(screen.getByText('Conectando con la partida')).toBeInTheDocument()
  })

  it('renders the champ select placeholder with own position', () => {
    const champSelect = {
      localPlayerCellId: 2,
      ownPosition: 'middle',
      myTeam: [
        { cellId: 0, championId: 266, championPickIntent: 0, position: 'top' },
        { cellId: 2, championId: 0, championPickIntent: 103, position: 'middle' }
      ],
      theirTeam: [{ cellId: 5, championId: 157 }],
      bans: { mine: [], theirs: [] },
      timerPhase: 'BAN_PICK'
    }
    const { rerender } = render(
      <LiveView
        phase="champSelect"
        gameState={null}
        champSelect={champSelect}
        championNames={{ 266: 'Aatrox', 103: 'Ahri', 157: 'Yasuo' }}
      />
    )
    expect(screen.getByText(/tu posición: middle/)).toBeInTheDocument()
    // Picked champion and pick intent resolve to display names.
    expect(screen.getByText(/Aatrox, Ahri/)).toBeInTheDocument()
    expect(screen.getByText(/Yasuo/)).toBeInTheDocument()

    // Without static data the raw ids remain visible.
    rerender(<LiveView phase="champSelect" gameState={null} champSelect={champSelect} />)
    expect(screen.getByText(/266, 103/)).toBeInTheDocument()
    expect(screen.getByText(/157/)).toBeInTheDocument()
  })

  it('in game: shows live insights (alerts, objective timers, team gold)', () => {
    render(
      <LiveView
        phase="inGame"
        gameState={mid}
        champSelect={null}
        insights={{
          alerts: [
            { id: 1, gameTimeS: 840, kind: 'spike', text: 'Zed completó Filo Duskblade — power spike' }
          ],
          // mid fixture is at 15:00 → dragon already up, baron in 5:00.
          nextDragonS: 400,
          nextBaronS: 1200
        }}
      />
    )
    expect(screen.getByText(/power spike/)).toBeInTheDocument()
    expect(screen.getByText(/🐉 en el mapa/)).toBeInTheDocument()
    expect(screen.getByText(/Barón en 5:00/)).toBeInTheDocument()
    // Team gold bar shows a signed diff in thousands.
    expect(screen.getByText(/[▲▼] \d+\.\dk/)).toBeInTheDocument()
  })

  it('in game: shows clock, own gold, both teams with items and gauges', () => {
    render(<LiveView phase="inGame" gameState={mid} champSelect={null} />)

    // Header: 15:00, own gold 1250, self KDA 4/1/3.
    expect(screen.getByText(/15:00/)).toBeInTheDocument()
    expect(screen.getByText(/1250/)).toBeInTheDocument()

    // Teams: self highlighted among allies, 5 enemies with items.
    expect(screen.getByRole('heading', { name: 'Tu equipo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Enemigos' })).toBeInTheDocument()
    expect(screen.getByText('Jinx')).toBeInTheDocument()
    expect(screen.getByText('Aatrox')).toBeInTheDocument()

    // Item icons come from the local ddicon protocol, never the CDN.
    const jinxItems = screen.getByTestId('items-Jinx')
    const icons = within(jinxItems).getAllByRole('img')
    expect(icons.length).toBeGreaterThanOrEqual(3)
    for (const icon of icons) {
      expect(icon.getAttribute('src')).toMatch(/^ddicon:\/\/item\//)
    }

    // Gauges reflect the mid fixture (~81% physical, antiheal chip visible).
    expect(screen.getByText(/Daño físico 8\d%/)).toBeInTheDocument()
    expect(screen.getByText('considera antiheal')).toBeInTheDocument()

    // Objectives row present.
    expect(screen.getByText('Aliados')).toBeInTheDocument()
  })

  it('marks dead players with their respawn timer', () => {
    const withDead = structuredClone(mid)
    const enemy = withDead.enemies[0]
    if (!enemy) throw new Error('fixture missing enemy')
    enemy.isDead = true
    enemy.respawnTimer = 23.4
    render(<LiveView phase="inGame" gameState={withDead} champSelect={null} />)
    expect(screen.getByText('24')).toBeInTheDocument()
  })
})

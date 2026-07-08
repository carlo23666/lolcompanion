import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { GameState } from '@shared/gamestate'
import LiveView from '@renderer/components/LiveView'
import { LocaleProvider } from '@renderer/i18n'
import midGameState from '../../fixtures/gamestate/mid.json'

const mid = midGameState as unknown as GameState

// These assertions are in Spanish (the default for existing installs): render
// under an es provider so useT resolves to Spanish, as the app does at runtime.
const esWrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <LocaleProvider locale="es">{children}</LocaleProvider>
)

describe('LiveView', () => {
  it('renders the home dashboard while no game runs and the other states', () => {
    const { rerender } = render(<LiveView phase="idle" gameState={null} champSelect={null} />, {
      wrapper: esWrapper
    })
    expect(screen.getByText('Descansando el cristal…')).toBeInTheDocument()

    rerender(<LiveView phase="clientOpen" gameState={null} champSelect={null} />)
    expect(screen.getByText('¡Lista para la cola!')).toBeInTheDocument()

    rerender(<LiveView phase="postGame" gameState={null} champSelect={null} />)
    expect(screen.getByText(/Fin de la partida/)).toBeInTheDocument()

    rerender(<LiveView phase="inGame" gameState={null} champSelect={null} />)
    expect(screen.getByText('Conectando con la partida')).toBeInTheDocument()
  })

  it('champ select: portraits from champion meta, raw ids as fallback', () => {
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
    const championMeta = {
      266: { id: 'Aatrox', name: 'Aatrox', damageType: 'physical' as const },
      103: { id: 'Ahri', name: 'Ahri', damageType: 'magic' as const },
      157: { id: 'Yasuo', name: 'Yasuo', damageType: 'physical' as const }
    }
    const { rerender } = render(
      <LiveView
        phase="champSelect"
        gameState={null}
        champSelect={champSelect}
        championMeta={championMeta}
      />
    )
    expect(screen.getByText(/tu posición: MID/)).toBeInTheDocument()
    // Ally pick, own pick intent and the enemy pick render as portraits
    // served by the local ddicon protocol.
    for (const name of ['Aatrox', 'Ahri', 'Yasuo']) {
      const img = screen.getByRole('img', { name })
      expect(img.getAttribute('src')).toBe(`ddicon://champion/${name}.png`)
    }

    // Without static data the raw ids remain visible as placeholders.
    rerender(<LiveView phase="champSelect" gameState={null} champSelect={champSelect} />)
    expect(screen.getByText('266')).toBeInTheDocument()
    expect(screen.getByText('103')).toBeInTheDocument()
    expect(screen.getByText('157')).toBeInTheDocument()
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
      />,
      { wrapper: esWrapper }
    )
    expect(screen.getByText(/power spike/)).toBeInTheDocument()
    expect(screen.getByText(/🐉 en el mapa/)).toBeInTheDocument()
    expect(screen.getByText(/Barón en 5:00/)).toBeInTheDocument()
    // Team gold bar shows a signed diff in thousands.
    expect(screen.getByText(/[▲▼] \d+\.\dk/)).toBeInTheDocument()
  })

  it('in game: shows clock, own gold, both teams with items and gauges', () => {
    render(<LiveView phase="inGame" gameState={mid} champSelect={null} />, { wrapper: esWrapper })

    // Header: 15:00, own gold 1250, self KDA 4/1/3.
    expect(screen.getByText(/15:00/)).toBeInTheDocument()
    expect(screen.getByText(/1250/)).toBeInTheDocument()

    // Teams: self highlighted among allies, 5 enemies with items.
    expect(screen.getByRole('heading', { name: 'Tu equipo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Enemigos' })).toBeInTheDocument()
    // Jinx appears in the HUD strip AND her team row.
    expect(screen.getAllByText('Jinx').length).toBeGreaterThanOrEqual(2)
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

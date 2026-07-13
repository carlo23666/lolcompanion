import { describe, expect, it } from 'vitest'
import type { GameState, GameStateItem, PlayerState } from '@shared/gamestate'
import { materialAdvantageSignal } from '@main/engine/duel'
import midGameState from '../../fixtures/gamestate/mid.json'

function state(): GameState {
  const value = structuredClone(midGameState) as unknown as GameState
  for (const enemy of value.enemies) {
    enemy.visibleHealth = { current: 1500, max: 1800 }
  }
  return value
}

function laneOpponent(value: GameState): PlayerState {
  const enemy = value.enemies.find((candidate) => candidate.position === value.self.position)
  if (enemy === undefined) throw new Error('fixture missing same-role opponent')
  return enemy
}

const EXTRA_COMPLETED_ITEM: GameStateItem = {
  id: 6672,
  name: 'Kraken Slayer',
  totalGold: 3100,
  isCompleted: true,
  tags: ['Damage', 'AttackSpeed'],
  stats: { FlatPhysicalDamageMod: 45 }
}

describe('materialAdvantageSignal', () => {
  it('returns a conditional signal for a clear visible level and item lead', () => {
    const value = state()
    const enemy = laneOpponent(value)
    value.self.level = enemy.level + 2
    value.self.items.push(EXTRA_COMPLETED_ITEM)

    const signal = materialAdvantageSignal(value)

    expect(signal?.opponentChampionName).toBe(enemy.championName)
    expect(signal?.score).toBeGreaterThanOrEqual(7)
    expect(signal?.advantages.map((reason) => reason.kind)).toEqual(
      expect.arrayContaining(['levels', 'completedItems'])
    )
  })

  it('stays silent for an even visible state', () => {
    const value = state()
    const enemy = laneOpponent(value)
    value.self.level = enemy.level
    value.self.items = structuredClone(enemy.items)
    value.self.scores = structuredClone(enemy.scores)
    value.self.stats.currentHealth = 1500
    value.self.stats.maxHealth = 1800

    expect(materialAdvantageSignal(value)).toBeNull()
  })

  it('still uses clear item and level evidence when enemy health is unavailable', () => {
    const value = state()
    const enemy = laneOpponent(value)
    delete enemy.visibleHealth
    value.self.level = enemy.level + 2
    value.self.items.push(EXTRA_COMPLETED_ITEM)

    expect(materialAdvantageSignal(value)?.opponentChampionName).toBe(enemy.championName)
  })

  it('never treats the hidden-gold estimate as a material lead', () => {
    const value = state()
    const enemy = laneOpponent(value)
    value.self.level = enemy.level
    value.self.items = structuredClone(enemy.items)
    value.self.scores = structuredClone(enemy.scores)
    value.self.stats.currentHealth = 1500
    value.self.stats.maxHealth = 1800
    value.self.estimatedGoldEarned = enemy.estimatedGoldEarned + 10_000

    expect(materialAdvantageSignal(value)).toBeNull()
  })

  it('stays silent when the player is too low to call the duel favorable', () => {
    const value = state()
    const enemy = laneOpponent(value)
    value.self.level = enemy.level + 3
    value.self.items.push(EXTRA_COMPLETED_ITEM)
    value.self.stats.currentHealth = 500
    value.self.stats.maxHealth = 1800

    expect(materialAdvantageSignal(value)).toBeNull()
  })
})

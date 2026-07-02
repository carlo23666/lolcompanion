import type { GameState, PlayerState } from '@shared/gamestate'
import type { StaticData } from '../../staticdata/manager'
import { playerDamageSplit } from '../normalize'

/** Own build leans physical? (champion profile + bought items) */
export function selfIsPhysical(state: GameState): boolean {
  const [phys] = playerDamageSplit(state.self.damageType, state.self.items)
  return phys >= 0.5
}

export function ownsAny(player: PlayerState, itemIds: readonly number[]): boolean {
  return player.items.some((item) => itemIds.includes(item.id))
}

export function itemName(staticData: StaticData, itemId: number): string {
  return staticData.itemGraph.nodes.get(itemId)?.name ?? `objeto ${String(itemId)}`
}

export function itemCost(staticData: StaticData, itemId: number): number {
  return staticData.itemGraph.nodes.get(itemId)?.totalGold ?? 0
}

/** First id of the list that exists and is purchasable on SR this patch. */
export function firstAvailable(
  staticData: StaticData,
  itemIds: readonly number[]
): number | null {
  for (const id of itemIds) {
    if (staticData.itemGraph.nodes.get(id)?.availableOnSR === true) return id
  }
  return null
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function pct(share: number): string {
  return `${String(Math.round(share * 100))}%`
}

/** "Zed (8/3)" style short descriptor for reasons. */
export function kdaLabel(player: PlayerState): string {
  return `${player.championName} (${String(player.scores.kills)}/${String(player.scores.deaths)})`
}

import type { DdItem } from '@shared/schemas/ddragon'

export interface ItemNode {
  id: number
  name: string
  /** Direct components (item ids). */
  buildsFrom: number[]
  /** Items this one builds into (item ids). */
  buildsInto: number[]
  /** Full price including all components. */
  totalGold: number
  /** Combine cost of this item alone (total minus component totals). */
  recipeGold: number
  purchasable: boolean
  /** Available on Summoner's Rift (map 11), purchasable, not champ-locked. */
  availableOnSR: boolean
  tags: string[]
  stats: Record<string, number>
  depth: number
}

export interface ItemGraph {
  nodes: Map<number, ItemNode>
  /** All completed (non-component, purchasable, SR) items. */
  finishedSRItems: ItemNode[]
}

const SUMMONERS_RIFT_MAP_ID = '11'

export function buildItemGraph(items: Record<string, DdItem>): ItemGraph {
  const nodes = new Map<number, ItemNode>()

  for (const [idStr, item] of Object.entries(items)) {
    const id = Number(idStr)
    const buildsFrom = (item.from ?? []).map(Number)
    const componentTotal = buildsFrom.reduce(
      (sum, componentId) => sum + (items[String(componentId)]?.gold.total ?? 0),
      0
    )
    nodes.set(id, {
      id,
      name: item.name,
      buildsFrom,
      buildsInto: (item.into ?? []).map(Number),
      totalGold: item.gold.total,
      recipeGold: item.gold.total - componentTotal,
      purchasable: item.gold.purchasable,
      availableOnSR:
        (item.maps[SUMMONERS_RIFT_MAP_ID] ?? false) &&
        item.gold.purchasable &&
        item.requiredChampion === undefined &&
        item.requiredAlly === undefined &&
        item.consumed !== true,
      tags: item.tags,
      stats: item.stats,
      depth: item.depth ?? 1
    })
  }

  const finishedSRItems = [...nodes.values()].filter(
    (node) => node.availableOnSR && node.buildsInto.length === 0 && node.totalGold > 0
  )

  return { nodes, finishedSRItems }
}

/** Flattens the full component tree of an item (recursive buildsFrom). */
export function componentTree(graph: ItemGraph, itemId: number): number[] {
  const node = graph.nodes.get(itemId)
  if (!node) return []
  const result: number[] = []
  for (const componentId of node.buildsFrom) {
    result.push(componentId, ...componentTree(graph, componentId))
  }
  return result
}

/** Follows buildsInto repeatedly to list every upgrade reachable from an item. */
export function upgradeChain(graph: ItemGraph, itemId: number): number[] {
  const seen = new Set<number>()
  const queue = [...(graph.nodes.get(itemId)?.buildsInto ?? [])]
  while (queue.length > 0) {
    const next = queue.shift()
    if (next === undefined || seen.has(next)) continue
    seen.add(next)
    queue.push(...(graph.nodes.get(next)?.buildsInto ?? []))
  }
  return [...seen]
}

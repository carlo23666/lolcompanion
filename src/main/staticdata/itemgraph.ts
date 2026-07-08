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
  /** Named passives parsed from the description markup (`<passive>X</passive>`). */
  passives: string[]
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
      depth: item.depth ?? 1,
      passives: parsePassives(item.description)
    })
  }

  const finishedSRItems = [...nodes.values()].filter(
    (node) => node.availableOnSR && node.buildsInto.length === 0 && node.totalGold > 0
  )

  return { nodes, finishedSRItems }
}

/**
 * Items that can be a slot in a real build plan: purchasable finished pieces —
 * legendaries (nothing builds out of them) and finished boots (their tier-3
 * upgrade doesn't demote them to "component"). Excludes raw components
 * (Bramble, Sheen…), starters, trinkets and consumables: advising those as
 * build slots is exactly the "Bramble first on Nasus" bug (WP-015).
 */
export function isFinishedBuildItem(node: ItemNode): boolean {
  if (!node.availableOnSR || node.depth < 2) return false
  if (node.tags.includes('Trinket') || node.tags.includes('Consumable')) return false
  return node.buildsInto.length === 0 || node.tags.includes('Boots')
}

const PASSIVE_MARKUP = /<passive>(.*?)<\/passive>/g

function parsePassives(description: string | undefined): string[] {
  if (description === undefined) return []
  const names = new Set<string>()
  for (const match of description.matchAll(PASSIVE_MARKUP)) {
    const name = (match[1] ?? '').trim()
    if (name.length > 0) names.add(name)
  }
  return [...names]
}

/**
 * Exclusivity between two items, derived from the patch data: items sharing a
 * named passive map 1:1 onto the in-game "Limited to 1 X item" groups (and
 * where they don't, advising both is redundant anyway); finished boots form
 * their own group. Returns the shared group label, or null when the pair is
 * compatible. Starters (depth 1) share gold passives but coexist fine, and an
 * item never conflicts with its own components or upgrades.
 */
export function itemConflict(graph: ItemGraph, aId: number, bId: number): string | null {
  if (aId === bId) return null
  const a = graph.nodes.get(aId)
  const b = graph.nodes.get(bId)
  if (!a || !b) return null
  if (a.depth < 2 || b.depth < 2) return null
  if (componentTree(graph, aId).includes(bId) || componentTree(graph, bId).includes(aId)) {
    return null
  }
  if (a.tags.includes('Boots') && b.tags.includes('Boots')) return 'Botas'
  return a.passives.find((passive) => b.passives.includes(passive)) ?? null
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

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { itemFileSchema } from '@shared/schemas/ddragon'
import { buildItemGraph, componentTree, upgradeChain } from '@main/staticdata/itemgraph'

const dir = join(import.meta.dirname, '..', '..', 'fixtures', 'ddragon', '16.13.1')
const itemFile = itemFileSchema.parse(
  JSON.parse(readFileSync(join(dir, 'item.json'), 'utf8'))
)
const graph = buildItemGraph(itemFile.data)

const IDS = {
  boots: 1001,
  bfSword: 1038,
  pickaxe: 1037,
  cloakOfAgility: 1018,
  infinityEdge: 3031,
  berserkersGreaves: 3006
}

describe('item graph (patch 16.13.1 fixture)', () => {
  it('Infinity Edge components and gold are correct', () => {
    const ie = graph.nodes.get(IDS.infinityEdge)
    expect(ie).toBeDefined()
    expect(ie?.buildsFrom.sort()).toEqual(
      [IDS.bfSword, IDS.pickaxe, IDS.cloakOfAgility].sort()
    )
    expect(ie?.totalGold).toBe(3500)
    // recipe = total - components (BF 1300 + Pickaxe 875 + Cloak 600)
    expect(ie?.recipeGold).toBe(3500 - 1300 - 875 - 600)
    expect(ie?.availableOnSR).toBe(true)
  })

  it('component totals always sum consistently (recipe never negative)', () => {
    const broken = [...graph.nodes.values()].filter(
      (node) => node.purchasable && node.recipeGold < 0
    )
    expect(broken).toEqual([])
  })

  it('boots upgrade chain resolves from base Boots', () => {
    const chain = upgradeChain(graph, IDS.boots)
    expect(chain).toContain(IDS.berserkersGreaves)
    expect(chain.length).toBeGreaterThanOrEqual(5)
    const berserkers = graph.nodes.get(IDS.berserkersGreaves)
    expect(berserkers?.buildsFrom).toContain(IDS.boots)
  })

  it('componentTree flattens nested components', () => {
    const tree = componentTree(graph, IDS.infinityEdge)
    expect(tree).toContain(IDS.bfSword)
    expect(tree).toContain(IDS.pickaxe)
    expect(tree).toContain(IDS.cloakOfAgility)
  })

  it('SR filter excludes non-purchasable and off-map items', () => {
    for (const node of graph.finishedSRItems) {
      expect(node.purchasable).toBe(true)
      expect(node.totalGold).toBeGreaterThan(0)
      expect(node.buildsInto).toEqual([])
    }
    expect(graph.finishedSRItems.length).toBeGreaterThan(50)
  })
})

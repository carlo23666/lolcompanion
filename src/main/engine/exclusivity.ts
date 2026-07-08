import type { Recommendation } from '@shared/recommendation'
import type { Translator } from '@shared/i18n'
import type { StaticData } from '../staticdata/manager'
import { itemConflict } from '../staticdata/itemgraph'
import { defaultTranslator } from './rules/helpers'

/**
 * Final exclusivity pass over the sorted recommendation list: never advise an
 * item that can't (or shouldn't) be carried next to one the player owns, and
 * when two candidates collide keep the better-scored one, telling the player
 * what it beat. Pure, like everything in the engine.
 */
export function applyExclusivity(
  recommendations: Recommendation[],
  ownedItemIds: number[],
  staticData: StaticData,
  t: Translator = defaultTranslator
): Recommendation[] {
  const graph = staticData.itemGraph
  const kept: Recommendation[] = []
  for (const rec of recommendations) {
    const id = rec.itemId
    if (id === null) {
      kept.push(rec)
      continue
    }
    if (ownedItemIds.some((ownedId) => itemConflict(graph, id, ownedId) !== null)) continue
    let mergedIntoWinner = false
    for (const [index, winner] of kept.entries()) {
      if (winner.itemId === null) continue
      const group = itemConflict(graph, id, winner.itemId)
      if (group === null) continue
      kept[index] = {
        ...winner,
        reasons: [
          ...winner.reasons,
          t('engine.exclusivity.over', {
            other: rec.itemName ?? t('engine.word.theAlternative'),
            group
          })
        ]
      }
      mergedIntoWinner = true
      break
    }
    if (!mergedIntoWinner) kept.push(rec)
  }
  return kept
}

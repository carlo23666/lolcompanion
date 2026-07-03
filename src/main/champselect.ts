import type {
  ChampSelectInsights,
  ChampSelectItemRef,
  TeamDamageSplit
} from '@shared/champselect'
import type { ChampSelectState } from '@shared/schemas/lcu'
import { findBaseline, loadBaselinePool } from './engine/nextbuy'
import { HEALER_CHAMPION_WEIGHTS } from './engine/normalize'
import type { BaselinePool } from '@shared/schemas/baselines'
import type { StaticData } from './staticdata/manager'

/** Cheap defensive components quoted in the tips. */
const NEGATRON_CLOAK = 1057
const CHAIN_VEST = 1031

function itemRef(staticData: StaticData, id: number): ChampSelectItemRef {
  return { id, name: staticData.itemGraph.nodes.get(id)?.name ?? `objeto ${String(id)}` }
}

function damageSplit(staticData: StaticData, championKeys: number[]): TeamDamageSplit {
  const split: TeamDamageSplit = { physical: 0, magic: 0, mixed: 0, picked: 0 }
  for (const key of championKeys) {
    const champion = staticData.championsByKey.get(key)
    if (!champion) continue
    split.picked += 1
    split[staticData.damageProfile(champion.id)] += 1
  }
  return split
}

/**
 * Insights for the champ select panel. Pure: (state, staticData, pool) →
 * insights. Everything derives from champions visible on screen.
 */
export function champSelectInsights(
  state: ChampSelectState,
  staticData: StaticData,
  pool: BaselinePool = loadBaselinePool()
): ChampSelectInsights {
  const allyKeys = state.myTeam
    .map((member) => member.championId || member.championPickIntent)
    .filter((key) => key > 0)
  const enemyKeys = state.theirTeam.map((member) => member.championId).filter((key) => key > 0)

  const allySplit = damageSplit(staticData, allyKeys)
  const enemySplit = damageSplit(staticData, enemyKeys)

  const tips: string[] = []

  if (enemySplit.picked >= 2) {
    if (enemySplit.magic >= 3) {
      const cloak = itemRef(staticData, NEGATRON_CLOAK)
      tips.push(
        `Comp enemiga muy AP (${String(enemySplit.magic)} de ${String(enemySplit.picked)}): planea resistencia mágica — ${cloak.name} es la pieza barata`
      )
    } else if (enemySplit.physical >= 3) {
      const vest = itemRef(staticData, CHAIN_VEST)
      tips.push(
        `Comp enemiga muy AD (${String(enemySplit.physical)} de ${String(enemySplit.picked)}): planea armadura — ${vest.name} es la pieza barata`
      )
    } else if (enemySplit.picked >= 4) {
      tips.push('Daño enemigo mixto: la vida rinde más que apilar una sola resistencia')
    }
  }

  const healers = enemyKeys
    .map((key) => staticData.championsByKey.get(key))
    .filter(
      (champion) => champion !== undefined && (HEALER_CHAMPION_WEIGHTS[champion.id] ?? 0) >= 2
    )
    .map((champion) => champion?.name ?? '')
  if (healers.length > 0) {
    tips.push(
      `Curación enemiga a la vista (${healers.join(', ')}): reserva hueco para heridas graves`
    )
  }

  if (allySplit.picked >= 4) {
    if (allySplit.physical >= 4) {
      tips.push(
        'Tu equipo es casi todo AD: al rival le renta apilar armadura — el daño mágico que aportes vale doble'
      )
    } else if (allySplit.magic >= 4) {
      tips.push(
        'Tu equipo es casi todo AP: al rival le renta apilar RM — el daño físico que aportes vale doble'
      )
    }
  }

  // Owner plan: his picked champion (or intent) against the baseline pool.
  const own = state.myTeam.find((member) => member.cellId === state.localPlayerCellId)
  const ownKey = own === undefined ? 0 : own.championId || own.championPickIntent
  const ownChampion = ownKey > 0 ? staticData.championsByKey.get(ownKey) : undefined
  let ownPlan: ChampSelectInsights['ownPlan'] = null
  if (ownChampion) {
    const role = (state.ownPosition ?? '').toUpperCase()
    const baseline = findBaseline(pool, ownChampion.id, role)
    if (baseline) {
      ownPlan = {
        championId: ownChampion.id,
        role: baseline.role,
        core: baseline.core.map((id) => itemRef(staticData, id)),
        situational: baseline.situational.map((id) => itemRef(staticData, id))
      }
    }
  }

  return { enemySplit, allySplit, tips, ownPlan }
}

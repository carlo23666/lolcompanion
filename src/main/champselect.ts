import type {
  ChampSelectInsights,
  ChampSelectItemRef,
  PickSuggestion,
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

/** One stored game of the owner, as needed for pick suggestions. */
export interface OwnerHistoryRow {
  /** Data Dragon champion id (match-v5 championName). */
  champion: string
  /** match-v5 teamPosition: TOP | JUNGLE | MIDDLE | BOTTOM | UTILITY | ''. */
  role: string
  win: boolean
  /** Champions on the enemy team that game (matchup component). */
  enemyChampions: string[]
}

const MIN_GAMES_FOR_SUGGESTION = 2
const MAX_PICK_SUGGESTIONS = 3
/** Meta thresholds: below these sample sizes the aggregate says nothing. */
const META_MIN_CHAMPION_GAMES = 30
const META_MIN_MATCHUP_GAMES = 10

/**
 * Aggregated Master+ statistics (crawled, migration 005). Null lookups mean
 * "no data yet" — every consumer must degrade gracefully.
 */
export interface MetaSource {
  championWinrate(champion: string, role: string): { games: number; wins: number } | null
  laneMatchup(
    champion: string,
    role: string,
    enemyChampion: string
  ): { games: number; wins: number } | null
}

const ROLE_LABEL: Record<string, string> = {
  TOP: 'top',
  JUNGLE: 'jungla',
  MIDDLE: 'mid',
  BOTTOM: 'ADC',
  UTILITY: 'support'
}

/** Champion classes that count as frontline for the team-needs bonus. */
const FRONTLINE_TAGS = new Set(['Tank', 'Fighter'])

/**
 * What to pick: the owner's champions for his assigned position, ranked by a
 * mix of signals — his own winrate (Laplace-smoothed so 2-0 doesn't beat
 * 15-5), his own record AGAINST the visible enemy champions, whether the
 * team lacks frontline or a damage type the pick provides, and durability
 * versus assassin-heavy comps. Banned/picked champions are skipped. All
 * inputs: own history + champions visible on screen (no external tierlists —
 * zero-cost constraint).
 */
export function pickSuggestions(
  state: ChampSelectState,
  staticData: StaticData,
  history: OwnerHistoryRow[],
  allySplit: TeamDamageSplit,
  pool: BaselinePool,
  meta: MetaSource | null = null
): PickSuggestion[] {
  const position = (state.ownPosition ?? '').toUpperCase()
  const rows = position === '' ? history : history.filter((row) => row.role === position)

  const byChampion = new Map<string, { games: number; wins: number; rows: OwnerHistoryRow[] }>()
  for (const row of rows) {
    const acc = byChampion.get(row.champion) ?? { games: 0, wins: 0, rows: [] }
    acc.games += 1
    if (row.win) acc.wins += 1
    acc.rows.push(row)
    byChampion.set(row.champion, acc)
  }

  // Champions already on the board (bans + both teams' picks/intents).
  const takenKeys = [
    ...state.bans.mine,
    ...state.bans.theirs,
    ...state.myTeam.flatMap((member) => [member.championId, member.championPickIntent]),
    ...state.theirTeam.map((member) => member.championId)
  ].filter((key) => key > 0)
  const taken = new Set(
    takenKeys
      .map((key) => staticData.championsByKey.get(key)?.id)
      .filter((id) => id !== undefined)
  )

  const enemyChampions = state.theirTeam
    .map((member) => staticData.championsByKey.get(member.championId))
    .filter((champion) => champion !== undefined)
  const enemyIds = new Set(enemyChampions.map((champion) => champion.id))
  const enemyAssassins = enemyChampions.filter((champion) =>
    champion.tags.includes('Assassin')
  ).length

  // Ally classes from picked champions (own cell is unpicked at this point).
  const allyChampions = state.myTeam
    .map((member) => staticData.championsByKey.get(member.championId || member.championPickIntent))
    .filter((champion) => champion !== undefined)
  const teamLacksFrontline =
    allyChampions.length >= 2 &&
    !allyChampions.some((champion) => champion.tags.some((tag) => FRONTLINE_TAGS.has(tag)))

  const wantsMagic = allySplit.picked >= 2 && allySplit.physical >= allySplit.picked - 1
  const wantsPhysical = allySplit.picked >= 2 && allySplit.magic >= allySplit.picked - 1
  const roleLabel = ROLE_LABEL[position] ?? 'tus partidas'

  const ranked = [...byChampion.entries()]
    .filter(([champion, acc]) => acc.games >= MIN_GAMES_FOR_SUGGESTION && !taken.has(champion))
    .map(([champion, acc]) => {
      const winratePct = (acc.wins / acc.games) * 100
      // Laplace smoothing: small samples get pulled toward 50%.
      let score = (acc.wins + 2) / (acc.games + 4)
      const reasons = [
        `${winratePct.toFixed(0)}% de victorias en ${String(acc.games)} partidas como ${roleLabel} (tus datos)`
      ]

      // Matchup component: own record with this champion AGAINST any of the
      // enemies already visible. Small samples only nudge, never dominate.
      if (enemyIds.size > 0) {
        const versus = acc.rows.filter((row) =>
          row.enemyChampions.some((enemy) => enemyIds.has(enemy))
        )
        if (versus.length >= 2) {
          const versusWins = versus.filter((row) => row.win).length
          const versusWr = versusWins / versus.length
          score += (versusWr - 0.5) * 0.25
          reasons.push(
            `contra campeones de esta comp: ${String(versusWins)} de ${String(versus.length)} ganadas`
          )
        }
      }

      // Master+ aggregate: how the champion performs at the top right now,
      // and specifically into the visible lane opponents.
      const metaStat = meta?.championWinrate(champion, position)
      if (metaStat && metaStat.games >= META_MIN_CHAMPION_GAMES) {
        const metaWr = metaStat.wins / metaStat.games
        score += (metaWr - 0.5) * 0.3
        reasons.push(
          `${(metaWr * 100).toFixed(0)}% WR en Master+ este parche (${String(metaStat.games)} partidas)`
        )
      }
      if (meta && enemyChampions.length > 0) {
        let versusGames = 0
        let versusWins = 0
        const versusNames: string[] = []
        for (const enemy of enemyChampions) {
          const matchup = meta.laneMatchup(champion, position, enemy.id)
          if (matchup && matchup.games >= META_MIN_MATCHUP_GAMES) {
            versusGames += matchup.games
            versusWins += matchup.wins
            versusNames.push(enemy.name)
          }
        }
        if (versusGames > 0) {
          const versusWr = versusWins / versusGames
          score += (versusWr - 0.5) * 0.2
          reasons.push(
            `en Master+ contra ${versusNames.join('/')}: ${(versusWr * 100).toFixed(0)}% WR (${String(versusGames)} partidas)`
          )
        }
      }

      const champMeta = staticData.champions.get(champion)
      const damageType = staticData.damageProfile(champion)
      if (wantsMagic && damageType !== 'physical') {
        score += 0.06
        reasons.push('aporta el daño mágico que le falta a tu equipo')
      } else if (wantsPhysical && damageType !== 'magic') {
        score += 0.06
        reasons.push('aporta el daño físico que le falta a tu equipo')
      }
      if (
        teamLacksFrontline &&
        champMeta !== undefined &&
        champMeta.tags.some((tag) => FRONTLINE_TAGS.has(tag))
      ) {
        score += 0.05
        reasons.push('tu equipo no tiene frontline y este pick la aporta')
      }
      if (enemyAssassins >= 2 && champMeta !== undefined && champMeta.tags.includes('Tank')) {
        score += 0.03
        reasons.push(`${String(enemyAssassins)} asesinos enfrente: aguantas mejor sus entradas`)
      }
      if (findBaseline(pool, champion, position) !== null) {
        score += 0.03
        reasons.push('está en tu pool: build baseline lista')
      }
      const name = champMeta?.name ?? champion
      return { championId: champion, name, games: acc.games, winratePct, reasons, score }
    })
    .sort((a, b) => b.score - a.score)

  return ranked.slice(0, MAX_PICK_SUGGESTIONS).map(({ championId, name, games, winratePct, reasons }) => ({
    championId,
    name,
    games,
    winratePct,
    reasons
  }))
}

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
  pool: BaselinePool = loadBaselinePool(),
  ownerHistory: OwnerHistoryRow[] = [],
  meta: MetaSource | null = null
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

  // Pick suggestions only matter while the owner hasn't locked a champion.
  const picks =
    (own?.championId ?? 0) === 0
      ? pickSuggestions(state, staticData, ownerHistory, allySplit, pool, meta)
      : []

  return { enemySplit, allySplit, tips, picks, ownPlan }
}

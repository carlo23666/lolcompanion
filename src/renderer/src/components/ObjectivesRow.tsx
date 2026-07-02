import type { ObjectivesState } from '@shared/gamestate'

const DRAGON_EMOJI: Record<string, string> = {
  FIRE: '🔥',
  OCEAN: '🌊',
  EARTH: '⛰️',
  AIR: '🌪️',
  HEXTECH: '⚙️',
  CHEMTECH: '🧪',
  ELDER: '🐲'
}

function TeamObjectives(props: {
  label: string
  team: 'ORDER' | 'CHAOS'
  objectives: ObjectivesState
  accent: string
}): React.JSX.Element {
  const { team, objectives } = props
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className={`font-semibold ${props.accent}`}>{props.label}</span>
      <span title="dragones">
        {objectives.dragons[team].length > 0
          ? objectives.dragons[team].map((subtype, i) => (
              <span key={i}>{DRAGON_EMOJI[subtype] ?? '🐉'}</span>
            ))
          : '—'}
      </span>
      <span title="barones" className="font-mono">
        🟣 {objectives.barons[team]}
      </span>
      <span title="heraldos" className="font-mono">
        👁 {objectives.heralds[team]}
      </span>
      <span title="torres" className="font-mono">
        🗼 {objectives.towers[team]}
      </span>
    </div>
  )
}

export default function ObjectivesRow(props: {
  objectives: ObjectivesState
  selfTeam: 'ORDER' | 'CHAOS'
}): React.JSX.Element {
  const allyTeam = props.selfTeam
  const enemyTeam = allyTeam === 'ORDER' ? 'CHAOS' : 'ORDER'
  return (
    <section className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
      <TeamObjectives
        label="Aliados"
        team={allyTeam}
        objectives={props.objectives}
        accent="text-sky-400"
      />
      <TeamObjectives
        label="Enemigos"
        team={enemyTeam}
        objectives={props.objectives}
        accent="text-rose-400"
      />
    </section>
  )
}

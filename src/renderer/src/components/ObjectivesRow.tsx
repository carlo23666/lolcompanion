import type { ObjectivesState } from '@shared/gamestate'
import { useT } from '../i18n'

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
  const t = useT()
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className={`font-semibold ${props.accent}`}>{props.label}</span>
      <span title={t('live.obj.dragons')}>
        {objectives.dragons[team].length > 0
          ? objectives.dragons[team].map((subtype, i) => (
              <span key={i}>{DRAGON_EMOJI[subtype] ?? '🐉'}</span>
            ))
          : '—'}
      </span>
      <span title={t('live.obj.barons')} className="font-mono">
        🟣 {objectives.barons[team]}
      </span>
      <span title={t('live.obj.heralds')} className="font-mono">
        👁 {objectives.heralds[team]}
      </span>
      <span title={t('live.obj.towers')} className="font-mono">
        🗼 {objectives.towers[team]}
      </span>
    </div>
  )
}

export default function ObjectivesRow(props: {
  objectives: ObjectivesState
  selfTeam: 'ORDER' | 'CHAOS'
}): React.JSX.Element {
  const t = useT()
  const allyTeam = props.selfTeam
  const enemyTeam = allyTeam === 'ORDER' ? 'CHAOS' : 'ORDER'
  return (
    <section className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
      <TeamObjectives
        label={t('live.allies')}
        team={allyTeam}
        objectives={props.objectives}
        accent="text-sky-400"
      />
      <TeamObjectives
        label={t('live.enemies')}
        team={enemyTeam}
        objectives={props.objectives}
        accent="text-rose-400"
      />
    </section>
  )
}

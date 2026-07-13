import type { TeamAggregates } from '@shared/gamestate'
import { useT } from '../i18n'

/** Expected effective HP at time t — mirrors the engine baseline. */
function tankBaseline(gameTimeS: number): number {
  return 900 + 2.2 * gameTimeS
}

export default function Gauges(props: {
  aggregates: TeamAggregates
  gameTimeS: number
}): React.JSX.Element {
  const { aggregates, gameTimeS } = props
  const t = useT()
  const physicalPct = Math.round(aggregates.physicalShare * 100)
  const tankRatio = Math.min(aggregates.tankinessIndex / (tankBaseline(gameTimeS) * 1.5), 1)

  return (
    <section className="analysis-console rounded-2xl border border-slate-800 bg-slate-900 p-3.5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {t('live.enemyAnalysis')}
      </h3>

      <div className="mb-2">
        <div className="mb-1 flex justify-between text-[11px] text-slate-400">
          <span>{t('live.physicalDmg', { pct: `${String(physicalPct)}%` })}</span>
          <span>{t('live.magicDmg', { pct: `${String(100 - physicalPct)}%` })}</span>
        </div>
        <div
          className="flex h-2.5 overflow-hidden rounded-full bg-slate-800"
          role="meter"
          aria-label={t('live.enemyDmgSplit')}
          aria-valuenow={physicalPct}
        >
          <div className="bg-orange-500" style={{ width: `${String(physicalPct)}%` }} />
          <div className="bg-sky-500" style={{ width: `${String(100 - physicalPct)}%` }} />
        </div>
      </div>

      <div className="mb-2">
        <div className="mb-1 flex justify-between text-[11px] text-slate-400">
          <span>{t('live.tankiness')}</span>
          <span className="font-mono">
            {Math.round(aggregates.tankinessIndex)} {t('live.ehpAbbrev')}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full ${tankRatio > 0.77 ? 'bg-emerald-500' : 'bg-slate-500'}`}
            style={{ width: `${String(Math.round(tankRatio * 100))}%` }}
          />
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        {t('live.healShield')}{' '}
        <span className="font-mono text-slate-200">{aggregates.healingIndex.toFixed(1)}</span>
        {aggregates.healingIndex >= 3.5 && (
          <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300">
            {t('live.considerAntiheal')}
          </span>
        )}
      </p>
    </section>
  )
}

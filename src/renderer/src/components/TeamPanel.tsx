import type { PlayerState } from '@shared/gamestate'
import { useT } from '../i18n'

function PlayerRow(props: { player: PlayerState; isSelf: boolean }): React.JSX.Element {
  const { player, isSelf } = props
  const t = useT()
  return (
    <li
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
        isSelf ? 'bg-indigo-600/15 ring-1 ring-indigo-500/40' : ''
      } ${player.isDead ? 'opacity-50' : ''}`}
    >
      <div className="relative">
        <img
          src={`ddicon://champion/${player.championId || 'Aatrox'}.png`}
          alt={player.championName}
          className="h-8 w-8 rounded"
        />
        {player.isDead && (
          <span className="absolute inset-0 flex items-center justify-center rounded bg-black/60 font-mono text-[10px] text-red-300">
            {Math.ceil(player.respawnTimer)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-200">
          {player.championName}
          <span className="ml-1 text-[10px] text-slate-500">
            {t('live.levelShort', { n: String(player.level) })}
          </span>
        </p>
        <p className="font-mono text-[10px] text-slate-400">
          {player.scores.kills}/{player.scores.deaths}/{player.scores.assists} ·{' '}
          {player.scores.creepScore} CS
        </p>
      </div>
      <div className="flex gap-0.5" data-testid={`items-${player.championName}`}>
        {player.items
          .filter((item) => item.id !== 3340 && item.id !== 3363 && item.id !== 3364)
          .slice(0, 6)
          .map((item, index) => (
            <img
              key={`${String(item.id)}-${String(index)}`}
              src={`ddicon://item/${String(item.id)}.png`}
              alt={item.name}
              title={item.name}
              className="h-5 w-5 rounded-sm border border-slate-700"
            />
          ))}
      </div>
    </li>
  )
}

export default function TeamPanel(props: {
  title: string
  players: PlayerState[]
  selfChampion?: string
  accent: 'ally' | 'enemy'
}): React.JSX.Element {
  return (
    <section
      className={`flex-1 rounded-lg border p-2 ${
        props.accent === 'ally'
          ? 'border-sky-900/60 bg-sky-950/20'
          : 'border-rose-900/60 bg-rose-950/20'
      }`}
    >
      <h3
        className={`mb-1 px-2 text-xs font-semibold uppercase tracking-wide ${
          props.accent === 'ally' ? 'text-sky-400' : 'text-rose-400'
        }`}
      >
        {props.title}
      </h3>
      <ul className="space-y-0.5">
        {props.players.map((player) => (
          <PlayerRow
            key={player.championName}
            player={player}
            isSelf={player.championName === props.selfChampion}
          />
        ))}
      </ul>
    </section>
  )
}

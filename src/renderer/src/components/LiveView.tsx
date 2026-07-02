import type { GameState } from '@shared/gamestate'
import type { RecommendationsPayload } from '@shared/ipc'
import type { ChampSelectState } from '@shared/schemas/lcu'
import type { SessionPhase } from '@shared/session'
import type { LiveInsights as LiveInsightsData } from '../hooks'
import Gauges from './Gauges'
import {
  AlertFeed,
  LiveChips,
  PersonalCurveChip,
  TeamGoldBar,
  usePersonalCurve
} from './LiveInsights'
import ObjectivesRow from './ObjectivesRow'
import RecommendationCard from './RecommendationCard'
import TeamPanel from './TeamPanel'

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
}

const PHASE_LABEL: Record<SessionPhase, string> = {
  idle: 'Cliente cerrado',
  clientOpen: 'Cliente abierto',
  champSelect: 'Selección de campeones',
  inGame: 'En partida',
  postGame: 'Partida terminada'
}

function PhaseBanner(props: { phase: SessionPhase }): React.JSX.Element {
  const color =
    props.phase === 'inGame'
      ? 'bg-emerald-600/20 text-emerald-300 border-emerald-800'
      : props.phase === 'champSelect'
        ? 'bg-indigo-600/20 text-indigo-300 border-indigo-800'
        : 'bg-slate-800/60 text-slate-300 border-slate-700'
  return (
    <div className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${color}`}>
      {PHASE_LABEL[props.phase]}
    </div>
  )
}

function EmptyState(props: { icon: string; title: string; hint: string }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      <span className="text-4xl" aria-hidden>
        {props.icon}
      </span>
      <p className="text-sm font-medium text-slate-300">{props.title}</p>
      <p className="max-w-xs text-xs text-slate-500">{props.hint}</p>
    </div>
  )
}

function ChampSelectPanel(props: {
  champSelect: ChampSelectState | null
  championNames?: Record<number, string>
}): React.JSX.Element {
  const cs = props.champSelect
  const names = props.championNames ?? {}
  // 0 = not picked yet ('?'); ids missing from the map (offline without
  // cached static data) fall back to the raw number.
  const label = (championId: number): string | null =>
    championId === 0 ? null : (names[championId] ?? String(championId))
  if (!cs) {
    return (
      <EmptyState
        icon="🎯"
        title="Selección de campeones en curso"
        hint="Esperando datos de la selección…"
      />
    )
  }
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm">
      <p className="mb-2 font-semibold text-slate-300">
        Selección de campeones
        {cs.ownPosition !== null && cs.ownPosition !== '' && (
          <span className="ml-2 rounded bg-indigo-600/20 px-2 py-0.5 text-xs text-indigo-300">
            tu posición: {cs.ownPosition}
          </span>
        )}
      </p>
      <p className="text-xs text-slate-400">
        Picks aliados:{' '}
        {cs.myTeam
          .map((m) => label(m.championId) ?? label(m.championPickIntent) ?? '?')
          .join(', ')}
      </p>
      <p className="text-xs text-slate-400">
        Picks enemigos:{' '}
        {cs.theirTeam.map((m) => label(m.championId) ?? '?').join(', ') || '—'}
      </p>
      <p className="mt-1 text-[11px] text-slate-600">
        Las recomendaciones en selección llegan en la fase 2.
      </p>
    </div>
  )
}

export default function LiveView(props: {
  phase: SessionPhase
  gameState: GameState | null
  champSelect: ChampSelectState | null
  recommendations?: RecommendationsPayload | null
  championNames?: Record<number, string>
  insights?: LiveInsightsData
}): React.JSX.Element {
  const { phase, gameState } = props
  const curve = usePersonalCurve(gameState)

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Live</h1>
        <PhaseBanner phase={phase} />
      </div>

      {phase === 'idle' && (
        <EmptyState
          icon="💤"
          title="Sin cliente de LoL"
          hint="Abre el cliente de League of Legends; la app lo detecta sola."
        />
      )}
      {phase === 'clientOpen' && (
        <EmptyState
          icon="🕹️"
          title="Esperando partida"
          hint="Entra en cola o carga una partida; el panel se activa automáticamente."
        />
      )}
      {phase === 'postGame' && (
        <EmptyState
          icon="🏁"
          title="Fin de la partida"
          hint="La partida se guardará en el historial en cuanto Riot la publique."
        />
      )}
      {phase === 'champSelect' && (
        <ChampSelectPanel champSelect={props.champSelect} championNames={props.championNames} />
      )}

      {phase === 'inGame' &&
        (gameState === null ? (
          <EmptyState
            icon="⏳"
            title="Conectando con la partida"
            hint="Leyendo datos del juego (puerto 2999)…"
          />
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto">
            <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm">
              <span className="font-mono text-lg">⏱ {formatClock(gameState.gameTimeS)}</span>
              <span className="font-mono text-amber-300">
                💰 {Math.round(gameState.self.currentGold)}
              </span>
              <span className="font-mono text-slate-300">
                {gameState.self.scores.kills}/{gameState.self.scores.deaths}/
                {gameState.self.scores.assists}
              </span>
              <PersonalCurveChip gameState={gameState} curve={curve} />
              <span className="ml-auto text-xs text-slate-500">
                {gameState.self.championName} · nv {gameState.self.level} · parche{' '}
                {gameState.patch}
              </span>
            </div>

            {props.insights && (
              <div className="card-in flex flex-col gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2">
                <div className="flex items-center gap-3">
                  <LiveChips gameState={gameState} insights={props.insights} />
                  <div className="min-w-32 flex-1">
                    <TeamGoldBar gameState={gameState} />
                  </div>
                </div>
                <AlertFeed insights={props.insights} />
              </div>
            )}

            <RecommendationCard
              payload={props.recommendations ?? null}
              currentGold={gameState.self.currentGold}
            />

            <div className="flex gap-3">
              <TeamPanel
                title="Tu equipo"
                accent="ally"
                players={[gameState.self, ...gameState.allies]}
                selfChampion={gameState.self.championName}
              />
              <TeamPanel title="Enemigos" accent="enemy" players={gameState.enemies} />
            </div>

            <Gauges aggregates={gameState.enemyAggregates} gameTimeS={gameState.gameTimeS} />
            <ObjectivesRow objectives={gameState.objectives} selfTeam={gameState.self.team} />
          </div>
        ))}
    </div>
  )
}

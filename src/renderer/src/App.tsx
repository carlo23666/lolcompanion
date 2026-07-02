import { useEffect, useState } from 'react'
import type { GameState } from '@shared/gamestate'
import type { LiveClientSnapshot } from '@shared/schemas/liveclient'
import SettingsStub from './SettingsStub'

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
}

export default function App(): React.JSX.Element {
  const [version, setVersion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [liveState, setLiveState] = useState<'unavailable' | 'polling'>('unavailable')
  const [snapshot, setSnapshot] = useState<LiveClientSnapshot | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)

  useEffect(() => {
    window.api
      .invoke('app:ping')
      .then((reply) => setVersion(reply.version))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))

    const offState = window.api.on('live:state', setLiveState)
    const offSnapshot = window.api.on('live:snapshot', setSnapshot)
    const offGameState = window.api.on('gamestate:update', setGameState)
    return () => {
      offState()
      offSnapshot()
      offGameState()
    }
  }, [])

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-3 p-6">
      <h1 className="text-3xl font-bold tracking-tight">LoL Companion</h1>
      {version !== null && <p className="text-sm text-slate-400">v{version} — IPC conectado</p>}
      {error !== null && <p className="text-sm text-red-400">Error de IPC: {error}</p>}

      {liveState === 'unavailable' && (
        <p className="text-sm text-slate-500">Sin partida en curso — esperando al cliente…</p>
      )}
      {liveState === 'polling' && snapshot !== null && (
        <section className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="mb-2 font-mono text-lg">⏱ {formatClock(snapshot.gameData.gameTime)}</p>
          <ul className="space-y-1 text-sm">
            {snapshot.allPlayers.map((player, index) => (
              <li key={index} className="flex justify-between">
                <span>{player.championName}</span>
                <span className="text-slate-400">
                  {player.scores.kills}/{player.scores.deaths}/{player.scores.assists} · nv{' '}
                  {player.level} · {player.team === 'ORDER' ? 'azul' : 'rojo'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {liveState === 'polling' && gameState !== null && (
        <section className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm">
          <h2 className="mb-2 font-semibold text-slate-300">Análisis enemigo (provisional)</h2>
          <p>
            Daño físico estimado:{' '}
            <span className="font-mono">
              {Math.round(gameState.enemyAggregates.physicalShare * 100)}%
            </span>
          </p>
          <p>
            Tanquismo (HP efectiva media):{' '}
            <span className="font-mono">
              {Math.round(gameState.enemyAggregates.tankinessIndex)}
            </span>
          </p>
          <p>
            Índice de curación:{' '}
            <span className="font-mono">
              {gameState.enemyAggregates.healingIndex.toFixed(1)}
            </span>
          </p>
          <p>
            Oro propio: <span className="font-mono">{Math.round(gameState.self.currentGold)}</span>
          </p>
        </section>
      )}

      <SettingsStub />
    </main>
  )
}

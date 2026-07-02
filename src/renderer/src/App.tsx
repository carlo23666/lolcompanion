import { useEffect, useState } from 'react'
import type { SessionPhase } from '@shared/session'
import Sidebar, { type ViewId } from './components/Sidebar'
import LiveView from './components/LiveView'
import HistoryView from './components/HistoryView'
import SettingsView from './components/SettingsView'
import { useIpcEvent } from './hooks'

export default function App(): React.JSX.Element {
  const [view, setView] = useState<ViewId>('live')
  const [phase, setPhase] = useState<SessionPhase>('idle')
  const [championNames, setChampionNames] = useState<Record<number, string>>({})
  const gameState = useIpcEvent('gamestate:update')
  const champSelect = useIpcEvent('session:champselect')
  const recommendations = useIpcEvent('gamestate:recommendations')

  useEffect(() => {
    void window.api.invoke('session:get').then(setPhase)
    // Offline with no cached patch this rejects; the UI then falls back to
    // showing numeric champion ids.
    window.api.invoke('staticdata:championNames').then(setChampionNames, () => undefined)
    return window.api.on('session:phase', setPhase)
  }, [])

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <Sidebar active={view} onSelect={setView} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        {view === 'live' && (
          <LiveView
            phase={phase}
            gameState={gameState}
            champSelect={champSelect}
            recommendations={recommendations}
            championNames={championNames}
          />
        )}
        {view === 'history' && <HistoryView />}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}

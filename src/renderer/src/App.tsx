import { useEffect, useRef, useState } from 'react'
import type { SessionPhase } from '@shared/session'
import Sidebar, { type ViewId } from './components/Sidebar'
import LiveView from './components/LiveView'
import HistoryView from './components/HistoryView'
import SettingsView from './components/SettingsView'
import { useIpcEvent, useLiveInsights } from './hooks'
import { playAlert, playRecommendation, setSoundsEnabled } from './sounds'

export default function App(): React.JSX.Element {
  const [view, setView] = useState<ViewId>('live')
  const [phase, setPhase] = useState<SessionPhase>('idle')
  const [championNames, setChampionNames] = useState<Record<number, string>>({})
  const gameState = useIpcEvent('gamestate:update')
  const champSelect = useIpcEvent('session:champselect')
  const recommendations = useIpcEvent('gamestate:recommendations')
  const insights = useLiveInsights()
  const [mascotReactKey, setMascotReactKey] = useState(0)
  const lastTopRef = useRef('')
  const lastAlertRef = useRef(0)

  useEffect(() => {
    void window.api.invoke('session:get').then(setPhase)
    void window.api.invoke('settings:get').then((settings) => {
      setSoundsEnabled(settings.soundsEnabled)
    })
    // Offline with no cached patch this rejects; the UI then falls back to
    // showing numeric champion ids.
    window.api.invoke('staticdata:championNames').then(setChampionNames, () => undefined)
    return window.api.on('session:phase', setPhase)
  }, [])

  // Gold chime when the top recommendation changes.
  useEffect(() => {
    const top = recommendations?.recommendations[0]
    if (!top) return
    const key = `${String(top.itemId ?? top.category)}:${top.action}`
    if (lastTopRef.current !== '' && key !== lastTopRef.current) playRecommendation()
    lastTopRef.current = key
  }, [recommendations])

  // Blip + mascot reaction when a new spike/objective alert lands.
  useEffect(() => {
    const newest = insights.alerts[0]
    if (!newest || newest.id === lastAlertRef.current) return
    lastAlertRef.current = newest.id
    if (newest.kind === 'spike' || newest.kind === 'objective') {
      playAlert()
      setMascotReactKey((key) => key + 1)
    }
  }, [insights.alerts])

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <Sidebar
        active={view}
        onSelect={setView}
        phase={phase}
        mascotReactKey={mascotReactKey}
      />
      <main className="min-w-0 flex-1 overflow-y-auto">
        {view === 'live' && (
          <LiveView
            phase={phase}
            gameState={gameState}
            champSelect={champSelect}
            recommendations={recommendations}
            championNames={championNames}
            insights={insights}
          />
        )}
        {view === 'history' && <HistoryView />}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}

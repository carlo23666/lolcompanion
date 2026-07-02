import { useEffect, useState } from 'react'

export default function App(): React.JSX.Element {
  const [version, setVersion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .invoke('app:ping')
      .then((reply) => setVersion(reply.version))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-3xl font-bold tracking-tight">LoL Companion</h1>
      {version !== null && <p className="text-sm text-slate-400">v{version} — IPC conectado</p>}
      {error !== null && <p className="text-sm text-red-400">Error de IPC: {error}</p>}
    </main>
  )
}

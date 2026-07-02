export default function HistoryView(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <h1 className="text-lg font-bold">Historial</h1>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <span className="text-4xl" aria-hidden>
          📜
        </span>
        <p className="text-sm font-medium text-slate-300">Historial de partidas</p>
        <p className="max-w-xs text-xs text-slate-500">
          Llega con el WP-010: cada partida terminada aparecerá aquí automáticamente.
        </p>
      </div>
    </div>
  )
}

export type ViewId = 'live' | 'history' | 'settings'

const ITEMS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'live', label: 'Live', icon: '⚡' },
  { id: 'history', label: 'Historial', icon: '📜' },
  { id: 'settings', label: 'Ajustes', icon: '⚙️' }
]

export default function Sidebar(props: {
  active: ViewId
  onSelect: (view: ViewId) => void
}): React.JSX.Element {
  return (
    <nav className="flex h-full w-44 shrink-0 flex-col gap-1 border-r border-slate-800 bg-slate-950 p-3">
      <p className="mb-3 px-2 text-sm font-bold tracking-wide text-slate-200">LoL Companion</p>
      {ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => props.onSelect(item.id)}
          aria-current={props.active === item.id ? 'page' : undefined}
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
            props.active === item.id
              ? 'bg-indigo-600/20 font-semibold text-indigo-300'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <span aria-hidden>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  )
}

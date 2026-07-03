import { useEffect, useMemo, useState } from 'react'
import type { ChampionMeta } from '@shared/champselect'
import type { GameScenario, ScenarioPlayerSpec } from '@shared/scenario'
import type { ChampSelectState } from '@shared/schemas/lcu'

const POSITIONS = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const

interface ItemRef {
  id: number
  name: string
}

interface PlayerRow {
  champion: string
  position: string
  level: string
  kills: string
  items: string
}

function emptyRow(position = ''): PlayerRow {
  return { champion: '', position, level: '', kills: '', items: '' }
}

/** Mid-game showcase: fed assassin, tank top, healer support, boots rune. */
const EXAMPLE_SELF: PlayerRow = {
  champion: 'Jinx',
  position: 'BOTTOM',
  level: '11',
  kills: '4',
  items: 'Filo infinito'
}
const EXAMPLE_ALLIES: PlayerRow[] = [
  { champion: 'Ornn', position: 'TOP', level: '11', kills: '1', items: '' },
  { champion: 'Vi', position: 'JUNGLE', level: '10', kills: '3', items: '' },
  { champion: 'Ahri', position: 'MIDDLE', level: '11', kills: '2', items: '' },
  { champion: 'Leona', position: 'UTILITY', level: '9', kills: '0', items: '' }
]
const EXAMPLE_ENEMIES: PlayerRow[] = [
  { champion: 'Dr. Mundo', position: 'TOP', level: '12', kills: '2', items: '' },
  { champion: 'Kayn', position: 'JUNGLE', level: '11', kills: '3', items: '' },
  { champion: 'Zed', position: 'MIDDLE', level: '12', kills: '7', items: '' },
  { champion: 'Draven', position: 'BOTTOM', level: '10', kills: '2', items: '' },
  { champion: 'Soraka', position: 'UTILITY', level: '9', kills: '0', items: '' }
]

function parseItems(text: string, itemsByName: Map<string, ItemRef>): {
  ids: number[]
  unknown: string[]
} {
  const ids: number[] = []
  const unknown: string[] = []
  for (const raw of text.split(',')) {
    const entry = raw.trim()
    if (entry === '') continue
    const numeric = Number(entry)
    if (Number.isInteger(numeric) && numeric > 0) {
      ids.push(numeric)
      continue
    }
    const match = itemsByName.get(entry.toLowerCase())
    if (match) ids.push(match.id)
    else unknown.push(entry)
  }
  return { ids, unknown }
}

function rowToSpec(row: PlayerRow, itemsByName: Map<string, ItemRef>): {
  spec: ScenarioPlayerSpec
  unknown: string[]
} {
  const { ids, unknown } = parseItems(row.items, itemsByName)
  return {
    spec: {
      champion: row.champion.trim(),
      position: row.position,
      level: row.level === '' ? undefined : Number(row.level),
      kills: row.kills === '' ? undefined : Number(row.kills),
      items: ids
    },
    unknown
  }
}

function PlayerRowEditor(props: {
  label: string
  row: PlayerRow
  onChange: (row: PlayerRow) => void
  accent: string
}): React.JSX.Element {
  const { row, onChange } = props
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`w-10 text-[10px] font-bold ${props.accent}`}>{props.label}</span>
      <input
        className="w-28 rounded border border-slate-700 bg-slate-800 px-1.5 py-1"
        placeholder="campeón"
        list="scenario-champions"
        value={row.champion}
        onChange={(event) => onChange({ ...row, champion: event.target.value })}
      />
      <select
        className="rounded border border-slate-700 bg-slate-800 px-1 py-1"
        value={row.position}
        onChange={(event) => onChange({ ...row, position: event.target.value })}
      >
        <option value="">pos</option>
        {POSITIONS.map((position) => (
          <option key={position} value={position}>
            {position}
          </option>
        ))}
      </select>
      <input
        className="w-11 rounded border border-slate-700 bg-slate-800 px-1.5 py-1"
        placeholder="nv"
        title="nivel"
        value={row.level}
        onChange={(event) => onChange({ ...row, level: event.target.value })}
      />
      <input
        className="w-11 rounded border border-slate-700 bg-slate-800 px-1.5 py-1"
        placeholder="K"
        title="kills"
        value={row.kills}
        onChange={(event) => onChange({ ...row, kills: event.target.value })}
      />
      <input
        className="min-w-40 flex-1 rounded border border-slate-700 bg-slate-800 px-1.5 py-1"
        placeholder="objetos (nombres o ids, coma)"
        list="scenario-items"
        value={row.items}
        onChange={(event) => onChange({ ...row, items: event.target.value })}
      />
    </div>
  )
}

/**
 * Dev tool: compose any game situation (matchup, minute, items, gold) and run
 * it through the real pipeline, or fake a custom draft. Spanish UI, dev only.
 */
export default function DevScenario(): React.JSX.Element {
  const [championMeta, setChampionMeta] = useState<Record<number, ChampionMeta>>({})
  const [itemCatalog, setItemCatalog] = useState<ItemRef[]>([])

  // ---- game situation state ----
  const [minute, setMinute] = useState('18')
  const [gold, setGold] = useState('2600')
  const [footwear, setFootwear] = useState(false)
  const [self, setSelf] = useState<PlayerRow>(EXAMPLE_SELF)
  const [allies, setAllies] = useState<PlayerRow[]>(EXAMPLE_ALLIES)
  const [enemies, setEnemies] = useState<PlayerRow[]>(EXAMPLE_ENEMIES)
  const [scenarioActive, setScenarioActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ---- draft state ----
  const [draftPosition, setDraftPosition] = useState('BOTTOM')
  const [draftLocked, setDraftLocked] = useState(false)
  const [draftSelf, setDraftSelf] = useState('')
  const [draftAllies, setDraftAllies] = useState(['Ornn', 'Vi', 'Ahri', 'Leona'])
  const [draftEnemies, setDraftEnemies] = useState(['Dr. Mundo', 'Kayn', 'Zed', 'Draven', 'Soraka'])
  const [draftBans, setDraftBans] = useState('Yasuo, Katarina')
  const [draftActive, setDraftActive] = useState(false)

  useEffect(() => {
    window.api.invoke('staticdata:championMeta').then((meta) => {
      if (typeof meta === 'object') setChampionMeta(meta)
    }, () => undefined)
    window.api.invoke('staticdata:itemCatalog').then((catalog) => {
      if (Array.isArray(catalog)) setItemCatalog(catalog)
    }, () => undefined)
  }, [])

  const itemsByName = useMemo(
    () => new Map(itemCatalog.map((item) => [item.name.toLowerCase(), item])),
    [itemCatalog]
  )
  const championKeyByName = useMemo(() => {
    const map = new Map<string, number>()
    for (const [key, meta] of Object.entries(championMeta)) {
      map.set(meta.name.toLowerCase(), Number(key))
      map.set(meta.id.toLowerCase(), Number(key))
    }
    return map
  }, [championMeta])

  const buildScenario = (): { scenario: GameScenario | null; problem: string | null } => {
    const unknown: string[] = []
    const selfSpec = rowToSpec(self, itemsByName)
    unknown.push(...selfSpec.unknown)
    if (selfSpec.spec.champion === '') return { scenario: null, problem: 'falta tu campeón' }
    const allySpecs = allies.filter((row) => row.champion.trim() !== '').map((row) => {
      const built = rowToSpec(row, itemsByName)
      unknown.push(...built.unknown)
      return built.spec
    })
    const enemySpecs = enemies.filter((row) => row.champion.trim() !== '').map((row) => {
      const built = rowToSpec(row, itemsByName)
      unknown.push(...built.unknown)
      return built.spec
    })
    if (unknown.length > 0) {
      return { scenario: null, problem: `objetos desconocidos: ${unknown.join(', ')}` }
    }
    return {
      scenario: {
        gameTimeS: Math.max(0, Number(minute) || 0) * 60,
        gold: Math.max(0, Number(gold) || 0),
        magicalFootwear: footwear,
        self: selfSpec.spec,
        allies: allySpecs,
        enemies: enemySpecs
      },
      problem: null
    }
  }

  const runScenario = async (update: boolean): Promise<void> => {
    setError(null)
    const { scenario, problem } = buildScenario()
    if (!scenario) {
      setError(problem)
      return
    }
    const result = update
      ? await window.api.invoke('dev:scenario:update', scenario)
      : await window.api.invoke('dev:scenario:start', scenario)
    const ok = 'started' in result ? result.started : result.updated
    if (ok) setScenarioActive(true)
    else setError(result.error ?? 'no se pudo aplicar')
  }

  const stopScenario = async (): Promise<void> => {
    await window.api.invoke('dev:scenario:stop')
    setScenarioActive(false)
  }

  const runDraft = async (): Promise<void> => {
    setError(null)
    const keyOf = (name: string): number =>
      championKeyByName.get(name.trim().toLowerCase()) ?? 0
    const positions = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
    const selfKey = keyOf(draftSelf)
    const allyCells = draftAllies.map((name, index) => ({
      cellId: index,
      championId: keyOf(name),
      championPickIntent: 0,
      position: positions.filter((position) => position !== draftPosition)[index] ?? ''
    }))
    const state: ChampSelectState = {
      localPlayerCellId: 4,
      ownPosition: draftPosition.toLowerCase(),
      myTeam: [
        ...allyCells,
        {
          cellId: 4,
          championId: draftLocked ? selfKey : 0,
          championPickIntent: draftLocked ? 0 : selfKey,
          position: draftPosition
        }
      ],
      theirTeam: draftEnemies
        .map((name, index) => ({ cellId: 5 + index, championId: keyOf(name) }))
        .filter((member) => member.championId > 0),
      bans: {
        mine: [],
        theirs: draftBans
          .split(',')
          .map((name) => keyOf(name))
          .filter((key) => key > 0)
      },
      timerPhase: 'BAN_PICK'
    }
    const result = await window.api.invoke('dev:champselect:custom', state)
    setDraftActive(result.started)
  }

  const stopDraft = async (): Promise<void> => {
    await window.api.invoke('dev:champselect:stop')
    setDraftActive(false)
  }

  return (
    <div className="flex flex-col gap-3 text-xs">
      <datalist id="scenario-champions">
        {Object.values(championMeta).map((meta) => (
          <option key={meta.id} value={meta.name} />
        ))}
      </datalist>
      <datalist id="scenario-items">
        {itemCatalog.map((item) => (
          <option key={item.id} value={item.name} />
        ))}
      </datalist>

      <div className="rounded border border-slate-800 bg-slate-950/50 p-2.5">
        <p className="mb-2 font-semibold text-slate-300">
          Situación de partida forzada
          <span className="ml-2 font-normal text-slate-500">
            se emite por el pipeline real: motor, overlay, alertas
          </span>
        </p>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1 text-slate-400">
            minuto
            <input
              className="w-12 rounded border border-slate-700 bg-slate-800 px-1.5 py-1"
              value={minute}
              onChange={(event) => setMinute(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-1 text-slate-400">
            tu oro
            <input
              className="w-16 rounded border border-slate-700 bg-slate-800 px-1.5 py-1"
              value={gold}
              onChange={(event) => setGold(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-1 text-slate-400">
            <input
              type="checkbox"
              checked={footwear}
              onChange={(event) => setFootwear(event.target.checked)}
            />
            runa Calzado Mágico
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <PlayerRowEditor label="TÚ" accent="text-amber-300" row={self} onChange={setSelf} />
          {allies.map((row, index) => (
            <PlayerRowEditor
              key={index}
              label={`AL ${String(index + 1)}`}
              accent="text-sky-300"
              row={row}
              onChange={(next) => setAllies(allies.map((r, i) => (i === index ? next : r)))}
            />
          ))}
          {enemies.map((row, index) => (
            <PlayerRowEditor
              key={index}
              label={`EN ${String(index + 1)}`}
              accent="text-rose-300"
              row={row}
              onChange={(next) => setEnemies(enemies.map((r, i) => (i === index ? next : r)))}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            className="rounded bg-indigo-700 px-3 py-1.5 hover:bg-indigo-600"
            onClick={() => void runScenario(false)}
          >
            ▶ Lanzar situación
          </button>
          {scenarioActive && (
            <>
              <button
                className="rounded bg-amber-600 px-3 py-1.5 text-slate-950 hover:bg-amber-500"
                onClick={() => void runScenario(true)}
              >
                Aplicar cambios (dispara eventos)
              </button>
              <button
                className="rounded bg-rose-700 px-3 py-1.5 hover:bg-rose-600"
                onClick={() => void stopScenario()}
              >
                Detener
              </button>
            </>
          )}
          <button
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300"
            onClick={() => {
              setSelf(EXAMPLE_SELF)
              setAllies(EXAMPLE_ALLIES)
              setEnemies(EXAMPLE_ENEMIES)
              setMinute('18')
              setGold('2600')
            }}
          >
            Restaurar ejemplo
          </button>
          <button
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300"
            onClick={() => {
              setSelf(emptyRow('BOTTOM'))
              setAllies([emptyRow('TOP'), emptyRow('JUNGLE'), emptyRow('MIDDLE'), emptyRow('UTILITY')])
              setEnemies(POSITIONS.map((position) => emptyRow(position)))
            }}
          >
            Vaciar
          </button>
        </div>
      </div>

      <div className="rounded border border-slate-800 bg-slate-950/50 p-2.5">
        <p className="mb-2 font-semibold text-slate-300">
          Champ select personalizado
          <span className="ml-2 font-normal text-slate-500">
            deja tu campeón vacío para simular que aún eliges (último pick)
          </span>
        </p>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1 text-slate-400">
            tu posición
            <select
              className="rounded border border-slate-700 bg-slate-800 px-1 py-1"
              value={draftPosition}
              onChange={(event) => setDraftPosition(event.target.value)}
            >
              {POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-slate-400">
            tu campeón
            <input
              className="w-28 rounded border border-slate-700 bg-slate-800 px-1.5 py-1"
              list="scenario-champions"
              placeholder="(eligiendo)"
              value={draftSelf}
              onChange={(event) => setDraftSelf(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-1 text-slate-400">
            <input
              type="checkbox"
              checked={draftLocked}
              onChange={(event) => setDraftLocked(event.target.checked)}
            />
            bloqueado
          </label>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-14 text-[10px] font-bold text-sky-300">ALIADOS</span>
            {draftAllies.map((name, index) => (
              <input
                key={index}
                className="w-26 rounded border border-slate-700 bg-slate-800 px-1.5 py-1"
                list="scenario-champions"
                value={name}
                onChange={(event) =>
                  setDraftAllies(draftAllies.map((n, i) => (i === index ? event.target.value : n)))
                }
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-14 text-[10px] font-bold text-rose-300">ENEMIGOS</span>
            {draftEnemies.map((name, index) => (
              <input
                key={index}
                className="w-26 rounded border border-slate-700 bg-slate-800 px-1.5 py-1"
                list="scenario-champions"
                placeholder="(sin pick)"
                value={name}
                onChange={(event) =>
                  setDraftEnemies(
                    draftEnemies.map((n, i) => (i === index ? event.target.value : n))
                  )
                }
              />
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-slate-400">
            <span className="w-14 text-[10px] font-bold text-slate-500">BANEOS</span>
            <input
              className="min-w-60 flex-1 rounded border border-slate-700 bg-slate-800 px-1.5 py-1"
              list="scenario-champions"
              placeholder="nombres separados por coma"
              value={draftBans}
              onChange={(event) => setDraftBans(event.target.value)}
            />
          </label>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            className="rounded bg-indigo-700 px-3 py-1.5 hover:bg-indigo-600"
            onClick={() => void runDraft()}
          >
            🎯 Simular este draft
          </button>
          {draftActive && (
            <button
              className="rounded bg-rose-700 px-3 py-1.5 hover:bg-rose-600"
              onClick={() => void stopDraft()}
            >
              Terminar
            </button>
          )}
        </div>
      </div>

      {error !== null && <p className="text-rose-400">{error}</p>}
    </div>
  )
}

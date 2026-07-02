import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  championFileSchema,
  itemFileSchema,
  runesFileSchema,
  versionsFileSchema,
  type DdChampion,
  type DdItem,
  type RuneTree
} from '@shared/schemas/ddragon'
import { buildItemGraph, type ItemGraph } from './itemgraph'
import damageProfiles from './champion-damage-profile.json'

export type DamageType = 'physical' | 'magic' | 'mixed'

export interface StaticData {
  patch: string
  /** Raw item data keyed by numeric item id. */
  items: Map<number, DdItem>
  itemGraph: ItemGraph
  /** Champions keyed by ddragon id (e.g. "MonkeyKing"). */
  champions: Map<string, DdChampion>
  /** Same champions keyed by display name (e.g. "Wukong") — Live Client uses these. */
  championsByName: Map<string, DdChampion>
  /** Champions keyed by numeric key (e.g. 62) — Riot API / LCU use these. */
  championsByKey: Map<number, DdChampion>
  runes: RuneTree[]
  damageProfile: (championId: string) => DamageType
}

export interface StaticDataManagerOptions {
  cacheDir: string
  locale?: string
  fetchFn?: typeof fetch
  baseUrl?: string
}

const FILES = ['item.json', 'champion.json', 'runesReforged.json'] as const
type StaticFile = (typeof FILES)[number]

/**
 * Downloads and caches Data Dragon static data per patch under
 * `<cacheDir>/<patch>/`. Offline (or when Riot's CDN is unreachable) it serves
 * the newest cached patch; a patch already cached is never re-downloaded.
 */
export class StaticDataManager {
  private readonly cacheDir: string
  private readonly locale: string
  private readonly fetchFn: typeof fetch
  private readonly baseUrl: string
  private loaded: StaticData | null = null

  constructor(options: StaticDataManagerOptions) {
    this.cacheDir = options.cacheDir
    this.locale = options.locale ?? 'es_ES'
    this.fetchFn = options.fetchFn ?? fetch
    this.baseUrl = options.baseUrl ?? 'https://ddragon.leagueoflegends.com'
  }

  async load(): Promise<StaticData> {
    if (this.loaded) return this.loaded
    const patch = await this.resolvePatch()
    if (patch === null) {
      throw new Error(
        'No static data available: Riot CDN unreachable and no cached patch found'
      )
    }
    await this.ensureCached(patch)
    this.loaded = this.readFromCache(patch)
    return this.loaded
  }

  /** Latest patch from the CDN, or newest cached patch when offline. */
  private async resolvePatch(): Promise<string | null> {
    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/versions.json`)
      if (!response.ok) throw new Error(`versions.json HTTP ${String(response.status)}`)
      const versions = versionsFileSchema.parse(await response.json())
      return versions[0] ?? null
    } catch {
      return this.newestCachedPatch()
    }
  }

  private newestCachedPatch(): string | null {
    if (!existsSync(this.cacheDir)) return null
    const patches = readdirSync(this.cacheDir).filter((dir) =>
      FILES.every((file) => existsSync(join(this.cacheDir, dir, file)))
    )
    if (patches.length === 0) return null
    return patches.sort(comparePatchDesc)[0] ?? null
  }

  private async ensureCached(patch: string): Promise<void> {
    const patchDir = join(this.cacheDir, patch)
    if (FILES.every((file) => existsSync(join(patchDir, file)))) return
    mkdirSync(patchDir, { recursive: true })
    for (const file of FILES) {
      const url = `${this.baseUrl}/cdn/${patch}/data/${this.locale}/${file}`
      const response = await this.fetchFn(url)
      if (!response.ok) {
        throw new Error(`Failed to download ${file} for ${patch}: HTTP ${String(response.status)}`)
      }
      writeFileSync(join(patchDir, file), await response.text())
    }
  }

  private readFromCache(patch: string): StaticData {
    const patchDir = join(this.cacheDir, patch)
    const readJson = (file: StaticFile): unknown =>
      JSON.parse(readFileSync(join(patchDir, file), 'utf8'))

    const itemFile = itemFileSchema.parse(readJson('item.json'))
    const championFile = championFileSchema.parse(readJson('champion.json'))
    const runes = runesFileSchema.parse(readJson('runesReforged.json'))

    const items = new Map<number, DdItem>(
      Object.entries(itemFile.data).map(([id, item]) => [Number(id), item])
    )
    const champions = new Map<string, DdChampion>(Object.entries(championFile.data))
    const championsByName = new Map<string, DdChampion>(
      [...champions.values()].map((champion) => [champion.name, champion])
    )
    const championsByKey = new Map<number, DdChampion>(
      [...champions.values()].map((champion) => [Number(champion.key), champion])
    )

    const profiles = damageProfiles as Record<string, string>
    const damageProfile = (championId: string): DamageType => {
      const profile = profiles[championId]
      return profile === 'physical' || profile === 'magic' || profile === 'mixed'
        ? profile
        : 'mixed'
    }

    return {
      patch,
      items,
      itemGraph: buildItemGraph(itemFile.data),
      champions,
      championsByName,
      championsByKey,
      runes,
      damageProfile
    }
  }
}

/** Sorts "16.13.1" style patch strings, newest first. */
export function comparePatchDesc(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

import { gunzipSync } from 'node:zlib'
import { Buffer } from 'node:buffer'
import { metaSeedSchema } from '@shared/schemas/meta-seed'
import type { AppDatabase } from './db'
import { MetaRepo } from './db/repos'

/** Latest release always carries the freshest seed (see release-workflow). */
const SEED_URL =
  'https://github.com/carlo23666/lolcompanion/releases/latest/download/meta-seed.json.gz'

const DOWNLOAD_TIMEOUT_MS = 20_000

export type SeedImportResult = 'imported' | 'skipped-not-empty' | 'unavailable' | 'invalid'

/**
 * First-run bootstrap: a fresh install has an EMPTY meta store, which mutes
 * the (Master+-first) engine until a local crawl accumulates data. Instead,
 * download the shared aggregate seed from the latest GitHub release and start
 * with builds from minute one. Fully graceful: offline, missing asset or a
 * malformed payload just leave the store empty (the crawler still works).
 */
export async function importMetaSeedIfEmpty(
  db: AppDatabase,
  options: { url?: string; fetchImpl?: typeof fetch; log?: (message: string) => void } = {}
): Promise<SeedImportResult> {
  const { url = SEED_URL, fetchImpl = fetch, log = () => undefined } = options
  const repo = new MetaRepo(db)
  if (repo.latestPatch() !== null) return 'skipped-not-empty'

  let raw: unknown
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      redirect: 'follow'
    })
    if (!response.ok) {
      log(`[meta-seed] download failed: HTTP ${String(response.status)}`)
      return 'unavailable'
    }
    const body = Buffer.from(await response.arrayBuffer())
    raw = JSON.parse(gunzipSync(body).toString('utf8'))
  } catch (error) {
    log(`[meta-seed] download failed: ${error instanceof Error ? error.message : 'unknown'}`)
    return 'unavailable'
  }

  const parsed = metaSeedSchema.safeParse(raw)
  if (!parsed.success) {
    log('[meta-seed] payload failed validation — ignored')
    return 'invalid'
  }

  const imported = repo.importSeed(parsed.data)
  if (!imported) return 'skipped-not-empty'
  log(
    `[meta-seed] imported patch ${parsed.data.patch}: ${String(parsed.data.matchIds.length)} matches, ${String(parsed.data.items.length)} item rows`
  )
  return 'imported'
}

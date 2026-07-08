/**
 * Exports the local Master+ aggregates as dist/meta-seed.json.gz — published
 * as a release asset so fresh installs bootstrap their meta store instead of
 * crawling from zero (src/main/meta-seed.ts downloads it on first run).
 *
 * Run under Electron's Node (better-sqlite3 is compiled for that ABI):
 *   npm run meta:export            → reads %APPDATA%/lol-companion/lol-companion.db
 *   npm run meta:export -- <path>  → reads an explicit .db path
 *
 * Aggregates only + public match ids — nothing personal leaves the machine.
 */
import { Buffer } from 'node:buffer'
import { gzipSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const dbPath =
  process.argv[2] ?? join(process.env.APPDATA ?? '', 'lol-companion', 'lol-companion.db')

const db = new Database(dbPath, { readonly: true, fileMustExist: true })

// Newest patch with data, numeric-aware ("16.9" < "16.13").
const patches = db
  .prepare("SELECT DISTINCT patch FROM meta_matches WHERE patch != 'skip'")
  .all()
  .map((row) => row.patch)
  .sort((a, b) => {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    return (pb[0] ?? 0) - (pa[0] ?? 0) || (pb[1] ?? 0) - (pa[1] ?? 0)
  })
const patch = patches[0]
if (!patch) {
  console.error('No aggregated meta data in the database — run the crawler first.')
  process.exit(1)
}

// Order rows only exist if the exporting DB reached migration 006 (WP-015);
// an empty table still exports as version 2 with itemOrder: [] — importers
// then mark seeded matches as timeline-done, which is correct because the
// exporter's aggregates ARE the order truth for those matches.
const seed = {
  version: 2,
  patch,
  exportedAt: new Date().toISOString(),
  matchIds: db
    .prepare('SELECT matchId FROM meta_matches WHERE patch = ?')
    .all(patch)
    .map((row) => row.matchId),
  championStats: db
    .prepare('SELECT champion, role, games, wins FROM meta_champion_stats WHERE patch = ?')
    .all(patch),
  matchups: db
    .prepare('SELECT champion, role, enemyChampion, games, wins FROM meta_matchups WHERE patch = ?')
    .all(patch),
  items: db
    .prepare('SELECT champion, role, itemId, games, wins FROM meta_champion_items WHERE patch = ?')
    .all(patch),
  itemOrder: db
    .prepare(
      'SELECT champion, role, itemId, games, slotSum, firstGames FROM meta_champion_item_order WHERE patch = ?'
    )
    .all(patch)
}
db.close()

mkdirSync('dist', { recursive: true })
const outPath = join('dist', 'meta-seed.json.gz')
const gz = gzipSync(Buffer.from(JSON.stringify(seed)), { level: 9 })
writeFileSync(outPath, gz)
console.log(
  `wrote ${outPath}: patch ${patch}, ${seed.matchIds.length} matches, ` +
    `${seed.championStats.length} champion rows, ${seed.matchups.length} matchups, ` +
    `${seed.items.length} item rows (${Math.round(gz.length / 1024)} KB)`
)

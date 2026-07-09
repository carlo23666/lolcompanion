/**
 * Refreshes the shared Master+ base for a release (WP-019): exports the local
 * aggregates to dist/meta-seed.json.gz, then uploads it to the draft release so
 * fresh installs bootstrap from current data instead of a carried-over stale
 * seed. Run AFTER the tag-push CI created the draft, BEFORE publishing:
 *
 *   npm run meta:publish -- v1.4.5
 *
 * Requires the GitHub CLI (`gh`) authenticated with write access to the repo.
 * Aggregates + public match ids only — nothing personal is uploaded.
 */
import { spawnSync } from 'node:child_process'

const tag = process.argv[2]
if (!tag) {
  console.error('usage: npm run meta:publish -- <release-tag>   (e.g. v1.4.5)')
  process.exit(1)
}

console.log('[meta:publish] exporting local aggregates…')
const exported = spawnSync(
  'node',
  ['scripts/electron-node.mjs', 'scripts/export-meta-seed.mjs'],
  { stdio: 'inherit' }
)
if (exported.status !== 0) {
  console.error('[meta:publish] export failed — crawl some data first, then retry.')
  process.exit(exported.status ?? 1)
}

console.log(`[meta:publish] uploading dist/meta-seed.json.gz to ${tag}…`)
const uploaded = spawnSync(
  'gh',
  ['release', 'upload', tag, 'dist/meta-seed.json.gz', '--clobber'],
  { stdio: 'inherit', shell: process.platform === 'win32' }
)
if (uploaded.status !== 0) {
  console.error('[meta:publish] gh upload failed — is the draft release created and `gh` authed?')
  process.exit(uploaded.status ?? 1)
}

console.log(`[meta:publish] done — fresh seed attached to ${tag}.`)

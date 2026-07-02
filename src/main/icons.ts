import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app, protocol } from 'electron'

/**
 * `ddicon://` — serves Data Dragon item/champion icons from a local cache
 * under userData. Icons download from the CDN once (first display) and are
 * served from disk afterwards; the renderer never talks to the CDN.
 *
 * URLs: ddicon://item/3031.png · ddicon://champion/Jinx.png
 */

export function registerIconScheme(): void {
  // Must run before app.whenReady().
  protocol.registerSchemesAsPrivileged([
    { scheme: 'ddicon', privileges: { standard: true, secure: true } }
  ])
}

const VALID_KINDS = new Set(['item', 'champion'])
const FILE_RE = /^[A-Za-z0-9._-]+\.png$/

export function registerIconProtocol(getPatch: () => string | null): void {
  const cacheRoot = join(app.getPath('userData'), 'staticdata', 'icons')

  protocol.handle('ddicon', async (request) => {
    try {
      const url = new URL(request.url)
      const kind = url.host
      const file = url.pathname.replace(/^\//, '')
      const patch = getPatch()
      if (!VALID_KINDS.has(kind) || !FILE_RE.test(file) || patch === null) {
        return new Response('not found', { status: 404 })
      }

      const cached = join(cacheRoot, patch, kind, file)
      if (existsSync(cached)) {
        return new Response(readFileSync(cached), {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=31536000' }
        })
      }

      const cdnUrl = `https://ddragon.leagueoflegends.com/cdn/${patch}/img/${kind}/${file}`
      const response = await fetch(cdnUrl)
      if (!response.ok) return new Response('not found', { status: 404 })
      const body = Buffer.from(await response.arrayBuffer())
      mkdirSync(dirname(cached), { recursive: true })
      writeFileSync(cached, body)
      return new Response(body, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=31536000' }
      })
    } catch {
      return new Response('error', { status: 500 })
    }
  })
}

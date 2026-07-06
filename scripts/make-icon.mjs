// Generates resources/icon.png (256x256) — the app/installer/window icon.
// Zero-dep PNG encoder (node:zlib deflate + hand-rolled chunks) drawing the
// hextech mark: gold hexagon ring + teal inner crystal on deep navy.
// The output is COMMITTED (the main process imports it as ?asset for the
// runtime window icon); rerun after tweaking: node scripts/make-icon.mjs
import { Buffer } from 'node:buffer'
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 256
const CENTER = SIZE / 2

// Palette (matches the hextech theme in src/renderer/src/assets/main.css).
const NAVY = [15, 17, 23]
const NAVY_LIGHT = [26, 31, 46]
const GOLD = [200, 155, 60]
const GOLD_BRIGHT = [240, 200, 100]
const TEAL = [10, 200, 185]

/** Signed distance from point to the edge of a flat-top hexagon of radius r. */
function hexDistance(x, y, r) {
  const px = Math.abs(x)
  const py = Math.abs(y)
  // Flat-top hexagon: max of the three half-plane distances.
  return Math.max(px * 0.866025 + py * 0.5, py) - r
}

const pixels = Buffer.alloc(SIZE * SIZE * 4)

for (let row = 0; row < SIZE; row++) {
  for (let col = 0; col < SIZE; col++) {
    const x = col - CENTER
    const y = row - CENTER
    const radial = Math.hypot(x, y) / CENTER

    // Rounded-square navy background with a subtle center glow.
    const cornerR = 56
    const half = CENTER - 4
    const qx = Math.max(Math.abs(x) - half + cornerR, 0)
    const qy = Math.max(Math.abs(y) - half + cornerR, 0)
    const bgDist = Math.hypot(qx, qy) - cornerR
    let alpha = bgDist < 0 ? 255 : Math.max(0, Math.round(255 * (1 - bgDist)))

    const glow = Math.max(0, 1 - radial * 1.4)
    let rC = NAVY[0] + (NAVY_LIGHT[0] - NAVY[0]) * glow
    let gC = NAVY[1] + (NAVY_LIGHT[1] - NAVY[1]) * glow
    let bC = NAVY[2] + (NAVY_LIGHT[2] - NAVY[2]) * glow

    // Outer gold hexagon ring.
    const ringOuter = hexDistance(x, y, 100)
    const ringInner = hexDistance(x, y, 84)
    if (ringOuter < 0 && ringInner > 0) {
      const edge = Math.min(-ringOuter, ringInner)
      const t = Math.min(1, edge / 3)
      // Brighter toward the top-left for a lit-metal feel.
      const sheen = 0.5 + 0.5 * Math.max(0, -(x + y) / 180)
      rC = rC + ((GOLD[0] + (GOLD_BRIGHT[0] - GOLD[0]) * sheen) - rC) * t
      gC = gC + ((GOLD[1] + (GOLD_BRIGHT[1] - GOLD[1]) * sheen) - gC) * t
      bC = bC + ((GOLD[2] + (GOLD_BRIGHT[2] - GOLD[2]) * sheen) - bC) * t
    }

    // Inner teal crystal (smaller hexagon), with a vertical facet split.
    const crystal = hexDistance(x, y, 52)
    if (crystal < 0) {
      const t = Math.min(1, -crystal / 3)
      const facet = x < 0 ? 1 : 0.72
      rC = rC + (TEAL[0] * facet - rC) * t
      gC = gC + (TEAL[1] * facet - gC) * t
      bC = bC + (TEAL[2] * facet - bC) * t
    }

    const offset = (row * SIZE + col) * 4
    pixels[offset] = Math.round(rC)
    pixels[offset + 1] = Math.round(gC)
    pixels[offset + 2] = Math.round(bC)
    pixels[offset + 3] = alpha
  }
}

// --- PNG encoding ---
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
// Raw scanlines with filter byte 0.
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let row = 0; row < SIZE; row++) {
  pixels.copy(raw, row * (SIZE * 4 + 1) + 1, row * SIZE * 4, (row + 1) * SIZE * 4)
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'icon.png')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, png)
console.log(`wrote ${outPath} (${png.length} bytes)`)

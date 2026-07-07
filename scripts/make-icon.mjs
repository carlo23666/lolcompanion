// Generates resources/icon.png (256x256) — the app/installer/window icon.
// Zero-dep PNG encoder (node:zlib deflate + hand-rolled chunks) drawing the
// brand mark: pixel Bitxo face (gold coach headband) over the void-navy
// rounded square with the rift-aurora glows (pink top-left, gold bottom-right)
// — matches the "Neón Grieta" identity in src/renderer/src/assets/main.css.
// The output is COMMITTED (the main process imports it as ?asset for the
// runtime window icon); rerun after tweaking: node scripts/make-icon.mjs
import { Buffer } from 'node:buffer'
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 256
const CENTER = SIZE / 2

// Palette (matches the neon identity in main.css).
const NAVY = [10, 14, 28]
const NAVY_LIGHT = [17, 22, 41]
const PINK = [255, 93, 143]
const GOLD = [242, 193, 78]

// Bitxo face, front view, 15×11 cells. Same colors as Mascot.tsx.
const FACE = [
  '.....ppppp.....',
  'g...ppppppp...g',
  'gg.phhhhhhhp.gg',
  '.gg.ppppppp.gg.',
  'gg.ppppppppp.gg',
  '.g.pEwpppEwp.g.',
  'gg.ppppppppp.gg',
  '.g.pcpppppcp.g.',
  '...pppmmmppp...',
  '....ppppppp....',
  '.....ppppp.....'
]
const FACE_COLORS = {
  p: [255, 167, 201], // body pink
  g: [255, 93, 143], // gill fronds (brand pink)
  E: [43, 33, 64], // eye
  w: [255, 255, 255], // eye shine
  c: [255, 107, 138], // cheek blush
  m: [217, 106, 155], // smile
  h: [242, 193, 78] // gold coach headband
}
const CELL = 13 // 15*13 = 195px wide
const FACE_W = FACE[0].length * CELL
const FACE_H = FACE.length * CELL
const FACE_X = Math.round((SIZE - FACE_W) / 2)
const FACE_Y = Math.round((SIZE - FACE_H) / 2) + 6

const pixels = Buffer.alloc(SIZE * SIZE * 4)

for (let row = 0; row < SIZE; row++) {
  for (let col = 0; col < SIZE; col++) {
    const x = col - CENTER
    const y = row - CENTER

    // Rounded-square alpha mask.
    const cornerR = 56
    const half = CENTER - 4
    const qx = Math.max(Math.abs(x) - half + cornerR, 0)
    const qy = Math.max(Math.abs(y) - half + cornerR, 0)
    const bgDist = Math.hypot(qx, qy) - cornerR
    const alpha = bgDist < 0 ? 255 : Math.max(0, Math.round(255 * (1 - bgDist)))

    // Void navy base with a soft vertical lift.
    const lift = Math.max(0, 1 - row / SIZE)
    let rC = NAVY[0] + (NAVY_LIGHT[0] - NAVY[0]) * lift
    let gC = NAVY[1] + (NAVY_LIGHT[1] - NAVY[1]) * lift
    let bC = NAVY[2] + (NAVY_LIGHT[2] - NAVY[2]) * lift

    // Rift aurora: pink glow from the top-left, gold ember bottom-right.
    const pinkGlow = Math.max(0, 1 - Math.hypot(col - 52, row - 44) / 190) * 0.34
    const goldGlow = Math.max(0, 1 - Math.hypot(col - 212, row - 226) / 190) * 0.26
    rC += (PINK[0] - rC) * pinkGlow + (GOLD[0] - rC) * goldGlow
    gC += (PINK[1] - gC) * pinkGlow + (GOLD[1] - gC) * goldGlow
    bC += (PINK[2] - bC) * pinkGlow + (GOLD[2] - bC) * goldGlow

    // Bitxo face cells on top (hard pixel edges — it IS pixel art).
    const cellCol = Math.floor((col - FACE_X) / CELL)
    const cellRow = Math.floor((row - FACE_Y) / CELL)
    if (cellRow >= 0 && cellRow < FACE.length && cellCol >= 0 && cellCol < FACE[0].length) {
      const cell = FACE[cellRow][cellCol]
      const color = FACE_COLORS[cell]
      if (color) {
        rC = color[0]
        gC = color[1]
        bC = color[2]
      }
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

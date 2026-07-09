// Generates resources/icon.png (256x256) — the app/installer/window icon.
// Zero-dep PNG encoder (node:zlib deflate + hand-rolled chunks) drawing the
// brand mark for the DEFAULT identity, "Abismo": Sombra the shadow cat —
// glowing neon-crimson eyes over the void-black rounded square with a crimson
// bloom rising from below and a corner vignette. Matches the abismo palette in
// src/renderer/src/assets/main.css. Smooth vector-style (distance fields), not
// pixels. The output is COMMITTED (the main process imports it as ?asset for
// the runtime window icon); rerun after tweaking: node scripts/make-icon.mjs
import { Buffer } from 'node:buffer'
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 256
const CENTER = SIZE / 2

// Palette (matches the abismo identity in main.css).
const ABYSS = [4, 4, 6]
const ABYSS_LIFT = [16, 16, 26]
const FUR = [12, 12, 20]
const CRIMSON = [255, 45, 85]
const EYE_CORE = [255, 226, 233]
const SLIT = [20, 3, 10]
const INNER_EAR = [92, 16, 36]

const lerp = (a, b, t) => a + (b - a) * t
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

// Point inside triangle (a,b,c) via consistent cross-product signs.
function inTri(px, py, a, b, c) {
  const d = (p, q) => (px - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (py - q[1])
  const d1 = d(a, b),
    d2 = d(b, c),
    d3 = d(c, a)
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  return !(neg && pos)
}

// Head + ears geometry.
const HEAD = { cx: 128, cy: 152, rx: 68, ry: 60 }
const EAR_L = [
  [86, 54],
  [64, 120],
  [122, 100]
]
const EAR_R = [
  [170, 54],
  [192, 120],
  [134, 100]
]
const EAR_L_IN = [
  [92, 72],
  [80, 112],
  [116, 100]
]
const EAR_R_IN = [
  [164, 72],
  [176, 112],
  [140, 100]
]
const EYE_L = { ex: 100, ey: 150, ang: 0.2 }
const EYE_R = { ex: 156, ey: 150, ang: -0.2 }
const EYE_RX = 13
const EYE_RY = 21

// Rotated-ellipse membership for an eye; returns { r, lx } in local space.
function eyeLocal(col, row, eye) {
  const c = Math.cos(eye.ang),
    s = Math.sin(eye.ang)
  const dx = col - eye.ex,
    dy = row - eye.ey
  const lx = dx * c + dy * s
  const ly = -dx * s + dy * c
  return { r: Math.hypot(lx / EYE_RX, ly / EYE_RY), lx }
}

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

    // Void base with a faint vertical lift.
    const lift = Math.max(0, 1 - row / SIZE) * 0.6
    let color = mix(ABYSS, ABYSS_LIFT, lift)

    // Crimson bloom rising from below + a faint haze up top (abismo body::after).
    const bloom = Math.max(0, 1 - Math.hypot(col - 128, row - 268) / 205) * 0.4
    const haze = Math.max(0, 1 - Math.hypot(col - 128, row + 6) / 150) * 0.1
    color = mix(color, CRIMSON, bloom)
    color = mix(color, CRIMSON, haze)

    // Cat silhouette (head ellipse + ear triangles).
    const rHead = Math.hypot((col - HEAD.cx) / HEAD.rx, (row - HEAD.cy) / HEAD.ry)
    const inHead = rHead <= 1
    const inEar = inTri(col, row, ...EAR_L) || inTri(col, row, ...EAR_R)
    if (inHead || inEar) {
      color = FUR.slice()
      // crimson rim on the round head edge
      if (inHead && rHead > 0.9) color = mix(color, CRIMSON, ((rHead - 0.9) / 0.1) * 0.85)
      // inner-ear crimson
      if (inTri(col, row, ...EAR_L_IN) || inTri(col, row, ...EAR_R_IN)) color = INNER_EAR.slice()
    }

    // Eye glow — additive crimson bloom around each eye, over fur and void alike.
    const glow =
      Math.pow(Math.max(0, 1 - Math.hypot(col - EYE_L.ex, row - EYE_L.ey) / 50), 1.4) +
      Math.pow(Math.max(0, 1 - Math.hypot(col - EYE_R.ex, row - EYE_R.ey) / 50), 1.4)
    if (glow > 0) color = mix(color, CRIMSON, Math.min(0.6, glow * 0.6))

    // Crisp glowing eyes on top (bright hot core → crimson → dark slit).
    for (const eye of [EYE_L, EYE_R]) {
      const { r, lx } = eyeLocal(col, row, eye)
      if (r <= 1) {
        let c = mix(EYE_CORE, CRIMSON, clamp01(r * 1.3))
        c = mix(c, [150, 12, 34], clamp01((r - 0.7) / 0.3) * 0.6)
        if (Math.abs(lx) < 2.6) c = SLIT.slice()
        color = c
      }
    }

    // Nose — small crimson wedge under the eyes.
    if (
      inTri(
        col,
        row,
        [122, 172],
        [134, 172],
        [128, 180]
      )
    )
      color = mix(CRIMSON, [150, 12, 34], 0.3)

    // Corner vignette — the void gains weight toward the edges.
    const vd = Math.hypot(x, y) / (CENTER * 1.1)
    color = mix(color, [0, 0, 0], clamp01((vd - 0.62) / 0.5) * 0.55)

    const offset = (row * SIZE + col) * 4
    pixels[offset] = Math.round(clamp01(color[0] / 255) * 255)
    pixels[offset + 1] = Math.round(clamp01(color[1] / 255) * 255)
    pixels[offset + 2] = Math.round(clamp01(color[2] / 255) * 255)
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

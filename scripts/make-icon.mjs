// Generates resources/icon.png (256x256) from WinCon's route-signal mark.
// Zero dependencies: a small rasterizer plus a hand-rolled PNG encoder.
// The output is committed because Electron uses it for the window/installer.
import { Buffer } from 'node:buffer'
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 256
const SCALE = 3
const INK = [247, 249, 252]
const GOLD = [238, 191, 79]
const SIGNAL = [227, 74, 131]
const MUTED = [92, 105, 136]
const BASE = [7, 10, 18]
const BASE_LIFT = [18, 24, 42]

const clamp01 = (value) => Math.max(0, Math.min(1, value))
const mix = (a, b, amount) => a.map((value, index) => value + (b[index] - value) * amount)

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function polylineDistance(px, py, points) {
  let distance = Infinity
  for (let index = 1; index < points.length; index++) {
    distance = Math.min(
      distance,
      segmentDistance(px, py, points[index - 1][0], points[index - 1][1], points[index][0], points[index][1])
    )
  }
  return distance
}

function inTriangle(px, py, a, b, c) {
  const sign = (p, q) => (px - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (py - q[1])
  const d1 = sign(a, b)
  const d2 = sign(b, c)
  const d3 = sign(c, a)
  return !(d1 < 0 || d2 < 0 || d3 < 0) || !(d1 > 0 || d2 > 0 || d3 > 0)
}

function roundedSquareAlpha(x, y) {
  const radius = 48
  const half = 124
  const qx = Math.max(Math.abs(x - 128) - half + radius, 0)
  const qy = Math.max(Math.abs(y - 128) - half + radius, 0)
  return clamp01(0.8 - (Math.hypot(qx, qy) - radius))
}

function sample(x, y) {
  const alpha = roundedSquareAlpha(x, y)
  const lift = clamp01((232 - y) / 290)
  let color = mix(BASE, BASE_LIFT, lift)

  const goldGlow = clamp01(1 - Math.hypot(x - 120, y - 118) / 145) * 0.12
  const signalGlow = clamp01(1 - Math.hypot(x - 72, y - 184) / 116) * 0.13
  color = mix(color, GOLD, goldGlow)
  color = mix(color, SIGNAL, signalGlow)

  const paths = [
    { points: [[34, 52], [75, 52], [116, 102]], color: GOLD, width: 10 },
    { points: [[34, 204], [75, 204], [116, 154]], color: SIGNAL, width: 10 },
    { points: [[140, 128], [207, 128]], color: GOLD, width: 10 },
    { points: [[151, 96], [174, 72], [217, 72]], color: MUTED, width: 7 },
    { points: [[151, 160], [174, 184], [217, 184]], color: MUTED, width: 7 },
  ]
  for (const path of paths) {
    const coverage = clamp01(path.width / 2 + 0.7 - polylineDistance(x, y, path.points))
    color = mix(color, path.color, coverage)
  }

  const nodeDistance = Math.hypot(x - 128, y - 128)
  if (nodeDistance <= 29) color = mix(color, GOLD, clamp01(30 - nodeDistance))
  if (nodeDistance <= 19) color = mix(color, BASE, clamp01(20 - nodeDistance))
  if (nodeDistance <= 6) color = mix(color, INK, clamp01(7 - nodeDistance))

  if (inTriangle(x, y, [224, 128], [198, 111], [198, 145])) color = GOLD

  return [...color.map(Math.round), Math.round(alpha * 255)]
}

const pixels = Buffer.alloc(SIZE * SIZE * 4)
for (let row = 0; row < SIZE; row++) {
  for (let column = 0; column < SIZE; column++) {
    const accum = [0, 0, 0, 0]
    for (let sy = 0; sy < SCALE; sy++) {
      for (let sx = 0; sx < SCALE; sx++) {
        const rgba = sample(column + (sx + 0.5) / SCALE, row + (sy + 0.5) / SCALE)
        rgba.forEach((value, index) => (accum[index] += value))
      }
    }
    const offset = (row * SIZE + column) * 4
    accum.forEach((value, index) => (pixels[offset + index] = Math.round(value / (SCALE * SCALE))))
  }
}

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
ihdr[8] = 8
ihdr[9] = 6
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let row = 0; row < SIZE; row++) {
  pixels.copy(raw, row * (SIZE * 4 + 1) + 1, row * SIZE * 4, (row + 1) * SIZE * 4)
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'icon.png')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, png)
console.log(`wrote ${outPath} (${png.length} bytes)`)

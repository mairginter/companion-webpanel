/**
 * generate-icons.mjs — Tray-Icons für CompanionWebpanel generieren
 *
 * Erstellt 3 Varianten (16×16 PNG) ohne externe Dependencies (nur Node built-ins):
 *   tray-connected.png  — grüner Status-Dot
 *   tray-partial.png    — oranger Status-Dot
 *   tray-error.png      — roter Status-Dot
 *
 * Design: Mini-Companion-Panel (2×3 Button-Grid) auf dunklem Hintergrund
 *
 * Ausführen: node packages/electron/assets/generate-icons.mjs
 */

import * as zlib from 'zlib'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Farb-Tokens (Design-System) ─────────────────────────────────────────────
const COLORS = {
  bg:      [15, 20, 26, 255],   // #0f141a  surface.base
  card:    [26, 32, 48, 255],   // #1a2030  surface.card
  border:  [42, 51, 68, 150],   // #2a3344  surface.border (halbtransparent)
  btn:     [233, 237, 242, 255],// #e9edf2  text.primary  (helle Buttons)
  btnDim:  [136, 150, 170, 180],// #8896aa  text.secondary (gedimmte Buttons)
  green:   [33, 208, 122, 255], // #21d07a  accent.green
  orange:  [255, 138, 61, 255], // #ff8a3d  accent.orange
  red:     [255, 90, 95, 255],  // #ff5a5f  accent.red
}

// ─── PNG-Encoder (pure Node / zlib) ──────────────────────────────────────────

function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
      t[i] = c
    }
    return t
  })())
  let c = 0xffffffff
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function u32(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n >>> 0, 0)
  return b
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = u32(data.length)
  const crcInput = Buffer.concat([typeBytes, data])
  return Buffer.concat([len, typeBytes, data, u32(crc32(crcInput))])
}

function encodePNG(width, height, rgba) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR: width, height, bit depth=8, color type=6 (RGBA), compression=0, filter=0, interlace=0
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.writeUInt8(8, 8)   // bit depth
  ihdr.writeUInt8(6, 9)   // RGBA
  ihdr.writeUInt8(0, 10)
  ihdr.writeUInt8(0, 11)
  ihdr.writeUInt8(0, 12)

  // Raw scanlines (filter byte 0 = None prepended to each row)
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0 // filter type None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4
      const dst = y * (1 + width * 4) + 1 + x * 4
      raw[dst]     = rgba[src]
      raw[dst + 1] = rgba[src + 1]
      raw[dst + 2] = rgba[src + 2]
      raw[dst + 3] = rgba[src + 3]
    }
  }

  const compressed = zlib.deflateSync(raw)
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

// ─── Pixel-Zeichnungs-Utilities ───────────────────────────────────────────────

function setPixel(pixels, width, x, y, color) {
  if (x < 0 || x >= width || y < 0 || y >= 16) return
  const idx = (y * width + x) * 4
  pixels[idx]     = color[0]
  pixels[idx + 1] = color[1]
  pixels[idx + 2] = color[2]
  pixels[idx + 3] = color[3] ?? 255
}

function fillRect(pixels, width, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(pixels, width, x + dx, y + dy, color)
    }
  }
}

// Sanft abgerundete Ecke: Kantenpixel halbtransparent
function fillRoundRect(pixels, width, x, y, w, h, color) {
  fillRect(pixels, width, x, y, w, h, color)
  // Ecken 1px abdunkeln für Rounded-Feeling
  const dim = color.map((c, i) => i === 3 ? Math.floor(c * 0.4) : c)
  setPixel(pixels, width, x, y, dim)
  setPixel(pixels, width, x + w - 1, y, dim)
  setPixel(pixels, width, x, y + h - 1, dim)
  setPixel(pixels, width, x + w - 1, y + h - 1, dim)
}

// ─── Icon-Design ─────────────────────────────────────────────────────────────
//
// 16×16 Layout (0-indexed, y↓):
//
//   . . . . . . . . . . . . . . . .   y=0  (Rand)
//   . [B1  ] . [B2  ] . . . . . . .   y=1
//   . [B1  ] . [B2  ] . . . . . . .   y=2
//   . [B1  ] . [B2  ] . . . . . . .   y=3
//   . . . . . . . . . . . . . . . .   y=4  (Gap)
//   . [B3  ] . [B4  ] . . . . . . .   y=5
//   . [B3  ] . [B4  ] . . . . . . .   y=6
//   . [B3  ] . [B4  ] . . . . . . .   y=7
//   . . . . . . . . . . . . . . . .   y=8  (Gap)
//   . [B5  ] . [B6  ] . . . . . . .   y=9
//   . [B5  ] . [B6  ] . [Slider ]  .   y=10
//   . [B5  ] . [B6  ] . [Slider ]  .   y=11
//   . . . . . . . . . . . . . . . .   y=12 (Gap)
//   . . . . . . . . . . . [DOT ] .   y=13
//   . . . . . . . . . . . [DOT ] .   y=14
//   . . . . . . . . . . . . . . . .   y=15 (Rand)
//
// Buttons: 4×3px, Spalten x=1–4 und x=6–9
// Slider-Bar: x=11–13, y=10–11 (farbig = Regler)
// Status-Dot: x=12–13, y=13–14 (2×2px)
//

function createTrayIcon(statusColor) {
  const W = 16, H = 16
  const pixels = new Uint8Array(W * H * 4)

  // Hintergrund
  fillRect(pixels, W, 0, 0, W, H, COLORS.bg)

  // Helle Buttons (2 Spalten × 3 Reihen, je 4×3px)
  const btnCols = [1, 6]   // X-Start pro Spalte
  const btnRows = [1, 5, 9] // Y-Start pro Reihe

  btnCols.forEach((bx, ci) => {
    btnRows.forEach((by, ri) => {
      // Letzter Button (Reihe 3, Spalte 2) leicht gedimmt für Tiefe
      const isAccent = (ri === 1 && ci === 0) // B3 = aktiver Button-Akzent
      const color = isAccent ? statusColor : COLORS.btn
      fillRoundRect(pixels, W, bx, by, 4, 3, color)
    })
  })

  // Regler / Slider-Track (x=11–13, y=9–11, 3px hoch)
  fillRect(pixels, W, 11, 9,  3, 3, COLORS.card)   // Track (dunkel)
  fillRect(pixels, W, 11, 9,  3, 1, COLORS.btnDim) // Track-Linie
  // Slider-Knob (Farbe = Status)
  fillRect(pixels, W, 11, 10, 3, 1, statusColor)

  // Status-Dot (2×2px, unten rechts)
  fillRect(pixels, W, 13, 13, 2, 2, statusColor)

  return encodePNG(W, H, pixels)
}

// ─── Dateien schreiben ────────────────────────────────────────────────────────

const icons = [
  { file: 'tray-connected.png', color: COLORS.green,  label: 'connected' },
  { file: 'tray-partial.png',   color: COLORS.orange, label: 'partial'   },
  { file: 'tray-error.png',     color: COLORS.red,    label: 'error'     },
]

for (const { file, color, label } of icons) {
  const png = createTrayIcon(color)
  const dest = path.join(__dirname, file)
  fs.writeFileSync(dest, png)
  console.log(`✓ ${file} (${label})`)
}

console.log('Done — 3 tray icons generated.')

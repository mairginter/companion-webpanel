/**
 * generate-app-icon.mjs — App-Icon ohne externe Dependencies
 *
 * Rendert das Icon-Design direkt als Pixel (keine native lib nötig).
 * 2× Supersampling (intern 1024×1024 → output 512×512) für glatte Kanten.
 *
 * Erzeugt:
 *   icon-512.png   — 512×512 (macOS, Referenz)
 *   icon-256.png   — 256×256 (Windows ICO-Einbettung)
 *   icon.ico       — Windows ICO (256px PNG-komprimiert, Vista+)
 *
 * Ausführen: node packages/electron/assets/generate-app-icon.mjs
 */

import * as zlib from 'zlib'
import * as fs   from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── PNG-Encoder (pure Node) ─────────────────────────────────────────────────

function crc32(buf) {
  const t = crc32._t || (crc32._t = (() => {
    const a = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
      a[i] = c
    }
    return a
  })())
  let c = 0xffffffff
  for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b }

function pngChunk(type, data) {
  const ty = Buffer.from(type, 'ascii')
  return Buffer.concat([u32(data.length), ty, data, u32(crc32(Buffer.concat([ty, data])))])
}

function encodePNG(w, h, rgba) {
  const sig  = Buffer.from([137,80,78,71,13,10,26,10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6  // bit depth 8, RGBA
  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = y * (1 + w * 4) + 1 + x * 4
      raw[d] = rgba[s]; raw[d+1] = rgba[s+1]; raw[d+2] = rgba[s+2]; raw[d+3] = rgba[s+3]
    }
  }
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ─── ICO-Datei (enthält PNG direkt, Windows Vista+) ─────────────────────────

function createIco(pngBuffer) {
  const hdr = Buffer.alloc(6)
  hdr.writeUInt16LE(0, 0); hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry.writeUInt8(0, 0); entry.writeUInt8(0, 1)       // 0 = 256px
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(pngBuffer.length, 8)
  entry.writeUInt32LE(22, 12)  // offset = 6 + 16
  return Buffer.concat([hdr, entry, pngBuffer])
}

// ─── Pixel-Renderer ──────────────────────────────────────────────────────────

const W = 1024  // interne Auflösung (2× Supersampling → output 512)

function mkBuf() { return new Uint8Array(W * W * 4) }

/** Alpha-Compositing: source over dest */
function blendPixel(buf, x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= W) return
  const i = (y * W + x) * 4
  const sA = a / 255, dA = buf[i + 3] / 255
  const oA = sA + dA * (1 - sA)
  if (oA < 0.001) return
  buf[i]   = Math.round((r * sA + buf[i]   * dA * (1 - sA)) / oA)
  buf[i+1] = Math.round((g * sA + buf[i+1] * dA * (1 - sA)) / oA)
  buf[i+2] = Math.round((b * sA + buf[i+2] * dA * (1 - sA)) / oA)
  buf[i+3] = Math.round(oA * 255)
}

/**
 * Gefülltes Rounded-Rect mit subpixel-glatter Kante (1px feathering).
 * color = [r, g, b, a]
 */
function fillRR(buf, x0, y0, w, h, r, color, alphaScale = 1) {
  const [cr, cg, cb, ca] = color
  const x1 = x0 + w - 1, y1 = y0 + h - 1
  const xL = x0 + r, xR = x1 - r
  const yT = y0 + r, yB = y1 - r
  for (let y = Math.max(0, y0 - 1); y <= Math.min(W - 1, y1 + 1); y++) {
    for (let x = Math.max(0, x0 - 1); x <= Math.min(W - 1, x1 + 1); x++) {
      // Nächster Punkt im Inneren (für Ecken)
      const nx = Math.max(xL, Math.min(xR, x + 0.5))
      const ny = Math.max(yT, Math.min(yB, y + 0.5))
      const dist = Math.hypot(x + 0.5 - nx, y + 0.5 - ny)
      const alpha = Math.max(0, Math.min(1, r - dist + 0.5))
      if (alpha > 0) blendPixel(buf, x, y, cr, cg, cb, Math.round(ca * alpha * alphaScale))
    }
  }
}

/** Kreis (gefüllt, subpixel-glatt) */
function fillCircle(buf, cx, cy, r, color) {
  const [cr, cg, cb, ca] = color
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      const alpha = Math.max(0, Math.min(1, r - dist + 0.5))
      if (alpha > 0) blendPixel(buf, x, y, cr, cg, cb, Math.round(ca * alpha))
    }
  }
}

// ─── Design-Parameter (skaliert auf 1024) ───────────────────────────────────
// Alle Werte = Designwert × 2

const S = 2  // Scale-Faktor

const CARD_R = 78 * S

// Button-Grid
const BTN   = 60 * S   // Buttongröße
const GAP   = 13 * S   // Abstand zwischen Buttons
const BTN_R = 11 * S   // border-radius
const HL    = 15 * S   // Highlight-Höhe oben
const GX    = [44, 117, 190].map(v => v * S)   // X pro Spalte
const GY    = [80, 153, 226].map(v => v * S)   // Y pro Reihe

// Meter-Bars
const MX      = [288, 360, 432].map(v => v * S)
const MW      = 50  * S   // Bar-Breite
const MR      = 9   * S   // Bar-Radius
const TRACK_T = 80  * S   // Track-Top
const TRACK_B = 390 * S   // Track-Bottom
const TRACK_H = TRACK_B - TRACK_T

const FILL_PCT = [0.85, 0.55, 0.30]   // Füllstand pro Bar
const BAR_T = FILL_PCT.map(p => Math.round(TRACK_B - TRACK_H * p))

// Status-Dots
const DOT_Y  = 415 * S
const DOT_R  = 17  * S
const DOT_CX = [88, 132, 176].map(v => v * S)

// ─── Farb-Palette ────────────────────────────────────────────────────────────

const C = {
  // Hintergrund-Gradient
  bgTop: [33, 150, 243],   // #2196F3
  bgBot: [21, 101, 192],   // #1565C0

  // 9 Button-Farben (Zeile 0, 1, 2)
  btns: [
    [239, 83,  80,  255],  // #EF5350  Rot
    [255,152,   0,  255],  // #FF9800  Orange
    [253,216,  53,  255],  // #FDD835  Gelb
    [ 76,175,  80,  255],  // #4CAF50  Grün
    [  3,169, 244,  255],  // #03A9F4  Cyan
    [156, 39, 176,  255],  // #9C27B0  Lila
    [255,255, 255,  230],  // Weiß (leicht transparent)
    [233, 30,  99,  255],  // #E91E63  Pink
    [  0,150, 136,  255],  // #009688  Teal
  ],

  // Meter-Farben (3 Bars)
  bars: [
    [ 33,208,122, 255],   // Grün  #21d07a
    [ 74,158,255, 255],   // Blau  #4a9eff
    [255,138, 61, 255],   // Orange #ff8a3d
  ],

  // Status-Dots
  dots: [
    [239, 83,  80, 255],  // Rot
    [ 76,175,  80, 255],  // Grün
    [255,152,   0, 255],  // Orange
  ],

  shadow:    [0, 0, 0, 46],    // Diagonaler Schatten ~18% opacity
  trackBg:   [0, 0, 0, 72],    // Track-Hintergrund ~28%
  highlight: [255, 255, 255, 46],  // Button-Highlight ~18%
  peakMark:  [255, 255, 255, 225], // Peak-Marker
  barShine:  [255, 255, 255, 56],  // Bar-Glanz
}

// ─── Render ──────────────────────────────────────────────────────────────────

function render() {
  const buf = mkBuf()

  // ── 1. Hintergrund: Blauer Gradient + Card-Clip ──────────────────────────
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      // Ist der Pixel innerhalb des Rounded-Rect?
      const nx = Math.max(CARD_R, Math.min(W - CARD_R, x + 0.5))
      const ny = Math.max(CARD_R, Math.min(W - CARD_R, y + 0.5))
      const dist = Math.hypot(x + 0.5 - nx, y + 0.5 - ny)
      const alpha = Math.max(0, Math.min(1, CARD_R - dist + 0.5))
      if (alpha < 0.001) continue

      // Gradient
      const t = (x / W * 0.5 + y / W * 0.5)
      const r = Math.round(C.bgTop[0] + (C.bgBot[0] - C.bgTop[0]) * t)
      const g = Math.round(C.bgTop[1] + (C.bgBot[1] - C.bgTop[1]) * t)
      const b = Math.round(C.bgTop[2] + (C.bgBot[2] - C.bgTop[2]) * t)
      blendPixel(buf, x, y, r, g, b, Math.round(255 * alpha))
    }
  }

  // ── 2. Diagonaler Schatten (Dreieck: (390,0)→(1024,0)→(1024,640)) ───────
  // Linie von (390,0) nach (1024,640): y = (x-390)*(640/634)
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      if (buf[(y * W + x) * 4 + 3] === 0) continue  // außerhalb Card
      if (x <= 390) continue
      const threshold = (x - 390) * (640 / 634)
      if (y < threshold) {
        blendPixel(buf, x, y, 0, 0, 0, C.shadow[3])
      }
    }
  }

  // ── 3. Oberer Schimmer (Material-Depth) ──────────────────────────────────
  for (let y = 0; y < W * 0.45; y++) {
    const alpha = Math.round(46 * (1 - y / (W * 0.45)))
    for (let x = 0; x < W; x++) {
      if (buf[(y * W + x) * 4 + 3] === 0) continue
      blendPixel(buf, x, y, 255, 255, 255, alpha)
    }
  }

  // ── 4. Button-Grid (3×3) ─────────────────────────────────────────────────
  let bi = 0
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = GX[col], y = GY[row]
      const color = C.btns[bi++]

      // Button-Body
      fillRR(buf, x, y, BTN, BTN, BTN_R, color)

      // Highlight-Streifen oben
      fillRR(buf, x, y, BTN, HL, BTN_R, C.highlight)
    }
  }

  // ── 5. Meter-Bars (3 vertikal) ───────────────────────────────────────────
  for (let i = 0; i < 3; i++) {
    const x = MX[i]
    const barTop = BAR_T[i]
    const barH   = TRACK_B - barTop
    const color  = C.bars[i]

    // Track (dunkler Hintergrund)
    fillRR(buf, x, TRACK_T, MW, TRACK_H, MR, C.trackBg)

    // Bar-Füllung (Gradient: heller oben, dunkler unten)
    for (let y = barTop; y < TRACK_B; y++) {
      const t   = (y - barTop) / barH  // 0=oben, 1=unten
      const fac = 1.25 - t * 0.5       // 1.25 → 0.75 (heller oben)
      const r   = Math.min(255, Math.round(color[0] * fac))
      const g   = Math.min(255, Math.round(color[1] * fac))
      const b   = Math.min(255, Math.round(color[2] * fac))
      // Breite: Rand-Antialiasing über fillRR kostet Zeit → direkte Zeile
      for (let dx = 0; dx < MW; dx++) {
        blendPixel(buf, x + dx, y, r, g, b, color[3])
      }
    }

    // Bar mit korrektem Rounded-Rect clipping (überschreibt oben)
    // → Statt komplexem Clipping: fillRR mit voller Höhe, leicht transparent zum Rand hin
    // Rounded-Cap oben
    fillRR(buf, x, barTop, MW, MR * 2, MR, color)
    // Rounded-Cap unten
    fillRR(buf, x, TRACK_B - MR * 2, MW, MR * 2, MR, color)

    // Peak-Marker (weißer Strich 4px über Bar-Top)
    const pmY = barTop - 8 * S
    fillRR(buf, x, pmY, MW, 4 * S, 2 * S, C.peakMark)

    // Bar-Glanz (obere 14px heller)
    fillRR(buf, x, barTop, MW, 14 * S, MR, C.barShine)
  }

  // ── 6. Status-Dots (unten links) ─────────────────────────────────────────
  for (let i = 0; i < 3; i++) {
    fillCircle(buf, DOT_CX[i], DOT_Y, DOT_R, C.dots[i])
  }

  return buf
}

// ─── Downsample 1024→N (Box-Filter) ─────────────────────────────────────────

function downsample(buf, outSize) {
  const factor = W / outSize
  const out    = new Uint8Array(outSize * outSize * 4)
  for (let y = 0; y < outSize; y++) {
    for (let x = 0; x < outSize; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const i = ((y * factor + dy) * W + (x * factor + dx)) * 4
          r += buf[i]; g += buf[i+1]; b += buf[i+2]; a += buf[i+3]; n++
        }
      }
      const i2 = (y * outSize + x) * 4
      out[i2]   = Math.round(r / n)
      out[i2+1] = Math.round(g / n)
      out[i2+2] = Math.round(b / n)
      out[i2+3] = Math.round(a / n)
    }
  }
  return out
}

// ─── Ausgabe ─────────────────────────────────────────────────────────────────

console.log('Rendering icon (1024×1024 intern) …')
const buf1024 = render()

const buf512 = downsample(buf1024, 512)
const png512 = encodePNG(512, 512, buf512)
fs.writeFileSync(path.join(__dirname, 'icon-512.png'), png512)
console.log('✓ icon-512.png (512×512)')

const buf256 = downsample(buf1024, 256)
const png256 = encodePNG(256, 256, buf256)
fs.writeFileSync(path.join(__dirname, 'icon-256.png'), png256)
console.log('✓ icon-256.png (256×256)')

const ico = createIco(png256)
fs.writeFileSync(path.join(__dirname, 'icon.ico'), ico)
console.log('✓ icon.ico (ICO mit 256px PNG)')

console.log('\nDone.')
console.log('  Für macOS .icns: icon-512.png mit iconutil oder cloudconvert.com konvertieren')

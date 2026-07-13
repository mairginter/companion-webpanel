/**
 * bitmapDims.ts
 *
 * Leitet aus der Element-Geometrie (w×h in Canvas-px) die anzufordernde
 * Bitmap-Auflösung ab — inkl. Non-square-Support ab Companion 5.0 (STYLE-Param).
 *
 * Design (siehe memory/plan-2026-07-13-companion-5-adoption.md, Phase C):
 *  - Aspect-Ratio wird auf feste Stufen quantisiert, damit Resize-Drags nicht
 *    bei jedem gespeicherten Pixel eine neue Subscription auslösen.
 *  - `base` (render.bitmapSize: 72/100/144/200) ist immer die LANGE Seite.
 *  - Die kurze Seite wird auf gerade Zahlen gerundet (saubere Encoder-Dimensionen).
 *  - Nicht persistiert — rein abgeleitet, daher kein Settings-Schema-Bump.
 */

// Erlaubte Seitenverhältnisse (w/h): Portrait 1:2 … Landscape 2:1.
// Auswahl per log-Distanz — 1.3 liegt z.B. näher an 4:3 (1.333) als an 1:1.
const ASPECT_STEPS = [1 / 2, 9 / 16, 3 / 4, 1, 4 / 3, 16 / 9, 2]

// Extremere Elemente (breite Statuszeilen etc.) werden auf die äußerste Stufe geklemmt
const RATIO_MIN = 1 / 3
const RATIO_MAX = 3

/** Rundet auf die nächste gerade Zahl (min. 2). */
function roundEven(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2)
}

/**
 * Quantisiert die Element-Geometrie auf {w,h} für ADD-SUB.
 * Quadrat-Passthrough: Stufe 1:1 liefert exakt {base, base} (heutiges Verhalten).
 */
export function deriveBitmapDims(elW: number, elH: number, base: number): { w: number; h: number } {
  if (!Number.isFinite(elW) || !Number.isFinite(elH) || elW <= 0 || elH <= 0) {
    return { w: base, h: base }
  }

  const ratio = Math.min(RATIO_MAX, Math.max(RATIO_MIN, elW / elH))

  // Nächste Stufe per log-Distanz (symmetrisch für Portrait/Landscape)
  let step = 1
  let bestDist = Infinity
  for (const s of ASPECT_STEPS) {
    const dist = Math.abs(Math.log(ratio) - Math.log(s))
    if (dist < bestDist) { bestDist = dist; step = s }
  }

  if (step === 1) return { w: base, h: base }
  if (step > 1) return { w: base, h: roundEven(base / step) }   // Landscape: Breite = lange Seite
  return { w: roundEven(base * step), h: base }                  // Portrait: Höhe = lange Seite
}

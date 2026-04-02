/**
 * geometry.ts — Reine Geometrie-Hilfsfunktionen für Edit-Mode.
 * Keine React-Abhängigkeiten — vollständig testbar mit Vitest.
 */

export type HandleId = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br'

export interface Rect { x: number; y: number; w: number; h: number }

/** Stellt sicher dass value >= min */
export function clampMin(value: number, min: number): number {
  return Math.max(value, min)
}

/**
 * Berechnet neue Geometrie nach einem Resize-Delta.
 * Respektiert minSize: wenn Breite/Höhe unter minSize fällt,
 * wird die Position so korrigiert dass das Element nicht "wandert".
 */
export function applyResizeDelta(
  start: Rect,
  handle: HandleId,
  dx: number,
  dy: number,
  minSize: number,
): Rect {
  let { x, y, w, h } = start

  // Links-Kante (tl, ml, bl): x ändert sich, w ändert sich gegensätzlich
  if (handle === 'tl' || handle === 'ml' || handle === 'bl') {
    const newW = clampMin(w - dx, minSize)
    x = x + w - newW  // x folgt der rechten Kante wenn Minimum erreicht
    w = newW
  }
  // Rechts-Kante (tr, mr, br): nur w ändert sich
  if (handle === 'tr' || handle === 'mr' || handle === 'br') {
    w = clampMin(w + dx, minSize)
  }
  // Oben-Kante (tl, tc, tr): y ändert sich, h ändert sich gegensätzlich
  if (handle === 'tl' || handle === 'tc' || handle === 'tr') {
    const newH = clampMin(h - dy, minSize)
    y = y + h - newH
    h = newH
  }
  // Unten-Kante (bl, bc, br): nur h ändert sich
  if (handle === 'bl' || handle === 'bc' || handle === 'br') {
    h = clampMin(h + dy, minSize)
  }

  return { x, y, w, h }
}

/** Prüft ob zwei Rechtecke sich überlappen (exklusiv — berühren zählt nicht) */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  )
}

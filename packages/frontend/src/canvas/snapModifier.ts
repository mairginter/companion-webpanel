/**
 * snapModifier.ts — Magnetischer Grid-Snap für @dnd-kit.
 *
 * magneticSnap(): reine Funktion, getestet via Vitest.
 * createMagneticSnapModifier(): @dnd-kit Modifier-Factory für DndContext.
 */
import type { Modifier } from '@dnd-kit/core'

/**
 * Magnetischer Snap: Element bewegt sich frei, "klebt" an Grid-Linien.
 * Threshold: wenn Position innerhalb 'threshold' px einer Grid-Linie → snap.
 */
export function magneticSnap(value: number, gridSize: number, threshold: number): number {
  // Modulo mit korrektem Ergebnis für negative Zahlen
  const rest = ((value % gridSize) + gridSize) % gridSize
  if (rest < threshold) return value - rest
  if (rest > gridSize - threshold) return value + (gridSize - rest)
  return value
}

/**
 * @dnd-kit Modifier der magnetischen Snap auf ein Grid anwendet.
 * Liest die Start-Position aus active.data.current.x / .y.
 */
export function createMagneticSnapModifier(gridSize: number, threshold = 8): Modifier {
  return ({ transform, active }) => {
    const data = active?.data?.current as { x?: number; y?: number } | undefined
    const startX = data?.x ?? 0
    const startY = data?.y ?? 0

    const absX = startX + transform.x
    const absY = startY + transform.y

    return {
      ...transform,
      x: magneticSnap(absX, gridSize, threshold) - startX,
      y: magneticSnap(absY, gridSize, threshold) - startY,
    }
  }
}

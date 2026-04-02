/**
 * DragDeltaContext.tsx
 *
 * React Context der den aktuellen Drag-Delta hält während eine @dnd-kit Drag-Operation läuft.
 * Alle selektierten Elemente lesen diesen Context und wenden translate(dx, dy) an —
 * so bewegen sich Gruppen synchron ohne Store-Updates per Pointer-Move.
 */
import { createContext, useContext } from 'react'

export interface DragDelta {
  dx: number
  dy: number
}

export const DragDeltaContext = createContext<DragDelta | null>(null)

export function useDragDelta(): DragDelta | null {
  return useContext(DragDeltaContext)
}

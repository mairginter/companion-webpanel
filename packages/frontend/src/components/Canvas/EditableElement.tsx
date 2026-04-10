/**
 * EditableElement.tsx
 *
 * Wrapper für alle Canvas-Elemente im Edit-Mode.
 * Übernimmt absolute Positionierung. Verwendet @dnd-kit useDraggable.
 * Liest DragDeltaContext für Gruppen-Drag (alle selektierten folgen synchron).
 * Zeigt Selektion-Ring (orange) und ResizeHandles bei Einzel-Selektion.
 */
import React, { useCallback } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { AnyElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { useDragDelta } from '../../context/DragDeltaContext'
import { ResizeHandles } from '../Elements/ResizeHandles'

interface Props {
  element: AnyElement
  panelId: string
  children: React.ReactNode
}

export function EditableElement({ element, panelId, children }: Props) {
  const selectedIds = useAppStore((s) => s.selectedIds)
  const selectElement = useAppStore((s) => s.selectElement)
  const isSelected = selectedIds.has(element.id)
  const isOnlySelected = isSelected && selectedIds.size === 1

  const dragDelta = useDragDelta()
  const zoom = useAppStore((s) => s.getActivePanel()?.zoom ?? 1)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: element.id,
    data: { x: element.x, y: element.y, elementId: element.id, panelId },
    disabled: !!element.locked,
  })

  // Dragged element nutzt @dnd-kit transform.
  // Andere selektierte folgen via DragDeltaContext (Gruppen-Drag).
  // Deltas sind screen-space → durch zoom dividieren für canvas-space Preview.
  const activeTransform = isDragging
    ? transform
    : isSelected && dragDelta
    ? { x: dragDelta.dx / zoom, y: dragDelta.dy / zoom, scaleX: 1, scaleY: 1 }
    : null

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      selectElement(element.id, e.shiftKey)
    },
    [element.id, selectElement],
  )

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.w,
        height: element.h,
        zIndex: element.z + (isDragging ? 1000 : 0),
        transform: activeTransform ? CSS.Transform.toString(activeTransform) : undefined,
        cursor: element.locked ? 'default' : isDragging ? 'grabbing' : 'grab',
        outline: isSelected ? '2px solid #ff8a3d' : undefined,
        outlineOffset: isSelected ? '2px' : undefined,
        userSelect: 'none',
        touchAction: 'none',
      }}
      onClick={handleClick}
      {...listeners}
      {...attributes}
    >
      {children}
      {isOnlySelected && !element.locked && (
        <ResizeHandles element={element} panelId={panelId} />
      )}
    </div>
  )
}

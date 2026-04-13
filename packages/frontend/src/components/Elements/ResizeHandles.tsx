/**
 * ResizeHandles.tsx
 *
 * 8 orange Resize-Handles (14x14px) für selektierte Elemente im Edit-Mode.
 * Custom Pointer Events mit setPointerCapture für präzises Tracking über Canvas-Rand hinaus.
 * Respektiert MIN_SIZE pro Element-Typ (companionButton: 72px, shape/label: 8px).
 */
import React, { useRef, useCallback } from 'react'
import { AnyElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { applyResizeDelta, snapResizeGeo, HandleId } from '../../utils/geometry'

const MIN_SIZE: Record<string, number> = {
  companionButton: 72,
  shape: 8,
  label: 8,
  meter: 8,
}

interface ResizeState {
  handleId: HandleId
  startX: number
  startY: number
  startGeometry: { x: number; y: number; w: number; h: number }
  snapshotSaved: boolean
}

interface Props {
  element: AnyElement
  panelId: string
}

const HANDLES: Array<{ id: HandleId; style: React.CSSProperties }> = [
  { id: 'tl', style: { top: -8, left: -8, cursor: 'nw-resize' } },
  { id: 'tc', style: { top: -8, left: 'calc(50% - 7px)', cursor: 'n-resize' } },
  { id: 'tr', style: { top: -8, right: -8, cursor: 'ne-resize' } },
  { id: 'ml', style: { top: 'calc(50% - 7px)', left: -8, cursor: 'w-resize' } },
  { id: 'mr', style: { top: 'calc(50% - 7px)', right: -8, cursor: 'e-resize' } },
  { id: 'bl', style: { bottom: -8, left: -8, cursor: 'sw-resize' } },
  { id: 'bc', style: { bottom: -8, left: 'calc(50% - 7px)', cursor: 's-resize' } },
  { id: 'br', style: { bottom: -8, right: -8, cursor: 'se-resize' } },
]

export function ResizeHandles({ element, panelId }: Props) {
  const updateElementGeometry = useAppStore((s) => s.updateElementGeometry)
  const saveUndoSnapshot = useAppStore((s) => s.saveUndoSnapshot)
  const resizeState = useRef<ResizeState | null>(null)

  // Visuelles Sofort-Update während Resize per DOM-Mutation (kein Store-Update per Frame)
  const applyVisual = useCallback((geo: { x: number; y: number; w: number; h: number }) => {
    const handle = document.querySelector(`[data-handle-for="${element.id}"]`) as HTMLElement | null
    if (!handle) return
    const wrapper = handle.parentElement as HTMLElement | null
    if (!wrapper) return
    wrapper.style.left = `${geo.x}px`
    wrapper.style.top = `${geo.y}px`
    wrapper.style.width = `${geo.w}px`
    wrapper.style.height = `${geo.h}px`
  }, [element.id])

  const onPointerDown = useCallback((e: React.PointerEvent, handleId: HandleId) => {
    e.stopPropagation()
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    resizeState.current = {
      handleId,
      startX: e.clientX,
      startY: e.clientY,
      startGeometry: { x: element.x, y: element.y, w: element.w, h: element.h },
      snapshotSaved: false,
    }
  }, [element])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const state = resizeState.current
    if (!state || e.buttons === 0) return
    if (!state.snapshotSaved) {
      saveUndoSnapshot([element.id])
      state.snapshotSaved = true
    }
    const panel = useAppStore.getState().getActivePanel()
    const currentZoom = panel?.zoom ?? 1
    const dx = (e.clientX - state.startX) / currentZoom
    const dy = (e.clientY - state.startY) / currentZoom
    const minSize = MIN_SIZE[element.type] ?? 8
    let newGeo = applyResizeDelta(state.startGeometry, state.handleId, dx, dy, minSize)
    if (panel?.grid?.snap ?? true) {
      newGeo = snapResizeGeo(newGeo, state.handleId, (panel?.grid?.size ?? 40) / 4, minSize)
    }
    applyVisual(newGeo)
  }, [element, saveUndoSnapshot, applyVisual])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const state = resizeState.current
    if (!state) return
    const panel = useAppStore.getState().getActivePanel()
    const currentZoom = panel?.zoom ?? 1
    const dx = (e.clientX - state.startX) / currentZoom
    const dy = (e.clientY - state.startY) / currentZoom
    const minSize = MIN_SIZE[element.type] ?? 8
    let newGeo = applyResizeDelta(state.startGeometry, state.handleId, dx, dy, minSize)
    if (panel?.grid?.snap ?? true) {
      newGeo = snapResizeGeo(newGeo, state.handleId, (panel?.grid?.size ?? 40) / 4, minSize)
    }
    updateElementGeometry(panelId, element.id, newGeo)
    resizeState.current = null
  }, [element, panelId, updateElementGeometry])

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    width: 14,
    height: 14,
    background: '#ff8a3d',
    border: '2px solid #0a0e14',
    borderRadius: 3,
    zIndex: 100,
    touchAction: 'none',
  }

  return (
    <div data-handle-for={element.id} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {HANDLES.map(({ id, style }) => (
        <div
          key={id}
          style={{ ...handleStyle, ...style, pointerEvents: 'auto' }}
          onPointerDown={(e) => onPointerDown(e, id)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      ))}
    </div>
  )
}

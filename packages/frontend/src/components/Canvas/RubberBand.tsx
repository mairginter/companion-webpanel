/**
 * RubberBand.tsx
 *
 * SVG-Overlay für Rubber-Band-Selektion im Edit-Mode.
 * Startet auf Canvas-Hintergrund (nicht auf Elementen).
 * Shift+Drag: zur bestehenden Selektion hinzufügen.
 */
import React, { useState, useCallback, useRef } from 'react'
import { AnyElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { rectsOverlap } from '../../utils/geometry'

interface RubberBandRect {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface Props {
  elements: AnyElement[]
  panelId: string
  containerRef: React.RefObject<HTMLDivElement>
}

export function RubberBand({ elements, containerRef }: Props) {
  const [rect, setRect] = useState<RubberBandRect | null>(null)
  const shiftHeld = useRef(false)
  const selectElements = useAppStore((s) => s.selectElements)
  const selectedIds = useAppStore((s) => s.selectedIds)
  const clearSelection = useAppStore((s) => s.clearSelection)

  const getCanvasPos = useCallback((e: React.PointerEvent) => {
    const container = containerRef.current
    if (!container) return { x: 0, y: 0 }
    const bounds = container.getBoundingClientRect()
    return { x: e.clientX - bounds.left, y: e.clientY - bounds.top }
  }, [containerRef])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const pos = getCanvasPos(e)
    shiftHeld.current = e.shiftKey
    if (!e.shiftKey) clearSelection()
    setRect({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y })
  }, [getCanvasPos, clearSelection])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!rect) return
    const pos = getCanvasPos(e)
    setRect((r) => r ? { ...r, currentX: pos.x, currentY: pos.y } : null)
  }, [rect, getCanvasPos])

  const onPointerUp = useCallback((_e: React.PointerEvent) => {
    if (!rect) return
    const rb = normalizeRect(rect)
    const hit = elements
      .filter((el) => rectsOverlap(rb, { x: el.x, y: el.y, w: el.w, h: el.h }))
      .map((el) => el.id)
    if (shiftHeld.current) {
      selectElements([...selectedIds, ...hit])
    } else {
      selectElements(hit)
    }
    setRect(null)
  }, [rect, elements, selectElements, selectedIds])

  const normalized = rect ? normalizeRect(rect) : null

  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: rect ? 500 : -1 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {normalized && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <rect
            x={normalized.x} y={normalized.y}
            width={normalized.w} height={normalized.h}
            fill="rgba(74,158,255,0.08)"
            stroke="#4a9eff"
            strokeWidth={1}
          />
        </svg>
      )}
    </div>
  )
}

function normalizeRect(r: RubberBandRect) {
  return {
    x: Math.min(r.startX, r.currentX),
    y: Math.min(r.startY, r.currentY),
    w: Math.abs(r.currentX - r.startX),
    h: Math.abs(r.currentY - r.startY),
  }
}

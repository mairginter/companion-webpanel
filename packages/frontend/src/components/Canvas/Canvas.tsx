/**
 * Canvas.tsx
 *
 * Haupt-Render-Fläche des Webpanels.
 * View-Mode: Elemente rendern sich selbst absolut, CompanionButtons lösen KEY-PRESS aus.
 * Edit-Mode: Elemente werden in EditableElement gewrapped.
 *   - DndContext mit magnetischem Snap-Modifier
 *   - DragDeltaContext für Gruppen-Drag
 *   - RubberBand für Mehrfach-Selektion
 */
import { useRef, useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  DragMoveEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { AnyElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { DragDeltaContext } from '../../context/DragDeltaContext'
import { createMagneticSnapModifier } from '../../canvas/snapModifier'
import { CompanionButtonElement } from '../Elements/CompanionButtonElement'
import { ShapeElement } from '../Elements/ShapeElement'
import { LabelElement } from '../Elements/LabelElement'
import { EditableElement } from './EditableElement'
import { RubberBand } from './RubberBand'
import { PropertiesPanel } from '../PropertiesPanel/PropertiesPanel'

interface CanvasProps {
  sendPress: (hostId: string, page: number, row: number, col: number, pressed: boolean) => void
}

const DOT_GRID = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='0' cy='0' r='1.2' fill='rgba(255,255,255,0.06)'/%3E%3C/svg%3E")`

export function Canvas({ sendPress }: CanvasProps) {
  const mode = useAppStore((s) => s.mode)
  const panel = useAppStore((s) => s.getActivePanel())
  const clearSelection = useAppStore((s) => s.clearSelection)
  const selectedIds = useAppStore((s) => s.selectedIds)
  const updateElementGeometry = useAppStore((s) => s.updateElementGeometry)
  const saveUndoSnapshot = useAppStore((s) => s.saveUndoSnapshot)

  const containerRef = useRef<HTMLDivElement>(null)
  const [dragDelta, setDragDelta] = useState<{ dx: number; dy: number } | null>(null)

  const gridSize = panel?.grid?.size ?? 40
  const snapEnabled = panel?.grid?.snap ?? true

  const snapModifier = useMemo(
    () => (snapEnabled ? createMagneticSnapModifier(gridSize) : undefined),
    [snapEnabled, gridSize],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const handleDragStart = useCallback(() => {
    saveUndoSnapshot([...selectedIds])
  }, [selectedIds, saveUndoSnapshot])

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    setDragDelta({ dx: event.delta.x, dy: event.delta.y })
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { delta } = event
      const panelId = (event.active.data.current as { panelId: string }).panelId
      const currentPanel = useAppStore.getState().getActivePanel()
      if (!currentPanel) return
      for (const id of useAppStore.getState().selectedIds) {
        const el = currentPanel.elements.find((e) => e.id === id)
        if (!el) continue
        updateElementGeometry(panelId, id, {
          x: Math.round(el.x + delta.x),
          y: Math.round(el.y + delta.y),
        })
      }
      setDragDelta(null)
    },
    [updateElementGeometry],
  )

  const canvasBackground = panel?.canvas?.background ?? '#0f141a'
  const canvasWidth = panel?.canvas?.width
  const canvasHeight = panel?.canvas?.height

  // Äußerer Container: position:relative — PropertiesPanel als absolute Overlay-Sibling
  const content = (
    <div style={{ flex: 1, overflow: 'hidden', background: '#0a0e14', position: 'relative' }}>
      {/* Scrollbarer Canvas-Bereich */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: canvasWidth ?? '100%',
            height: canvasHeight ?? '100%',
            minWidth: '100%',
            minHeight: '100%',
            background: canvasBackground,
            backgroundImage: DOT_GRID,
          }}
          onClick={mode === 'edit' ? () => clearSelection() : undefined}
        >
          {!panel ? (
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center', color: '#4a5568', fontSize: 13, pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
              <div style={{ fontWeight: 600, color: '#8896aa', marginBottom: 4 }}>Kein Panel geladen</div>
              <div style={{ fontSize: 12 }}>Backend verbinden und Settings konfigurieren</div>
            </div>
          ) : (
            renderElements(panel.elements, panel.id, mode, sendPress)
          )}

          {mode === 'edit' && panel && (
            <RubberBand elements={panel.elements} panelId={panel.id} containerRef={containerRef} />
          )}
        </div>
      </div>
      {/* Properties-Panel als Overlay im Edit-Mode */}
      {mode === 'edit' && <PropertiesPanel />}
    </div>
  )

  if (mode !== 'edit') return content

  return (
    <DragDeltaContext.Provider value={dragDelta}>
      <DndContext
        sensors={sensors}
        modifiers={snapModifier ? [snapModifier] : []}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragDelta(null)}
      >
        {content}
      </DndContext>
    </DragDeltaContext.Provider>
  )
}

function renderElements(
  elements: AnyElement[],
  panelId: string,
  mode: 'view' | 'edit',
  sendPress: CanvasProps['sendPress'],
) {
  const sorted = [...elements].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
  return sorted.map((el) => {
    const inner = renderInner(el, mode, sendPress)
    if (!inner) return null
    if (mode === 'edit') {
      return (
        <EditableElement key={el.id} element={el} panelId={panelId}>
          {inner}
        </EditableElement>
      )
    }
    return <span key={el.id}>{inner}</span>
  })
}

function renderInner(el: AnyElement, mode: 'view' | 'edit', sendPress: CanvasProps['sendPress']) {
  const isContained = mode === 'edit'
  switch (el.type) {
    case 'companionButton':
      return <CompanionButtonElement element={el} mode={mode} sendPress={sendPress} isContained={isContained} />
    case 'shape':
      return <ShapeElement element={el} isContained={isContained} />
    case 'label':
      return <LabelElement element={el} isContained={isContained} />
    case 'meter':
      return null // TODO Phase 3.4
    default:
      return null
  }
}

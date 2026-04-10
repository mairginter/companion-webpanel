/**
 * Canvas.tsx
 *
 * Haupt-Render-Fläche des Webpanels.
 * View-Mode: Elemente rendern sich selbst absolut, CompanionButtons lösen KEY-PRESS aus.
 * Edit-Mode: Elemente werden in EditableElement gewrapped.
 *   - DndContext mit magnetischem Snap-Modifier
 *   - DragDeltaContext für Gruppen-Drag
 *   - LassoSelect für Freihand-Mehrfach-Selektion (ersetzt RubberBand)
 */
import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
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
import { getTextureCss, getTextureBackgroundSize } from '../../utils/textures'
import { DragDeltaContext } from '../../context/DragDeltaContext'
import { createMagneticSnapModifier } from '../../canvas/snapModifier'
import { CompanionButtonElement } from '../Elements/CompanionButtonElement'
import { ShapeElement } from '../Elements/ShapeElement'
import { LabelElement } from '../Elements/LabelElement'
import { ChannelStripElement } from '../Elements/ChannelStripElement'
import { EditableElement } from './EditableElement'
import { LassoSelect } from './LassoSelect'
import { Point, lassoHitsElement } from '../../utils/geometry'
import { PropertiesPanel } from '../PropertiesPanel/PropertiesPanel'
import { AddElementMenu } from '../AddElement/AddElementMenu'

interface CanvasProps {
  sendPress: (hostId: string, page: number, row: number, col: number, pressed: boolean) => void
  sendRotate: (hostId: string, page: number, row: number, col: number, direction: 1 | -1) => void
}

const DOT_GRID = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='0' cy='0' r='1.2' fill='rgba(255,255,255,0.06)'/%3E%3C/svg%3E")`

export function Canvas({ sendPress, sendRotate }: CanvasProps) {
  const mode = useAppStore((s) => s.mode)
  const panel = useAppStore((s) => s.getActivePanel())
  const clearSelection = useAppStore((s) => s.clearSelection)
  const selectedIds = useAppStore((s) => s.selectedIds)
  const selectElements = useAppStore((s) => s.selectElements)
  const updateElementGeometry = useAppStore((s) => s.updateElementGeometry)
  const saveUndoSnapshot = useAppStore((s) => s.saveUndoSnapshot)

  const setZoom = useAppStore((s) => s.setZoom)
  const zoom = panel?.zoom ?? 1
  const scrollWrapperRef = useRef<HTMLDivElement>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const [dragDelta, setDragDelta] = useState<{ dx: number; dy: number } | null>(null)
  const [lassoPoints, setLassoPoints] = useState<Point[]>([])
  const lassoPointsRef = useRef<Point[]>([])  // Ref für seiteneffektfreien Zugriff in PointerUp
  const isLassoing = useRef(false)
  const shiftLasso = useRef(false)
  const lassoDidMove = useRef(false)
  const [contextMenu, setContextMenu] = useState<{
    screenPos: { x: number; y: number }
    canvasPos: { x: number; y: number }
  } | null>(null)

  const gridSize = panel?.grid?.size ?? 40
  const snapEnabled = panel?.grid?.snap ?? true

  const snapModifier = useMemo(
    () => (snapEnabled ? createMagneticSnapModifier(gridSize) : undefined),
    [snapEnabled, gridSize],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  // Ctrl+Scroll → Zoom ±5%; passive:false nötig für preventDefault()
  useEffect(() => {
    const el = scrollWrapperRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.05 : -0.05
      const currentPanel = useAppStore.getState().getActivePanel()
      if (!currentPanel) return
      const newZoom = Math.max(0.2, Math.min(2.0, (currentPanel.zoom ?? 1) + delta))
      setZoom(currentPanel.id, newZoom)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [setZoom])

  // NEW — divides by zoom so Lasso/ContextMenu coords map back to canvas-space
  const getCanvasPos = useCallback(
    (e: React.PointerEvent): Point => {
      const container = containerRef.current
      if (!container) return { x: 0, y: 0 }
      const bounds = container.getBoundingClientRect()
      return {
        x: (e.clientX - bounds.left) / zoom,
        y: (e.clientY - bounds.top) / zoom,
      }
    },
    [zoom],
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

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'edit') return
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    const canvasPos = rect
      ? { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom }
      : { x: e.clientX, y: e.clientY }
    setContextMenu({ screenPos: { x: e.clientX, y: e.clientY }, canvasPos })
  }, [mode, zoom])

  const handleLassoPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'edit') return
    if (e.target !== e.currentTarget) return  // nur auf leerem Canvas
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    isLassoing.current = true
    lassoDidMove.current = false
    shiftLasso.current = e.shiftKey
    const initial = [getCanvasPos(e)]
    lassoPointsRef.current = initial
    setLassoPoints(initial)
  }, [mode, getCanvasPos])

  const handleLassoPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isLassoing.current) return
    const pos = getCanvasPos(e)
    const prev = lassoPointsRef.current
    if (prev.length > 0) {
      const last = prev[prev.length - 1]
      if (Math.hypot(pos.x - last.x, pos.y - last.y) < 4) return
    }
    lassoDidMove.current = true
    const next = [...prev, pos]
    lassoPointsRef.current = next   // synchron — vor pointerUp lesbar
    setLassoPoints(next)            // nur für SVG-Rendering
  }, [getCanvasPos])

  const handleLassoPointerUp = useCallback((_e: React.PointerEvent<HTMLDivElement>) => {
    if (!isLassoing.current) return
    isLassoing.current = false
    // lassoDidMove bleibt true bis zum nächsten pointerDown —
    // verhindert dass onClick danach clearSelection() aufruft
    const points = lassoPointsRef.current
    lassoPointsRef.current = []
    setLassoPoints([])
    if (points.length >= 3) {
      const currentPanel = useAppStore.getState().getActivePanel()
      if (currentPanel) {
        const hit = currentPanel.elements
          .filter((el) => !el.locked && lassoHitsElement(points, el))
          .map((el) => el.id)
        if (shiftLasso.current) {
          selectElements([...useAppStore.getState().selectedIds, ...hit])
        } else {
          selectElements(hit)
        }
      }
    }
  }, [selectElements])

  const canvasBackground = panel?.canvas?.background ?? '#0f141a'
  const canvasWidth = panel?.canvas?.width
  const canvasHeight = panel?.canvas?.height
  const textureCss = getTextureCss(panel?.canvas?.texture)
  const textureBgSize = getTextureBackgroundSize(panel?.canvas?.texture)

  // backgroundImage: Textur + Dot-Grid (Dot-Grid liegt oben)
  const backgroundImageLayers = [
    DOT_GRID,
    ...(textureCss !== 'none' ? [textureCss] : []),
  ].join(', ')

  // backgroundSize: DOT_GRID braucht kein explizites size (SVG hat eigene Größe),
  // aber Textur-Gradienten brauchen ggf. eine Kachel-Größe
  const backgroundSizeLayers = textureBgSize
    ? ['auto', textureBgSize].join(', ')
    : undefined

  // Äußerer Container: position:relative — PropertiesPanel als absolute Overlay-Sibling
  const content = (
    <div style={{ flex: 1, overflow: 'hidden', background: '#0a0e14', position: 'relative' }}>
      {/* Scrollbarer Canvas-Bereich */}
      <div ref={scrollWrapperRef} style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
        {/* Größen-Reserve: reserviert scroll-Platz entsprechend dem skalierten Canvas */}
        <div
          style={{
            width: canvasWidth ? canvasWidth * zoom : '100%',
            height: canvasHeight ? canvasHeight * zoom : '100%',
            minWidth: '100%',
            minHeight: '100%',
            flexShrink: 0,
          }}
        >
          {/* Scale-Root: CSS-Transform auf Canvas-Inhalt */}
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            <div
              ref={containerRef}
              style={{
                position: 'relative',
                width: canvasWidth ?? '100%',
                height: canvasHeight ?? '100%',
                minWidth: canvasWidth ? undefined : '100%',
                minHeight: canvasHeight ? undefined : '100%',
                background: canvasBackground,
                backgroundImage: backgroundImageLayers,
                ...(backgroundSizeLayers ? { backgroundSize: backgroundSizeLayers } : {}),
              }}
              onClick={mode === 'edit' ? () => { if (!lassoDidMove.current) clearSelection() } : undefined}
              onContextMenu={handleContextMenu}
              onPointerDown={handleLassoPointerDown}
              onPointerMove={handleLassoPointerMove}
              onPointerUp={handleLassoPointerUp}
              onPointerCancel={mode === 'edit' ? () => {
                isLassoing.current = false
                lassoDidMove.current = false
                lassoPointsRef.current = []
                setLassoPoints([])
              } : undefined}
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
                renderElements(panel.elements, panel.id, mode, sendPress, sendRotate)
              )}

              {mode === 'edit' && lassoPoints.length >= 2 && (
                <LassoSelect points={lassoPoints} />
              )}
            </div>
          </div>
        </div>
      </div>
      {/* AddElementMenu als Overlay im Edit-Mode (Rechtsklick) */}
      {mode === 'edit' && contextMenu && panel && (
        <AddElementMenu
          screenPos={contextMenu.screenPos}
          canvasPos={contextMenu.canvasPos}
          panelId={panel.id}
          onClose={() => setContextMenu(null)}
        />
      )}
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
  sendRotate: CanvasProps['sendRotate'],
) {
  const sorted = [...elements].sort((a, b) => {
    if (a.type === 'shape' && b.type !== 'shape') return -1
    if (a.type !== 'shape' && b.type === 'shape') return 1
    return (a.z ?? 0) - (b.z ?? 0)
  })
  return sorted.map((el) => {
    const inner = renderInner(el, mode, sendPress, sendRotate)
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

function renderInner(
  el: AnyElement,
  mode: 'view' | 'edit',
  sendPress: CanvasProps['sendPress'],
  sendRotate: CanvasProps['sendRotate'],
) {
  const isContained = mode === 'edit'
  switch (el.type) {
    case 'companionButton':
      return <CompanionButtonElement element={el} mode={mode} sendPress={sendPress} isContained={isContained} />
    case 'shape':
      return <ShapeElement element={el} isContained={isContained} />
    case 'label':
      return <LabelElement element={el} isContained={isContained} />
    case 'channelStrip':
      return <ChannelStripElement element={el} mode={mode} sendPress={sendPress} sendRotate={sendRotate} isContained={isContained} />
    case 'meter':
      return null // TODO Phase 3.4
    default:
      return null
  }
}

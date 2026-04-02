import { useRef } from 'react'
import { AnyElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { CompanionButtonElement } from '../Elements/CompanionButtonElement'
import { ShapeElement } from '../Elements/ShapeElement'
import { LabelElement } from '../Elements/LabelElement'

interface CanvasProps {
  sendPress: (hostId: string, page: number, row: number, col: number, pressed: boolean) => void
}

const DOT_GRID = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='0' cy='0' r='1.2' fill='rgba(255,255,255,0.06)'/%3E%3C/svg%3E")`

export function Canvas({ sendPress }: CanvasProps) {
  const mode = useAppStore((s) => s.mode)
  const panel = useAppStore((s) => s.getActivePanel())
  const containerRef = useRef<HTMLDivElement>(null)

  const canvasBackground = panel?.canvas?.background ?? '#0f141a'
  const canvasWidth = panel?.canvas?.width
  const canvasHeight = panel?.canvas?.height

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        background: '#0a0e14',
        position: 'relative',
      }}
    >
      {/* Scrollbarer Canvas-Bereich */}
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
      >
        {!panel ? (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#4a5568',
            fontSize: 13,
            pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
            <div style={{ fontWeight: 600, color: '#8896aa', marginBottom: 4 }}>
              Kein Panel geladen
            </div>
            <div style={{ fontSize: 12 }}>Backend verbinden und Settings konfigurieren</div>
          </div>
        ) : (
          renderElements(panel.elements, mode, sendPress)
        )}
      </div>
    </div>
  )
}

function renderElements(
  elements: AnyElement[],
  mode: 'view' | 'edit',
  sendPress: CanvasProps['sendPress'],
) {
  // Nach z-Index sortieren
  const sorted = [...elements].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))

  return sorted.map((el) => {
    if (el.locked && mode === 'edit') {
      // locked elements nicht draggable machen — einfach rendern
    }

    switch (el.type) {
      case 'companionButton':
        return (
          <CompanionButtonElement
            key={el.id}
            element={el}
            mode={mode}
            sendPress={sendPress}
          />
        )
      case 'shape':
        return <ShapeElement key={el.id} element={el} />
      case 'label':
        return <LabelElement key={el.id} element={el} />
      case 'meter':
        // TODO Phase 3.4
        return null
      default:
        return null
    }
  })
}

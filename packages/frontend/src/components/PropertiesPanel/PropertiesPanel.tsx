/**
 * PropertiesPanel.tsx
 *
 * Schwebendes Properties-Panel im Edit-Mode (position:absolute über Canvas).
 * Seite (links/rechts) und Collapsed-Zustand werden in localStorage gespeichert.
 *
 * Inhalt:
 * - Kein Element selektiert → CanvasSettings
 * - Ein Element selektiert → GeometryBlock + element-spezifische Props
 * - Mehrere Elemente selektiert → nur GeometryBlock (Multi-Edit)
 */
import React, { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { GeometryBlock } from './GeometryBlock'
import { CanvasSettings } from './CanvasSettings'
import { CompanionButtonProps } from './CompanionButtonProps'
import { ShapeProps } from './ShapeProps'
import { LabelProps } from './LabelProps'

const LS_SIDE = 'cwp:propsPanelSide'
const LS_OPEN = 'cwp:propsPanelOpen'

function loadSide(): 'left' | 'right' {
  return (localStorage.getItem(LS_SIDE) as 'left' | 'right') ?? 'right'
}
function loadOpen(): boolean {
  const v = localStorage.getItem(LS_OPEN)
  return v === null ? true : v === 'true'
}

export function PropertiesPanel() {
  const [side, setSide] = useState<'left' | 'right'>(loadSide)
  const [open, setOpen] = useState<boolean>(loadOpen)

  const panel = useAppStore((s) => s.getActivePanel())
  const selectedIds = useAppStore((s) => s.selectedIds)

  const flipSide = () => {
    const next = side === 'right' ? 'left' : 'right'
    setSide(next)
    localStorage.setItem(LS_SIDE, next)
  }
  const toggleOpen = () => {
    const next = !open
    setOpen(next)
    localStorage.setItem(LS_OPEN, String(next))
  }

  // Selektierte Elemente ermitteln
  const selectedElements = panel
    ? panel.elements.filter((el) => selectedIds.has(el.id))
    : []
  const singleEl = selectedElements.length === 1 ? selectedElements[0] : null

  const PANEL_W = 280
  // Touch-freundlich: min. 44px Hit-Area
  const collapseBtn: React.CSSProperties = {
    background: '#1a2030',
    border: '1px solid #2a3344',
    color: '#8896aa',
    borderRadius: 4,
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
    minWidth: 44,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  // Collapsed-Zustand: schmaler Tab am Rand
  if (!open) {
    const tabStyle: React.CSSProperties = {
      position: 'absolute',
      top: '50%',
      [side]: 0,
      transform: 'translateY(-50%)',
      background: '#1a2030',
      border: '1px solid #2a3344',
      borderRadius: side === 'right' ? '8px 0 0 8px' : '0 8px 8px 0',
      padding: '16px 8px',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      zIndex: 200,
      writingMode: 'vertical-lr',
      fontSize: 13,
      color: '#8896aa',
      userSelect: 'none',
      minWidth: 32,
    }
    return (
      <div style={tabStyle} onClick={toggleOpen} title="Properties öffnen">
        {'›'}
      </div>
    )
  }

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    [side]: 0,
    width: PANEL_W,
    background: 'rgba(18,24,33,0.97)',
    borderLeft: side === 'right' ? '1px solid #2a3344' : undefined,
    borderRight: side === 'left' ? '1px solid #2a3344' : undefined,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 200,
    backdropFilter: 'blur(4px)',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    borderBottom: '1px solid #2a3344',
    flexShrink: 0,
  }

  const titleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: '#8896aa',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  }

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  }

  // Inhalt bestimmen
  let specificContent: React.ReactNode = null
  if (selectedElements.length === 0 && panel) {
    specificContent = <CanvasSettings panel={panel} panelId={panel.id} />
  } else if (selectedElements.length >= 1) {
    specificContent = (
      <GeometryBlock elements={selectedElements} panelId={panel!.id} />
    )
    if (singleEl) {
      if (singleEl.type === 'companionButton') {
        specificContent = (
          <>
            {specificContent}
            <div style={{ borderTop: '1px solid #2a3344', paddingTop: 12 }}>
              <CompanionButtonProps element={singleEl} panelId={panel!.id} />
            </div>
          </>
        )
      } else if (singleEl.type === 'shape') {
        specificContent = (
          <>
            {specificContent}
            <div style={{ borderTop: '1px solid #2a3344', paddingTop: 12 }}>
              <ShapeProps element={singleEl} panelId={panel!.id} />
            </div>
          </>
        )
      } else if (singleEl.type === 'label') {
        specificContent = (
          <>
            {specificContent}
            <div style={{ borderTop: '1px solid #2a3344', paddingTop: 12 }}>
              <LabelProps element={singleEl} panelId={panel!.id} />
            </div>
          </>
        )
      }
    }
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>Properties</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={collapseBtn} onClick={flipSide} title="Seite wechseln">⇄</button>
          <button style={collapseBtn} onClick={toggleOpen} title="Einklappen">‹</button>
        </div>
      </div>
      <div style={contentStyle}>
        {specificContent}
      </div>
    </div>
  )
}

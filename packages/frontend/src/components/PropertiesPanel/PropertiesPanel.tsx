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
import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { GeometryBlock } from './GeometryBlock'
import { CanvasSettings } from './CanvasSettings'
import { CompanionButtonProps } from './CompanionButtonProps'
import { ShapeProps } from './ShapeProps'
import { LabelProps } from './LabelProps'
import { ChannelStripProps } from './ChannelStripProps'
import { VirtualCompanionDeckProps } from './VirtualCompanionDeckProps'
import { CompanionButtonMultiProps } from './CompanionButtonMultiProps'
import { CompanionButtonElement, defaultLayerFor } from '@cwp/shared'

const LS_SIDE = 'cwp:propsPanelSide'
const LS_OPEN = 'cwp:propsPanelOpen'

function loadSide(): 'left' | 'right' {
  return (localStorage.getItem(LS_SIDE) as 'left' | 'right') ?? 'right'
}
function loadOpen(): boolean {
  const v = localStorage.getItem(LS_OPEN)
  return v === null ? true : v === 'true'
}

interface PropsPanelProps {
  onSave?: () => void
}

export function PropertiesPanel({ onSave }: PropsPanelProps) {
  const { t } = useTranslation()
  const [side, setSide] = useState<'left' | 'right'>(loadSide)
  const [open, setOpen] = useState<boolean>(loadOpen)
  const [copyPanelOpen, setCopyPanelOpen] = useState(false)
  const copyPanelRef = useRef<HTMLDivElement>(null)

  const panel = useAppStore((s) => s.getActivePanel())
  const activePanelId = useAppStore((s) => s.activePanelId)
  const panels = useAppStore((s) => s.settings?.panels ?? [])
  const selectedIds = useAppStore((s) => s.selectedIds)
  const deleteElements = useAppStore((s) => s.deleteElements)
  const copiedStyle = useAppStore((s) => s.copiedStyle)
  const copyElementStyle = useAppStore((s) => s.copyElementStyle)
  const pasteElementStyle = useAppStore((s) => s.pasteElementStyle)
  const copyElementsToPanel = useAppStore((s) => s.copyElementsToPanel)
  const moveToLayer = useAppStore((s) => s.moveToLayer)
  const bringForward = useAppStore((s) => s.bringForward)
  const sendBackward = useAppStore((s) => s.sendBackward)

  useEffect(() => {
    if (!copyPanelOpen) return
    const handler = (e: MouseEvent) => {
      if (copyPanelRef.current && !copyPanelRef.current.contains(e.target as Node)) {
        setCopyPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [copyPanelOpen])

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

  const PANEL_W = 320
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
      <div style={tabStyle} onClick={toggleOpen} title={t('propertiesPanel.openProperties')}>
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
    padding: '14px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  }

  // Inhalt bestimmen
  let specificContent: React.ReactNode = null
  if (selectedElements.length === 0 && panel) {
    specificContent = <CanvasSettings panel={panel} panelId={panel.id} />
  } else if (selectedElements.length >= 1) {
    specificContent = (
      <GeometryBlock elements={selectedElements} panelId={panel!.id} />
    )
    // Multi-select: all CompanionButtons → batch edit
    if (
      selectedElements.length >= 2 &&
      selectedElements.every((el) => el.type === 'companionButton')
    ) {
      specificContent = (
        <>
          {specificContent}
          <div style={{ borderTop: '1px solid #2a3344', paddingTop: 12 }}>
            <CompanionButtonMultiProps
              elements={selectedElements as CompanionButtonElement[]}
              panelId={panel!.id}
            />
          </div>
        </>
      )
    } else if (singleEl) {
      if (singleEl.type === 'companionButton') {
        specificContent = (
          <>
            {specificContent}
            <div style={{ borderTop: '1px solid #2a3344', paddingTop: 12 }}>
              <CompanionButtonProps element={singleEl} panelId={panel!.id} side={side} panelWidth={PANEL_W} />
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
      } else if (singleEl.type === 'channelStrip') {
        specificContent = (
          <>
            {specificContent}
            <div style={{ borderTop: '1px solid #2a3344', paddingTop: 12 }}>
              <ChannelStripProps element={singleEl} panelId={panel!.id} side={side} panelWidth={PANEL_W} />
            </div>
          </>
        )
      } else if (singleEl.type === 'virtualCompanionDeck') {
        specificContent = (
          <>
            {specificContent}
            <div style={{ borderTop: '1px solid #2a3344', paddingTop: 12 }}>
              <VirtualCompanionDeckProps element={singleEl} panelId={panel!.id} />
            </div>
          </>
        )
      }
    }
  }

  const canDelete = selectedElements.length > 0 && selectedElements.every((el) => !el.locked)
  const canCopy = singleEl !== null
  const canPaste = copiedStyle !== null
    && selectedElements.length > 0
    && selectedElements.some((el) => el.type === copiedStyle.type)

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>Properties</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {canCopy && (
            <button
              style={collapseBtn}
              title={t('propertiesPanel.copyStyle')}
              onClick={() => singleEl && copyElementStyle(panel!.id, singleEl.id)}
            >
              <span className="material-icons" style={{ fontSize: 20 }}>content_copy</span>
            </button>
          )}
          {canPaste && (
            <button
              style={{ ...collapseBtn, color: '#4a9eff' }}
              title={t('propertiesPanel.pasteStyle')}
              onClick={() => pasteElementStyle(panel!.id, [...selectedIds])}
            >
              <span className="material-icons" style={{ fontSize: 20 }}>content_paste</span>
            </button>
          )}
          <button style={collapseBtn} onClick={flipSide} title={t('propertiesPanel.flipSide')}>⇄</button>
          <button style={collapseBtn} onClick={toggleOpen} title={t('propertiesPanel.collapse')}>‹</button>
        </div>
      </div>
      <div style={contentStyle}>
        {specificContent}
      </div>
      {selectedElements.length > 0 && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid #2a3344', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Layer-Zuweisung (für Einzel- und Mehrfach-Selektion) */}
          {(() => {
            const LAYERS = [
              { id: 0, labelKey: 'propertiesPanel.layerBackground' },
              { id: 1, labelKey: 'propertiesPanel.layerLower' },
              { id: 2, labelKey: 'propertiesPanel.layerMain' },
              { id: 3, labelKey: 'propertiesPanel.layerOverlay' },
            ]
            // Current layer: only highlight if all selected elements share the same layer
            const layers = selectedElements.map((el) => el.layer ?? defaultLayerFor(el.type))
            const currentLayer = layers.every((l) => l === layers[0]) ? layers[0] : null
            return (
              <div>
                <div style={{ fontSize: 11, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                  {t('propertiesPanel.layer')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
                  {LAYERS.map(({ id, labelKey }) => {
                    const active = currentLayer === id
                    return (
                      <button
                        key={id}
                        onClick={() => moveToLayer(panel!.id, [...selectedIds], id)}
                        title={t(labelKey)}
                        style={{
                          background: active ? 'rgba(74,158,255,0.15)' : '#1a2030',
                          border: `1px solid ${active ? '#4a9eff' : '#2a3344'}`,
                          color: active ? '#4a9eff' : '#8896aa',
                          borderRadius: 4, padding: '5px 2px', cursor: 'pointer',
                          fontSize: 10, fontFamily: 'inherit', textAlign: 'center',
                          lineHeight: 1.2,
                        }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#e9edf2' }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#8896aa' }}
                      >
                        {t(labelKey)}
                      </button>
                    )
                  })}
                </div>
                {/* Within-layer ordering — only for single element */}
                {singleEl && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {[
                      { icon: 'expand_less', action: () => bringForward(panel!.id, singleEl.id), title: t('propertiesPanel.bringForward') },
                      { icon: 'expand_more', action: () => sendBackward(panel!.id, singleEl.id), title: t('propertiesPanel.sendBackward') },
                    ].map(({ icon, action, title }) => (
                      <button
                        key={icon}
                        onClick={action}
                        title={title}
                        style={{
                          background: '#1a2030', border: '1px solid #2a3344', color: '#8896aa',
                          borderRadius: 4, padding: '5px 0', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'inherit',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#e9edf2')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#8896aa')}
                      >
                        <span className="material-icons" style={{ fontSize: 18 }}>{icon}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Copy to Panel */}
          <div ref={copyPanelRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setCopyPanelOpen((o) => !o)}
              title={t('propertiesPanel.copyToPanel')}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 6,
                border: `1px solid ${copyPanelOpen ? '#4a9eff' : '#2a3344'}`,
                background: copyPanelOpen ? 'rgba(74,158,255,0.08)' : '#1a2030',
                color: copyPanelOpen ? '#4a9eff' : '#8896aa', fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-icons" style={{ fontSize: 16 }}>content_copy</span>
                {t('propertiesPanel.copyToPanel')}
              </span>
              <span style={{ fontSize: 10, color: '#4a5568' }}>{copyPanelOpen ? '▲' : '▼'}</span>
            </button>
            {copyPanelOpen && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4,
                background: '#1a2030', border: '1px solid #2a3344', borderRadius: 6,
                zIndex: 300, boxShadow: '0 -8px 24px rgba(0,0,0,0.4)', overflow: 'hidden',
              }}>
                {panels.filter((p) => p.id !== activePanelId).length === 0 ? (
                  <div style={{ padding: '10px 14px', color: '#4a5568', fontSize: 13 }}>
                    {t('propertiesPanel.noOtherPanels')}
                  </div>
                ) : (
                  panels.filter((p) => p.id !== activePanelId).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        copyElementsToPanel(activePanelId!, p.id, [...selectedIds])
                        onSave?.()
                        setCopyPanelOpen(false)
                      }}
                      style={{ padding: '9px 14px', fontSize: 13, color: '#e9edf2', cursor: 'pointer', borderBottom: '1px solid #1a2030' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(74,158,255,0.08)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {p.name}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => canDelete && deleteElements(panel!.id, [...selectedIds])}
            disabled={!canDelete}
            title={canDelete ? t('propertiesPanel.deleteElement') : t('propertiesPanel.lockedCannotDelete')}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: canDelete ? '#ff5a5f44' : '#2a3344',
              background: canDelete ? 'rgba(255,90,95,0.1)' : 'transparent',
              color: canDelete ? '#ff5a5f' : '#4a5568',
              fontSize: 13,
              fontWeight: 500,
              cursor: canDelete ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            {selectedElements.length > 1 ? t('propertiesPanel.deleteElements', { count: selectedElements.length }) : t('propertiesPanel.deleteElement')}
          </button>
        </div>
      )}
    </div>
  )
}

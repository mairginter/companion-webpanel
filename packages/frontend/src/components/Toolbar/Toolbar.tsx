import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { AddElementMenu } from '../AddElement/AddElementMenu'

interface ToolbarProps {
  mode: 'view' | 'edit'
  onToggleMode: () => void
}

const s: React.CSSProperties = {
  height: 56,
  minHeight: 56,
  background: 'linear-gradient(to bottom, #1e2840, #161e2e)',
  borderBottom: '1px solid #2a3344',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 8,
  userSelect: 'none',
  flexShrink: 0,
  position: 'relative',
  zIndex: 100,
}

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 28,
  background: '#2a3344',
  margin: '0 8px',
}

const modeButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: '4px 12px',
  borderRadius: 6,
  border: `1px solid ${active ? '#4a9eff' : '#2a3344'}`,
  background: active ? 'rgba(74,158,255,0.12)' : '#1a2030',
  color: active ? '#4a9eff' : '#8896aa',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s',
  height: 32,
})

export function Toolbar({ mode, onToggleMode }: ToolbarProps) {
  const panels = useAppStore((s) => s.settings?.panels ?? [])
  const activePanelId = useAppStore((s) => s.activePanelId)
  const setActivePanelId = useAppStore((s) => s.setActivePanelId)
  const capsDisabledHosts = useAppStore((s) =>
    Object.entries(s.sessionStatus)
      .filter(([, status]) => status === 'caps-disabled')
      .map(([hostId]) => hostId),
  )
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addBtnRef = useRef<HTMLButtonElement>(null)

  const handleAddClick = useCallback(() => {
    setAddMenuOpen((o) => !o)
  }, [])

  const getAddMenuPos = useCallback(() => {
    const rect = addBtnRef.current?.getBoundingClientRect()
    return rect ? { x: rect.left, y: rect.bottom + 4 } : { x: 0, y: 60 }
  }, [])

  const activePanel = panels.find((p) => p.id === activePanelId)

  // Schließen bei Klick außerhalb
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  return (
    <div style={s}>
      <span style={{ fontSize: 15, fontWeight: 600, color: '#e9edf2', letterSpacing: '0.02em', marginRight: 8 }}>
        Companion Panel
      </span>
      <div style={dividerStyle} />

      {/* Panel-Auswahl Dropdown */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          style={{
            ...modeButtonStyle(false),
            display: 'flex', alignItems: 'center', gap: 6,
            minWidth: 140, maxWidth: 220,
            color: '#e9edf2',
            border: `1px solid ${dropdownOpen ? '#4a9eff' : '#2a3344'}`,
          }}
          onClick={() => setDropdownOpen((o) => !o)}
          title="Panel wechseln"
        >
          <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activePanel?.name ?? 'Kein Panel'}
          </span>
          <span style={{ fontSize: 10, color: '#4a5568' }}>{dropdownOpen ? '▲' : '▼'}</span>
        </button>

        {dropdownOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: '#1a2030', border: '1px solid #2a3344', borderRadius: 6,
            minWidth: 200, zIndex: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}>
            {panels.length === 0 && (
              <div style={{ padding: '10px 14px', color: '#4a5568', fontSize: 13 }}>Keine Panels</div>
            )}
            {panels.map((panel) => (
              <div
                key={panel.id}
                onClick={() => { setActivePanelId(panel.id); setDropdownOpen(false) }}
                style={{
                  padding: '10px 14px',
                  fontSize: 13,
                  color: panel.id === activePanelId ? '#4a9eff' : '#e9edf2',
                  background: panel.id === activePanelId ? 'rgba(74,158,255,0.08)' : 'transparent',
                  borderLeft: `3px solid ${panel.id === activePanelId ? '#4a9eff' : 'transparent'}`,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {panel.name}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={dividerStyle} />

      {/* Mode Toggle */}
      <button style={modeButtonStyle(mode === 'view')} onClick={() => mode !== 'view' && onToggleMode()} title="View Mode (V)">
        View
      </button>
      <button style={modeButtonStyle(mode === 'edit')} onClick={() => mode !== 'edit' && onToggleMode()} title="Edit Mode (E)">
        Edit
      </button>

      {mode === 'edit' && (
        <>
          <div style={dividerStyle} />
          <button
            ref={addBtnRef}
            style={{
              ...modeButtonStyle(addMenuOpen),
              width: 32, padding: 0, textAlign: 'center', fontSize: 18,
            }}
            onClick={handleAddClick}
            title="Element hinzufügen"
          >
            +
          </button>
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* CAPS SUBSCRIPTIONS=0 Warnung */}
      {capsDisabledHosts.length > 0 && (
        <div
          title={`Button Subscriptions API deaktiviert für: ${capsDisabledHosts.join(', ')}.\nIn Companion Settings → "Button Subscriptions API" aktivieren.`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid #ff8a3d',
            background: 'rgba(255,138,61,0.12)',
            color: '#ff8a3d',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'default',
          }}
        >
          <span style={{ fontSize: 14 }}>!</span>
          CAPS SUBSCRIPTIONS=0
        </div>
      )}

      {/* Help */}
      <button
        style={{ ...modeButtonStyle(false), width: 32, padding: 0, textAlign: 'center' }}
        title="Keyboard Shortcuts"
      >
        ?
      </button>

      {addMenuOpen && activePanel && (
        <AddElementMenu
          screenPos={getAddMenuPos()}
          canvasPos={{
            x: (activePanel.canvas?.width ?? 1920) / 2,
            y: (activePanel.canvas?.height ?? 1080) / 2,
          }}
          panelId={activePanel.id}
          onClose={() => setAddMenuOpen(false)}
        />
      )}
    </div>
  )
}

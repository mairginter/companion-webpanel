import React, { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'

const SIDEBAR_WIDTH = 200

const containerStyle = (collapsed: boolean): React.CSSProperties => ({
  width: collapsed ? 40 : SIDEBAR_WIDTH,
  minWidth: collapsed ? 40 : SIDEBAR_WIDTH,
  background: '#121821',
  borderRight: '1px solid #2a3344',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: 'width 0.2s ease, min-width 0.2s ease',
  flexShrink: 0,
})

const toggleButtonStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid #2a3344',
  color: '#8896aa',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  flexShrink: 0,
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const panels = useAppStore((s) => s.settings?.panels ?? [])
  const activePanelId = useAppStore((s) => s.activePanelId)
  const setActivePanelId = useAppStore((s) => s.setActivePanelId)

  return (
    <div style={containerStyle(collapsed)}>
      <button
        style={toggleButtonStyle}
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Sidebar öffnen' : 'Sidebar einklappen'}
      >
        {collapsed ? '›' : '‹'}
      </button>

      {!collapsed && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ padding: '8px 12px 4px', color: '#4a5568', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Panels
          </div>
          {panels.map((panel) => (
            <div
              key={panel.id}
              onClick={() => setActivePanelId(panel.id)}
              style={{
                padding: '7px 12px',
                fontSize: 13,
                color: panel.id === activePanelId ? '#e9edf2' : '#8896aa',
                background: panel.id === activePanelId ? '#1a2535' : 'transparent',
                borderLeft: `2px solid ${panel.id === activePanelId ? '#4a9eff' : 'transparent'}`,
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
  )
}

import React from 'react'

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
}

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#e9edf2',
  letterSpacing: '0.02em',
  marginRight: 8,
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
})

export function Toolbar({ mode, onToggleMode }: ToolbarProps) {
  return (
    <div style={s}>
      <span style={titleStyle}>Companion Panel</span>
      <div style={dividerStyle} />

      {/* Mode Toggle */}
      <button
        style={modeButtonStyle(mode === 'view')}
        onClick={() => mode !== 'view' && onToggleMode()}
        title="View Mode (V)"
      >
        View
      </button>
      <button
        style={modeButtonStyle(mode === 'edit')}
        onClick={() => mode !== 'edit' && onToggleMode()}
        title="Edit Mode (E)"
      >
        Edit
      </button>

      <div style={dividerStyle} />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Help */}
      <button
        style={{
          ...modeButtonStyle(false),
          width: 32,
          padding: 0,
          textAlign: 'center',
        }}
        title="Keyboard Shortcuts"
      >
        ?
      </button>
    </div>
  )
}

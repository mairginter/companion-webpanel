import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { AddElementMenu } from '../AddElement/AddElementMenu'
import { ZoomControl } from './ZoomControl'
import { LanguageSwitcher } from './LanguageSwitcher'

interface ToolbarProps {
  mode: 'view' | 'edit'
  onToggleMode: () => void
  onOpenHostManager?: () => void
  onSave?: () => void
}

type SessionStatus = 'connecting' | 'connected' | 'stale' | 'error' | 'caps-disabled'

function statusDotColor(status: SessionStatus | undefined): string {
  switch (status) {
    case 'connected':     return '#21d07a'
    case 'connecting':    return '#4a9eff'
    case 'stale':         return '#ff8a3d'
    case 'error':         return '#ff5a5f'
    case 'caps-disabled': return '#8896aa'
    default:              return '#4a5568'
  }
}

function statusLabel(status: SessionStatus | undefined, t: (key: string) => string): string {
  switch (status) {
    case 'connected':     return t('status.connected')
    case 'connecting':    return t('status.connecting')
    case 'stale':         return t('status.stale')
    case 'error':         return t('status.error')
    case 'caps-disabled': return t('status.capsDisabled')
    default:              return t('status.unknown')
  }
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

export function Toolbar({ mode, onToggleMode, onOpenHostManager, onSave }: ToolbarProps) {
  const { t } = useTranslation()
  const panels = useAppStore((s) => s.settings?.panels ?? [])
  const activePanelId = useAppStore((s) => s.activePanelId)
  const setActivePanelId = useAppStore((s) => s.setActivePanelId)
  const createPanel = useAppStore((s) => s.createPanel)
  const renamePanel = useAppStore((s) => s.renamePanel)
  const deletePanel = useAppStore((s) => s.deletePanel)
  const hosts = useAppStore((s) => s.settings?.hosts ?? [])
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const hostInfo = useAppStore((s) => s.hostInfo)
  const capsDisabledHosts = useAppStore((s) =>
    Object.entries(s.sessionStatus)
      .filter(([, status]) => status === 'caps-disabled')
      .map(([hostId]) => hostId),
  )
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  // Welches Panel gerade inline umbenannt wird
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  // Neues Panel — Eingabezeile unten im Dropdown
  const [creatingPanel, setCreatingPanel] = useState(false)
  const [newPanelName, setNewPanelName] = useState('')
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
  const setZoom = useAppStore((s) => s.setZoom)
  const zoom = activePanel?.zoom ?? 1
  const [saveFlash, setSaveFlash] = useState(false)

  const handleSaveClick = useCallback(() => {
    onSave?.()
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 600)
  }, [onSave])

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
        Companion Webpanel
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
            {activePanel?.name ?? t('toolbar.noPanel')}
          </span>
          <span style={{ fontSize: 10, color: '#4a5568' }}>{dropdownOpen ? '▲' : '▼'}</span>
        </button>

        {dropdownOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: '#1a2030', border: '1px solid #2a3344', borderRadius: 6,
            minWidth: 240, zIndex: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}>
            {panels.length === 0 && (
              <div style={{ padding: '10px 14px', color: '#4a5568', fontSize: 13 }}>{t('toolbar.noPanels')}</div>
            )}
            {panels.map((panel) => {
              const isActive = panel.id === activePanelId
              const isRenaming = renamingId === panel.id
              return (
                <div key={panel.id} style={{
                  display: 'flex', alignItems: 'center',
                  borderLeft: `3px solid ${isActive ? '#4a9eff' : 'transparent'}`,
                  background: isActive ? 'rgba(74,158,255,0.08)' : 'transparent',
                }}>
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && renameValue.trim()) {
                          renamePanel(panel.id, renameValue.trim())
                          onSave?.()
                          setRenamingId(null)
                        } else if (e.key === 'Escape') {
                          setRenamingId(null)
                        }
                        e.stopPropagation()
                      }}
                      onBlur={() => {
                        if (renameValue.trim()) renamePanel(panel.id, renameValue.trim())
                        onSave?.()
                        setRenamingId(null)
                      }}
                      style={{
                        flex: 1, margin: '4px 8px', padding: '3px 6px',
                        background: '#121821', border: '1px solid #4a9eff',
                        borderRadius: 4, color: '#e9edf2', fontSize: 13, outline: 'none',
                      }}
                    />
                  ) : (
                    <div
                      onClick={() => { setActivePanelId(panel.id); setDropdownOpen(false) }}
                      style={{
                        flex: 1, padding: '9px 12px',
                        fontSize: 13, color: isActive ? '#4a9eff' : '#e9edf2',
                        cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {panel.name}
                    </div>
                  )}
                  {!isRenaming && (
                    <div style={{ display: 'flex', gap: 2, paddingRight: 6, flexShrink: 0 }}>
                      <button
                        title={t('toolbar.rename')}
                        onClick={(e) => { e.stopPropagation(); setRenameValue(panel.name); setRenamingId(panel.id) }}
                        style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 13, padding: '2px 4px', borderRadius: 3 }}
                      >
                        ✎
                      </button>
                      <button
                        title={panels.length <= 1 ? t('toolbar.cannotDeleteLast') : t('toolbar.deletePanel')}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (deletePanel(panel.id)) onSave?.()
                        }}
                        disabled={panels.length <= 1}
                        style={{ background: 'none', border: 'none', color: panels.length <= 1 ? '#2a3344' : '#ff5a5f', cursor: panels.length <= 1 ? 'default' : 'pointer', fontSize: 13, padding: '2px 4px', borderRadius: 3 }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Trennlinie + Neues Panel */}
            <div style={{ borderTop: '1px solid #2a3344', padding: '6px 8px' }}>
              {creatingPanel ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    autoFocus
                    placeholder={t('toolbar.panelNamePlaceholder')}
                    value={newPanelName}
                    onChange={(e) => setNewPanelName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPanelName.trim()) {
                        createPanel(newPanelName.trim())
                        onSave?.()
                        setNewPanelName('')
                        setCreatingPanel(false)
                        setDropdownOpen(false)
                      } else if (e.key === 'Escape') {
                        setCreatingPanel(false)
                        setNewPanelName('')
                      }
                      e.stopPropagation()
                    }}
                    style={{
                      flex: 1, padding: '5px 8px',
                      background: '#121821', border: '1px solid #4a9eff',
                      borderRadius: 4, color: '#e9edf2', fontSize: 13, outline: 'none',
                    }}
                  />
                  <button
                    title={t('toolbar.createPanel')}
                    disabled={!newPanelName.trim()}
                    onMouseDown={(e) => {
                      e.preventDefault() // verhindert blur auf input
                      if (!newPanelName.trim()) return
                      createPanel(newPanelName.trim())
                      onSave?.()
                      setNewPanelName('')
                      setCreatingPanel(false)
                      setDropdownOpen(false)
                    }}
                    style={{
                      padding: '0 10px', borderRadius: 4, flexShrink: 0,
                      background: newPanelName.trim() ? 'rgba(33,208,122,0.15)' : 'transparent',
                      border: `1px solid ${newPanelName.trim() ? '#21d07a' : '#2a3344'}`,
                      color: newPanelName.trim() ? '#21d07a' : '#4a5568',
                      fontSize: 16, cursor: newPanelName.trim() ? 'pointer' : 'default',
                    }}
                  >
                    ✓
                  </button>
                  <button
                    title={t('toolbar.cancelShortcut')}
                    onMouseDown={(e) => { e.preventDefault(); setCreatingPanel(false); setNewPanelName('') }}
                    style={{
                      padding: '0 8px', borderRadius: 4, flexShrink: 0,
                      background: 'transparent', border: '1px solid #2a3344',
                      color: '#4a5568', fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setCreatingPanel(true) }}
                  style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    color: '#4a9eff', fontSize: 13, cursor: 'pointer', padding: '3px 4px',
                  }}
                >
                  {t('toolbar.newPanel')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Speichern — direkt neben Panel-Dropdown */}
      <button
        onClick={handleSaveClick}
        title={t('toolbar.save')}
        style={{
          width: 32, height: 32, padding: 0,
          borderRadius: 6,
          border: `1px solid ${saveFlash ? '#21d07a' : '#2a3344'}`,
          background: saveFlash ? 'rgba(33,208,122,0.18)' : '#1a2030',
          color: saveFlash ? '#21d07a' : '#8896aa',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s, border-color 0.15s, color 0.15s',
          transform: saveFlash ? 'scale(0.92)' : 'scale(1)',
          flexShrink: 0,
        }}
      >
        <span className="material-icons" style={{ fontSize: 18 }}>save</span>
      </button>

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
            title={t('toolbar.addElement')}
          >
            +
          </button>
        </>
      )}

      <div style={dividerStyle} />
      <ZoomControl
        zoom={zoom}
        onZoomChange={(z) => {
          if (activePanel) setZoom(activePanel.id, z)
        }}
      />

      <div style={{ flex: 1 }} />

      {/* Host Status Dots — nur Hosts mit showInToolbar !== false */}
      {hosts.some(h => h.showInToolbar !== false) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {hosts.filter(h => h.showInToolbar !== false).map((host) => {
            const status = sessionStatus[host.id]
            const info = hostInfo[host.id]
            const dotColor = statusDotColor(status)
            const tooltip = [
              host.name,
              `${host.host}:${host.satellite.wsPort}`,
              statusLabel(status, t),
              info ? `Companion ${info.companionVersion}` : '',
              info ? `API ${info.apiVersion}` : '',
              host.notes ? `Notizen: ${host.notes}` : '',
            ].filter(Boolean).join('\n')
            return (
              <div
                key={host.id}
                title={tooltip}
                onClick={onOpenHostManager}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 8px',
                  borderRadius: 5,
                  border: '1px solid #2a3344',
                  background: '#121821',
                  cursor: onOpenHostManager ? 'pointer' : 'default',
                  fontSize: 12,
                  color: '#8896aa',
                  maxWidth: 140,
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: dotColor,
                  flexShrink: 0,
                  boxShadow: status === 'connected' ? `0 0 4px ${dotColor}` : 'none',
                }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {host.name}
                </span>
              </div>
            )
          })}
          <button
            style={{ ...modeButtonStyle(false), width: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={onOpenHostManager}
            title={t('toolbar.manageHosts')}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>settings</span>
          </button>
        </div>
      )}

      {hosts.length === 0 && (
        <button
          style={{ ...modeButtonStyle(false), fontSize: 12, color: '#ff8a3d', borderColor: '#ff8a3d' }}
          onClick={onOpenHostManager}
          title={t('toolbar.manageHosts')}
        >
          {t('toolbar.addHost')}
        </button>
      )}

      <div style={dividerStyle} />

      {/* CAPS SUBSCRIPTIONS=0 Warnung */}
      {capsDisabledHosts.length > 0 && (
        <div
          title={t('toolbar.capsDisabledWarning', { hosts: capsDisabledHosts.join(', ') })}
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
          {t('status.capsDisabled')}
        </div>
      )}

      <LanguageSwitcher />
      <div style={dividerStyle} />

      {/* Help */}
      <button
        style={{ ...modeButtonStyle(false), width: 32, padding: 0, textAlign: 'center' }}
        title={t('toolbar.keyboardShortcuts')}
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

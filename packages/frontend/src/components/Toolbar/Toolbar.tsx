/**
 * Toolbar.tsx
 *
 * Kopfleiste der App (56 px). Der Inhalt hängt vom Modus ab:
 *
 *  View-Mode  — reduziert auf das, was im Live-Betrieb gebraucht wird:
 *               Panel-Wechsel (ohne Verwaltung), Mode-Toggle, Zoom, Show-Lock,
 *               Kiosk, Geräte-Links, Host-Status, Hilfe. Speichern erscheint nur bei ungespeicherten Änderungen.
 *  Edit-Mode  — zusätzlich Panel-Verwaltung (Umbenennen/Duplizieren/Löschen/Neu),
 *               Speichern, Element hinzufügen, Host-Labels, Sprache.
 *
 * Zoom/Fit, Kiosk und Show-Lock sind geräte-lokal (siehe utils/deviceView.ts).
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore, selectDirty, selectZoom, selectAutoZoom } from '../../store/useAppStore'
import { hasFixedCanvas } from '../../utils/deviceView'
import { AddElementMenu } from '../AddElement/AddElementMenu'
import { ZoomControl } from './ZoomControl'
import { LanguageSwitcher } from './LanguageSwitcher'

interface ToolbarProps {
  mode: 'view' | 'edit'
  onToggleMode: () => void
  onOpenHostManager?: () => void
  onOpenHelp?: () => void
  /** Öffnet den Geräte-Links-Dialog (Kiosk-/Lock-Adressen) */
  onOpenDeviceLinks?: () => void
  /** Speichert die Settings; liefert (falls async) true bei Erfolg */
  onSave?: () => void | Promise<boolean>
}

/** Icon-Button in den Zeilen des Panel-Dropdowns (28×28 — auch per Touch treffbar) */
const rowIconButton = (color: string, disabled = false): React.CSSProperties => ({
  width: 28, height: 28, padding: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'none', border: 'none', borderRadius: 4,
  color, cursor: disabled ? 'default' : 'pointer',
})

/** Quadratischer Icon-Button in der Toolbar (aufbauend auf modeButtonStyle) */
const iconButtonStyle = (active: boolean): React.CSSProperties => ({
  ...modeButtonStyle(active),
  width: 32, padding: 0, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
})

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

export function Toolbar({ mode, onToggleMode, onOpenHostManager, onOpenHelp, onOpenDeviceLinks, onSave }: ToolbarProps) {
  const { t } = useTranslation()
  const panels = useAppStore((s) => s.settings?.panels ?? [])
  const activePanelId = useAppStore((s) => s.activePanelId)
  const setActivePanelId = useAppStore((s) => s.setActivePanelId)
  const createPanel = useAppStore((s) => s.createPanel)
  const renamePanel = useAppStore((s) => s.renamePanel)
  const deletePanel = useAppStore((s) => s.deletePanel)
  const duplicatePanel = useAppStore((s) => s.duplicatePanel)
  const showHostLabels = useAppStore((s) => s.showHostLabels)
  const setShowHostLabels = useAppStore((s) => s.setShowHostLabels)
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
  const setAutoZoom = useAppStore((s) => s.setAutoZoom)
  // Zoom/Fit, Kiosk, Lock: geräte-lokal
  const zoom = useAppStore(selectZoom)
  const autoZoom = useAppStore(selectAutoZoom)
  const dirty = useAppStore(selectDirty)
  const locked = useAppStore((s) => s.locked)
  const setLocked = useAppStore((s) => s.setLocked)
  const setKiosk = useAppStore((s) => s.setKiosk)
  // Rückmeldung am Save-Button: grün = gespeichert, rot = fehlgeschlagen
  const [saveFlash, setSaveFlash] = useState<'ok' | 'fail' | null>(null)
  // Panel-ID, deren Löschen gerade bestätigt werden muss (zweiter Klick löscht)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleSaveClick = useCallback(async () => {
    // Erst das Ergebnis abwarten — vorher blinkte der Button auch bei Fehlschlag grün
    const ok = (await onSave?.()) !== false
    setSaveFlash(ok ? 'ok' : 'fail')
    setTimeout(() => setSaveFlash(null), 600)
  }, [onSave])

  // Lösch-Bestätigung verfällt wenn das Dropdown schließt
  useEffect(() => {
    if (!dropdownOpen) setConfirmDeleteId(null)
  }, [dropdownOpen])

  const saveColor = saveFlash === 'ok' ? '#21d07a' : saveFlash === 'fail' ? '#ff5a5f' : null

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
          title={t('toolbar.switchPanel')}
        >
          <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activePanel?.name ?? t('toolbar.noPanel')}
          </span>
          <span className="material-icons" style={{ fontSize: 18, color: '#4a5568' }}>
            {dropdownOpen ? 'expand_less' : 'expand_more'}
          </span>
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
                  {/* Panel-Verwaltung nur im Edit-Mode — im View-Mode ist das Dropdown ein reiner Umschalter */}
                  {!isRenaming && mode === 'edit' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, paddingRight: 6, flexShrink: 0 }}>
                      {confirmDeleteId === panel.id ? (
                        // Zweistufiges Löschen: erster Klick fragt nach, zweiter löscht
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmDeleteId(null)
                              if (deletePanel(panel.id)) onSave?.()
                            }}
                            style={{
                              height: 28, padding: '0 8px', borderRadius: 4, cursor: 'pointer',
                              background: 'rgba(255,90,95,0.15)', border: '1px solid #ff5a5f',
                              color: '#ff5a5f', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                            }}
                          >
                            {t('toolbar.confirmDeletePanel')}
                          </button>
                          <button
                            title={t('toolbar.cancelShortcut')}
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }}
                            style={rowIconButton('#8896aa')}
                          >
                            <span className="material-icons" style={{ fontSize: 16 }}>close</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            title={t('toolbar.rename')}
                            onClick={(e) => { e.stopPropagation(); setRenameValue(panel.name); setRenamingId(panel.id) }}
                            style={rowIconButton('#8896aa')}
                          >
                            <span className="material-icons" style={{ fontSize: 16 }}>edit</span>
                          </button>
                          <button
                            title={t('toolbar.duplicatePanel')}
                            onClick={(e) => { e.stopPropagation(); duplicatePanel(panel.id); onSave?.(); setDropdownOpen(false) }}
                            style={rowIconButton('#8896aa')}
                          >
                            <span className="material-icons" style={{ fontSize: 16 }}>content_copy</span>
                          </button>
                          <button
                            title={panels.length <= 1 ? t('toolbar.cannotDeleteLast') : t('toolbar.deletePanel')}
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(panel.id) }}
                            disabled={panels.length <= 1}
                            style={rowIconButton(panels.length <= 1 ? '#2a3344' : '#ff5a5f', panels.length <= 1)}
                          >
                            <span className="material-icons" style={{ fontSize: 16 }}>delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Trennlinie + Neues Panel (nur Edit-Mode) */}
            {mode === 'edit' && <div style={{ borderTop: '1px solid #2a3344', padding: '6px 8px' }}>
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
                    <span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle' }}>check</span>
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
                    <span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle' }}>close</span>
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
            </div>}
          </div>
        )}
      </div>

      {/* Speichern — im Edit-Mode immer, im View-Mode nur wenn es etwas zu speichern gibt.
          Der orange Punkt zeigt ungespeicherte Änderungen an. */}
      {(mode === 'edit' || dirty) && (
        <button
          onClick={handleSaveClick}
          title={dirty ? `${t('toolbar.save')} — ${t('toolbar.unsavedChanges')}` : t('toolbar.save')}
          style={{
            width: 32, height: 32, padding: 0,
            borderRadius: 6,
            border: `1px solid ${saveColor ?? (dirty ? '#ff8a3d' : '#2a3344')}`,
            background: saveFlash === 'ok' ? 'rgba(33,208,122,0.18)' : saveFlash === 'fail' ? 'rgba(255,90,95,0.18)' : '#1a2030',
            color: saveColor ?? (dirty ? '#e9edf2' : '#8896aa'),
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            transform: saveFlash ? 'scale(0.92)' : 'scale(1)',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <span className="material-icons" style={{ fontSize: 18 }}>save</span>
          {dirty && !saveFlash && (
            <span style={{
              position: 'absolute', top: -3, right: -3, width: 9, height: 9,
              borderRadius: '50%', background: '#ff8a3d', border: '2px solid #161e2e',
            }} />
          )}
        </button>
      )}

      <div style={dividerStyle} />

      {/* Mode Toggle — Edit ist bei aktivem Show-Lock gesperrt */}
      <button style={modeButtonStyle(mode === 'view')} onClick={() => mode !== 'view' && onToggleMode()} title={t('toolbar.viewMode')}>
        {t('toolbar.viewMode')}
      </button>
      <button
        style={{ ...modeButtonStyle(mode === 'edit'), ...(locked ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
        onClick={() => mode !== 'edit' && onToggleMode()}
        disabled={locked}
        title={locked ? t('toolbar.editLocked') : t('toolbar.editMode')}
      >
        {t('toolbar.editMode')}
      </button>

      {mode === 'edit' && (
        <>
          <div style={dividerStyle} />
          <button
            ref={addBtnRef}
            style={iconButtonStyle(addMenuOpen)}
            onClick={handleAddClick}
            title={t('toolbar.addElement')}
          >
            <span className="material-icons" style={{ fontSize: 20 }}>add</span>
          </button>

          <button
            style={iconButtonStyle(showHostLabels)}
            onClick={() => setShowHostLabels(!showHostLabels)}
            title={showHostLabels ? t('toolbar.hideHostLabels') : t('toolbar.showHostLabels')}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>label</span>
          </button>
        </>
      )}

      <div style={dividerStyle} />
      <ZoomControl
        zoom={zoom}
        onZoomChange={(z) => {
          if (activePanel) setZoom(activePanel.id, z)
        }}
        autoZoom={autoZoom}
        onAutoZoomChange={(v) => {
          if (activePanel) setAutoZoom(activePanel.id, v)
        }}
        fitAvailable={hasFixedCanvas(activePanel)}
      />

      {/* Live-Betrieb (nur View-Mode): Show-Lock + Kiosk */}
      {mode === 'view' && (
        <>
          <button
            style={{
              ...iconButtonStyle(locked),
              ...(locked ? { borderColor: '#ff8a3d', color: '#ff8a3d', background: 'rgba(255,138,61,0.12)' } : {}),
            }}
            onClick={() => setLocked(!locked)}
            title={locked ? t('toolbar.unlock') : t('toolbar.lock')}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>{locked ? 'lock' : 'lock_open'}</span>
          </button>
          <button
            style={iconButtonStyle(false)}
            onClick={() => setKiosk(true)}
            title={t('toolbar.kioskEnter')}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>fullscreen</span>
          </button>
        </>
      )}

      {/* Geräte-Links: Adressen für Tablet/Kiosk/Show-Lock erzeugen. In beiden Modi sichtbar —
          im View-Mode mit Beschriftung (dort ist Platz), im Edit-Mode nur als Icon. */}
      <button
        style={{
          ...modeButtonStyle(false),
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          ...(mode === 'edit' ? { width: 32, padding: 0, justifyContent: 'center' } : {}),
        }}
        onClick={onOpenDeviceLinks}
        title={t('toolbar.deviceLinksTitle')}
      >
        <span className="material-icons" style={{ fontSize: 18 }}>devices</span>
        {mode === 'view' && t('toolbar.deviceLinks')}
      </button>

      <div style={{ flex: 1 }} />

      {/* Host Status Dots — nur Hosts mit showInToolbar !== false.
          Das Zahnrad steht bewusst immer da sobald es Hosts gibt: früher verschwand es,
          wenn alle Hosts showInToolbar=false hatten — die Host-Verwaltung war dann unerreichbar. */}
      {hosts.length > 0 && (
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
              host.notes ? `${t('toolbar.notes')}: ${host.notes}` : '',
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
          <span className="material-icons" style={{ fontSize: 16 }}>warning</span>
          {t('status.capsDisabled')}
        </div>
      )}

      {/* Sprache ist eine Einrichtungs-Einstellung → nur im Edit-Mode */}
      {mode === 'edit' && (
        <>
          <LanguageSwitcher />
          <div style={dividerStyle} />
        </>
      )}

      {/* Help */}
      <button
        style={iconButtonStyle(false)}
        title={t('toolbar.keyboardShortcuts')}
        onClick={onOpenHelp}
      >
        <span className="material-icons" style={{ fontSize: 18 }}>help_outline</span>
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

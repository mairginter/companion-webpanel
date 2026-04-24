/**
 * HostManagerModal.tsx
 *
 * Modal zum Verwalten von Companion-Hosts:
 *  - Host-Liste mit Live-Verbindungsstatus + Companion-Version
 *  - Hinzufügen / Bearbeiten / Löschen von Hosts
 *  - Warn-Dialog bei Löschen eines referenzierten Hosts
 *  - Felder: Name, Host/IP, WS-Port (default 16623), Notes, Automatisch verbinden
 *  - Speichern direkt via saveSettings() → POST /api/settings
 */
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { HostProfile, Settings } from '@cwp/shared'

type SessionStatus = 'connecting' | 'connected' | 'stale' | 'error' | 'caps-disabled'

interface Props {
  onClose: () => void
  saveSettings: (settings: Settings) => void
}

// ─── Style-Helpers ──────────────────────────────────────────────────────────

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

function statusLabel(status: SessionStatus | undefined, t: (k: string) => string): string {
  switch (status) {
    case 'connected':      return t('status.connected')
    case 'connecting':     return t('status.connecting')
    case 'stale':          return t('status.staleReconnect')
    case 'error':          return t('status.connectionError')
    case 'caps-disabled':  return t('status.capsDisabledDetail')
    default:               return t('status.disconnected')
  }
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.65)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1200,
}

const MODAL: React.CSSProperties = {
  background: '#1a2030',
  border: '1px solid #2a3344',
  borderRadius: 12,
  width: 560,
  maxWidth: '90vw',
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
}

const HEADER: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid #2a3344',
  flexShrink: 0,
}

const FOOTER: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
  gap: 8,
  padding: '12px 20px',
  borderTop: '1px solid #2a3344',
  flexShrink: 0,
}

const inputStyle: React.CSSProperties = {
  background: '#121821',
  border: '1px solid #2a3344',
  borderRadius: 6,
  color: '#e9edf2',
  fontSize: 13,
  padding: '7px 10px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#8896aa',
  marginBottom: 4,
  display: 'block',
}

const btnPrimary: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 6,
  background: '#4a9eff', border: 'none',
  color: '#fff', fontSize: 13, fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 6,
  background: 'transparent', border: '1px solid #2a3344',
  color: '#8896aa', fontSize: 13,
  cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 6,
  background: 'transparent', border: '1px solid #ff5a5f',
  color: '#ff5a5f', fontSize: 13,
  cursor: 'pointer',
}

const btnConnect: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 6,
  background: 'transparent', border: '1px solid #21d07a',
  color: '#21d07a', fontSize: 13,
  cursor: 'pointer',
}

const btnDisconnect: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 6,
  background: 'transparent', border: '1px solid #ff8a3d',
  color: '#ff8a3d', fontSize: 13,
  cursor: 'pointer',
}

// ─── Leere Host-Vorlage ──────────────────────────────────────────────────────

function emptyHost(): Omit<HostProfile, 'id'> {
  return {
    name: '',
    host: '',
    satellite: { wsPort: 16623 },
    notes: '',
    autoConnect: true,
    showInToolbar: true,
    gridCols: 8,
    gridRows: 4,
    maxPages: 99,
    pageNames: {},
  }
}

// ─── Host-Form ───────────────────────────────────────────────────────────────

interface HostFormProps {
  value: Omit<HostProfile, 'id'>
  onChange: (v: Omit<HostProfile, 'id'>) => void
}

function HostForm({ value, onChange }: HostFormProps) {
  const { t } = useTranslation()
  const set = (patch: Partial<Omit<HostProfile, 'id'>>) => onChange({ ...value, ...patch })
  const [pageNamesOpen, setPageNamesOpen] = React.useState(false)
  const maxP = value.maxPages ?? 99
  const pageNums = Array.from({ length: maxP }, (_, i) => i + 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>{t('hostManager.name')} *</label>
          <input
            style={inputStyle}
            placeholder={t('hostManager.namePlaceholder')}
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
        <div>
          <label style={labelStyle}>{t('hostManager.hostname')} *</label>
          <input
            style={inputStyle}
            placeholder={t('hostManager.hostnamePlaceholder')}
            value={value.host}
            onChange={(e) => set({ host: e.target.value })}
          />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>{t('hostManager.wsPort')}</label>
          <input
            style={inputStyle}
            type="number"
            min={1}
            max={65535}
            value={value.satellite.wsPort}
            onChange={(e) => set({ satellite: { wsPort: parseInt(e.target.value, 10) || 16623 } })}
          />
        </div>
        <div>
          <label style={labelStyle}>{t('hostManager.notes')}</label>
          <input
            style={inputStyle}
            placeholder={t('hostManager.notesPlaceholder')}
            value={value.notes ?? ''}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={value.autoConnect !== false}
            onChange={(e) => set({ autoConnect: e.target.checked })}
            style={{ width: 16, height: 16, accentColor: '#4a9eff' }}
          />
          <span style={{ fontSize: 13, color: '#e9edf2' }}>{t('hostManager.autoConnect')}</span>
          <span style={{ fontSize: 12, color: '#4a5568' }}>
            {t('hostManager.autoConnectHint')}
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={value.showInToolbar !== false}
            onChange={(e) => set({ showInToolbar: e.target.checked })}
            style={{ width: 16, height: 16, accentColor: '#4a9eff' }}
          />
          <span style={{ fontSize: 13, color: '#e9edf2' }}>{t('hostManager.showInToolbar')}</span>
          <span style={{ fontSize: 12, color: '#4a5568' }}>
            {t('hostManager.showInToolbarHint')}
          </span>
        </label>
      </div>
      {/* Button-Grid Standardgröße */}
      <div>
        <label style={{ ...labelStyle, marginBottom: 8 }}>{t('hostManager.buttonGrid')}</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>{t('hostManager.buttonsPerRow')}</label>
            <input
              style={inputStyle}
              type="number"
              min={1}
              max={32}
              value={value.gridCols ?? 8}
              onChange={(e) => set({ gridCols: Math.max(1, Math.min(32, parseInt(e.target.value, 10) || 8)) })}
            />
          </div>
          <div>
            <label style={labelStyle}>{t('hostManager.rowsCount')}</label>
            <input
              style={inputStyle}
              type="number"
              min={1}
              max={16}
              value={value.gridRows ?? 4}
              onChange={(e) => set({ gridRows: Math.max(1, Math.min(16, parseInt(e.target.value, 10) || 4)) })}
            />
          </div>
        </div>
      </div>
      {/* Max. Pages */}
      <div>
        <label style={labelStyle}>{t('hostManager.maxPages')}</label>
        <input
          style={inputStyle}
          type="number"
          min={1}
          max={999}
          value={value.maxPages ?? 99}
          onChange={(e) => set({ maxPages: Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 99)) })}
        />
      </div>
      {/* Page-Namen */}
      <div>
        <button
          type="button"
          onClick={() => setPageNamesOpen((v) => !v)}
          style={{
            background: 'none', border: '1px solid #2a3344', borderRadius: 6,
            color: '#8896aa', fontSize: 12, padding: '5px 10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {pageNamesOpen ? '▼' : '▶'} {t('hostManager.configurePageNames')}
        </button>
        {pageNamesOpen && (
          <div style={{
            marginTop: 8,
            maxHeight: 200,
            overflowY: 'auto',
            border: '1px solid #2a3344',
            borderRadius: 6,
            background: '#121821',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            {pageNums.map((n) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#4a5568', minWidth: 52 }}>{t('hostManager.pageName', { n })}</span>
                <input
                  style={{ ...inputStyle, padding: '3px 8px', fontSize: 12 }}
                  placeholder={t('hostManager.pageNamePlaceholder')}
                  value={value.pageNames?.[n] ?? ''}
                  onChange={(e) => {
                    const names = { ...(value.pageNames ?? {}) }
                    if (e.target.value) names[n] = e.target.value
                    else delete names[n]
                    set({ pageNames: Object.keys(names).length > 0 ? names : undefined })
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Warn-Dialog (löschen) ───────────────────────────────────────────────────

interface DeleteDialogProps {
  hostName: string
  refCount: number
  onConfirm: (deleteRefs: boolean) => void
  onCancel: () => void
}

function DeleteDialog({ hostName, refCount, onConfirm, onCancel }: DeleteDialogProps) {
  const { t } = useTranslation()
  const [deleteRefs, setDeleteRefs] = useState(false)

  return (
    <div style={OVERLAY}>
      <div style={{ ...MODAL, width: 420 }}>
        <div style={HEADER}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#ff5a5f' }}>{t('hostManager.deleteHost')}</span>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 14, color: '#e9edf2' }}>
            Host <strong>"{hostName}"</strong> {t('hostManager.confirmDelete')}
          </p>
          {refCount > 0 && (
            <>
              <p style={{ margin: 0, fontSize: 13, color: '#ff8a3d' }}>
                {t('hostManager.deleteWarning', { count: refCount })}
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={deleteRefs}
                  onChange={(e) => setDeleteRefs(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#ff5a5f' }}
                />
                <span style={{ fontSize: 13, color: '#e9edf2' }}>
                  {t('hostManager.deleteLinkedButtons', { count: refCount })}
                </span>
              </label>
            </>
          )}
        </div>
        <div style={FOOTER}>
          <button style={btnSecondary} onClick={onCancel}>{t('hostManager.cancel')}</button>
          <button style={btnDanger} onClick={() => onConfirm(deleteRefs)}>{t('hostManager.deleteHost')}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Hauptmodal ──────────────────────────────────────────────────────────────

export function HostManagerModal({ onClose, saveSettings }: Props) {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const hostInfo = useAppStore((s) => s.hostInfo)

  // Welcher Host wird gerade bearbeitet (null = keiner, 'new' = neuer Host)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [formValue, setFormValue] = useState<Omit<HostProfile, 'id'>>(emptyHost())
  const [deleteTarget, setDeleteTarget] = useState<HostProfile | null>(null)

  if (!settings) return null
  // s ist garantiert non-null für alle Closures unten
  const s = settings

  const hosts = s.hosts

  // Anzahl der Panel-Elemente die einen bestimmten Host referenzieren
  function refCount(hostId: string): number {
    return s.panels.reduce((count, panel) =>
      count + panel.elements.filter(
        (el) => el.type === 'companionButton' && (el as any).ref?.hostId === hostId,
      ).length,
      0,
    )
  }

  function startAdd() {
    setFormValue(emptyHost())
    setEditing('new')
  }

  function startEdit(host: HostProfile) {
    setFormValue({ name: host.name, host: host.host, satellite: host.satellite, notes: host.notes ?? '', autoConnect: host.autoConnect, showInToolbar: host.showInToolbar, gridCols: host.gridCols, gridRows: host.gridRows, maxPages: host.maxPages, pageNames: host.pageNames })
    setEditing(host.id)
  }

  function cancelEdit() {
    setEditing(null)
  }

  function saveEdit() {
    if (!formValue.name.trim() || !formValue.host.trim()) return

    let next: Settings
    if (editing === 'new') {
      const newHost: HostProfile = { id: crypto.randomUUID(), ...formValue }
      next = { ...s, hosts: [...s.hosts, newHost] }
    } else {
      const updated: HostProfile = { id: editing!, ...formValue }
      next = { ...s, hosts: s.hosts.map((h) => h.id === editing ? updated : h) }
    }
    saveSettings(next)
    setEditing(null)
  }

  function confirmDelete(host: HostProfile) {
    setDeleteTarget(host)
  }

  function doDelete(deleteRefs: boolean) {
    if (!deleteTarget) return
    const newHosts = s.hosts.filter((h) => h.id !== deleteTarget.id)
    const newPanels = deleteRefs
      ? s.panels.map((p) => ({
          ...p,
          elements: p.elements.filter(
            (el) => !(el.type === 'companionButton' && (el as any).ref?.hostId === deleteTarget.id),
          ),
        }))
      : s.panels
    saveSettings({ ...s, hosts: newHosts, panels: newPanels })
    setDeleteTarget(null)
  }

  return (
    <>
      <div style={OVERLAY} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div style={MODAL}>
          {/* Header */}
          <div style={HEADER}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#e9edf2' }}>{t('hostManager.title')}</span>
            <button
              style={{ background: 'none', border: 'none', color: '#8896aa', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Host-Liste */}
            {hosts.map((host) => {
              const status = sessionStatus[host.id] as SessionStatus | undefined
              const info = hostInfo[host.id]
              const dotColor = statusDotColor(status)
              const isEditing = editing === host.id

              return (
                <React.Fragment key={host.id}>
                <div style={{
                  background: '#121821',
                  border: `1px solid ${isEditing ? '#4a9eff' : '#2a3344'}`,
                  borderRadius: 8,
                  overflow: 'hidden',
                }}>
                  {/* Host-Zeile: Info links + Buttons rechts */}
                  <div style={{ display: 'flex', alignItems: 'stretch', gap: 12, padding: '10px 14px' }}>
                    {/* Status-Dot */}
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', marginTop: 5,
                      background: host.autoConnect === false ? '#4a5568' : dotColor,
                      flexShrink: 0,
                      boxShadow: status === 'connected' ? `0 0 5px ${dotColor}` : 'none',
                    }} />

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#e9edf2', marginBottom: 2 }}>
                        {host.name}
                        {host.autoConnect === false && (
                          <span style={{ marginLeft: 8, fontSize: 11, color: '#4a5568', fontWeight: 400 }}>
                            {t('hostManager.autoConnectOff')}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#8896aa', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {host.host}:{host.satellite.wsPort}
                        </span>
                        <span style={{ color: dotColor }}>
                          {host.autoConnect === false ? t('status.disconnected') : statusLabel(status, t)}
                        </span>
                        {info && (
                          <span style={{ color: '#4a5568' }}>
                            Companion {info.companionVersion} · API {info.apiVersion}
                          </span>
                        )}
                      </div>
                      {host.notes && (
                        <div style={{ fontSize: 12, color: '#4a5568', marginTop: 2 }}>{host.notes}</div>
                      )}
                    </div>

                    {/* Aktionen — vertikal gestapelt rechts */}
                    {!isEditing && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0, justifyContent: 'center' }}>
                        {(status === 'connected' || status === 'connecting') ? (
                          <button
                            style={{ ...btnDisconnect, padding: '5px 12px' }}
                            title={t('hostManager.disconnect')}
                            onClick={() => saveSettings({ ...s, hosts: s.hosts.map((h) => h.id === host.id ? { ...h, autoConnect: false } : h) })}
                          >
                            {t('hostManager.disconnect')}
                          </button>
                        ) : (
                          <button
                            style={{ ...btnConnect, padding: '5px 12px' }}
                            title={t('hostManager.connect')}
                            onClick={() => saveSettings({ ...s, hosts: s.hosts.map((h) => h.id === host.id ? { ...h, autoConnect: true } : h) })}
                          >
                            {t('hostManager.connect')}
                          </button>
                        )}
                        <button style={{ ...btnSecondary, padding: '5px 12px' }} onClick={() => startEdit(host)}>{t('hostManager.edit')}</button>
                        <button style={{ ...btnDanger, padding: '5px 12px' }} onClick={() => confirmDelete(host)}>{t('hostManager.delete')}</button>
                      </div>
                    )}
                  </div>

                  {/* Inline-Edit-Form */}
                  {isEditing && (
                    <div style={{ padding: '0 14px 14px', borderTop: '1px solid #2a3344', paddingTop: 14 }}>
                      <HostForm value={formValue} onChange={setFormValue} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                        <button style={btnSecondary} onClick={cancelEdit}>{t('hostManager.cancel')}</button>
                        <button
                          style={{ ...btnPrimary, opacity: (!formValue.name.trim() || !formValue.host.trim()) ? 0.5 : 1 }}
                          onClick={saveEdit}
                          disabled={!formValue.name.trim() || !formValue.host.trim()}
                        >
                          {t('hostManager.save')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {status === 'caps-disabled' && (
                  <div style={{
                    marginTop: 4,
                    background: 'rgba(255,138,61,0.08)',
                    border: '1px solid #ff8a3d',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: '#ff8a3d',
                    lineHeight: 1.5,
                  }}>
                    <strong>{t('hostManager.capsDisabledTitle')}</strong>
                    {' '}{t('hostManager.capsDisabledPath')}
                  </div>
                )}
                </React.Fragment>
              )
            })}

            {/* Kein Host */}
            {hosts.length === 0 && editing !== 'new' && (
              <div style={{
                padding: '24px', textAlign: 'center',
                color: '#4a5568', fontSize: 14,
                border: '1px dashed #2a3344', borderRadius: 8,
              }}>
                {t('hostManager.noHosts')}
              </div>
            )}

            {/* Neuer Host Form */}
            {editing === 'new' && (
              <div style={{
                background: '#121821',
                border: '1px solid #4a9eff',
                borderRadius: 8,
                padding: 14,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#4a9eff', marginBottom: 12 }}>
                  {t('hostManager.addHost')}
                </div>
                <HostForm value={formValue} onChange={setFormValue} />
                <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                  <button style={btnSecondary} onClick={cancelEdit}>{t('hostManager.cancel')}</button>
                  <button
                    style={{ ...btnPrimary, opacity: (!formValue.name.trim() || !formValue.host.trim()) ? 0.5 : 1 }}
                    onClick={saveEdit}
                    disabled={!formValue.name.trim() || !formValue.host.trim()}
                  >
                    {t('hostManager.addHost')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={FOOTER}>
            <button
              style={{ ...btnPrimary, marginRight: 'auto' }}
              onClick={startAdd}
              disabled={editing !== null}
            >
              + {t('hostManager.addHost')}
            </button>
            <button style={btnSecondary} onClick={onClose}>{t('hostManager.cancel')}</button>
          </div>
        </div>
      </div>

      {/* Löschen-Warn-Dialog */}
      {deleteTarget && (
        <DeleteDialog
          hostName={deleteTarget.name}
          refCount={refCount(deleteTarget.id)}
          onConfirm={doDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}

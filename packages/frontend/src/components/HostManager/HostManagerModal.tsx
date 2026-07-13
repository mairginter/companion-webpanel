/**
 * HostManagerModal.tsx
 *
 * Modal zum Verwalten von Companion-Hosts:
 *  - Host-Liste mit Live-Verbindungsstatus + Companion-Version
 *  - Hinzufügen / Bearbeiten / Löschen von Hosts
 *  - Warn-Dialog bei Löschen eines referenzierten Hosts
 *  - Felder: Name, Host/IP, WS-Port (default 16623), Notes, Automatisch verbinden
 *  - Speichern direkt via saveSettings() → POST /api/settings
 *  - mDNS-Discovery: Browse läuft nur solange das Modal offen ist (Browse-on-demand);
 *    gefundene Companion-5.0-Instanzen erscheinen mit „+"-Button zum Übernehmen
 */
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { DiscoveredHost, HostProfile, Settings } from '@cwp/shared'

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
      <div style={{ display: 'grid', gridTemplateColumns: '120px 120px 1fr', gap: 12 }}>
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
          <label style={labelStyle} title={t('hostManager.httpPortHint')}>{t('hostManager.httpPort')}</label>
          <input
            style={inputStyle}
            type="number"
            min={1}
            max={65535}
            placeholder="8000"
            title={t('hostManager.httpPortHint')}
            value={value.httpPort ?? ''}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10)
              set({ httpPort: Number.isFinite(n) && n >= 1 && n <= 65535 ? n : undefined })
            }}
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

// ─── Host-Edit-Modal ─────────────────────────────────────────────────────────

interface HostEditModalProps {
  host: HostProfile | null        // null = neuer Host
  /** Vorbefüllung für neue Hosts (z.B. aus mDNS-Discovery) — nur bei host === null verwendet */
  prefill?: Partial<Omit<HostProfile, 'id'>>
  onSave: (host: HostProfile) => void
  onCancel: () => void
}

function HostEditModal({ host, prefill, onSave, onCancel }: HostEditModalProps) {
  const { t } = useTranslation()
  const [formValue, setFormValue] = useState<Omit<HostProfile, 'id'>>(
    host
      ? { name: host.name, host: host.host, satellite: host.satellite, httpPort: host.httpPort,
          notes: host.notes ?? '',
          autoConnect: host.autoConnect, showInToolbar: host.showInToolbar,
          gridCols: host.gridCols, gridRows: host.gridRows, maxPages: host.maxPages, pageNames: host.pageNames }
      : { ...emptyHost(), ...prefill }
  )

  const isNew = host === null
  const canSave = formValue.name.trim() !== '' && formValue.host.trim() !== ''

  function handleSave() {
    if (!canSave) return
    onSave({ id: host?.id ?? crypto.randomUUID(), ...formValue })
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}
    >
      <div style={{
        background: '#1a2030', border: '1px solid #2a3344', borderRadius: 12,
        width: 560, maxWidth: '90vw', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #2a3344', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#e9edf2' }}>
            {isNew ? t('hostManager.addHost') : t('hostManager.editHost')}
          </span>
          <button style={{ background: 'none', border: 'none', color: '#8896aa', fontSize: 18, cursor: 'pointer', lineHeight: 1 }} onClick={onCancel}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <HostForm value={formValue} onChange={setFormValue} />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #2a3344', flexShrink: 0 }}>
          <button style={btnSecondary} onClick={onCancel}>{t('hostManager.cancel')}</button>
          <button
            style={{ ...btnPrimary, opacity: canSave ? 1 : 0.5 }}
            disabled={!canSave}
            onClick={handleSave}
          >
            {isNew ? t('hostManager.addHost') : t('hostManager.save')}
          </button>
        </div>
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
  const discoveredHosts = useAppStore((s) => s.discoveredHosts)

  // Welcher Host wird gerade bearbeitet (null = keiner, 'new' = neuer Host, HostProfile = vorhandener Host)
  const [editTarget, setEditTarget] = useState<HostProfile | null | 'new'>(null)
  const [deleteTarget, setDeleteTarget] = useState<HostProfile | null>(null)
  // Vorbefüllung fürs Edit-Modal wenn ein Discovery-Treffer übernommen wird
  const [prefill, setPrefill] = useState<Partial<Omit<HostProfile, 'id'>> | undefined>(undefined)

  // Browse-on-demand: mDNS-Discovery läuft nur solange dieses Modal offen ist.
  // Die Ergebnisse kommen als 'discovery'-Broadcast über den bestehenden WS in den Store.
  useEffect(() => {
    fetch('/api/discovery/start', { method: 'POST' }).catch(() => { /* Backend offline — Sektion bleibt leer */ })
    return () => {
      fetch('/api/discovery/stop', { method: 'POST' }).catch(() => { /* dito */ })
    }
  }, [])

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

  function openAdd() { setPrefill(undefined); setEditTarget('new') }
  function openEdit(host: HostProfile) { setPrefill(undefined); setEditTarget(host) }

  // Discovery-Treffer übernehmen: Edit-Modal mit Name/IP/Port vorbefüllt öffnen
  function openAddDiscovered(d: DiscoveredHost) {
    setPrefill({ name: d.name, host: d.address, satellite: { wsPort: d.port } })
    setEditTarget('new')
  }

  // Nur Instanzen anbieten die noch nicht als Host angelegt sind (Match über IP)
  const unknownDiscovered = discoveredHosts.filter(
    (d) => !hosts.some((h) => h.host === d.address),
  )

  function handleEditSave(savedHost: HostProfile) {
    const isNew = !s.hosts.some((h) => h.id === savedHost.id)
    const next: Settings = isNew
      ? { ...s, hosts: [...s.hosts, savedHost] }
      : { ...s, hosts: s.hosts.map((h) => (h.id === savedHost.id ? savedHost : h)) }
    saveSettings(next)
    setEditTarget(null)
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

              return (
                <React.Fragment key={host.id}>
                <div style={{
                  background: '#121821',
                  border: '1px solid #2a3344',
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
                      <button style={{ ...btnSecondary, padding: '5px 12px' }} onClick={() => openEdit(host)}>{t('hostManager.edit')}</button>
                      <button style={{ ...btnDanger, padding: '5px 12px' }} onClick={() => confirmDelete(host)}>{t('hostManager.delete')}</button>
                    </div>
                  </div>

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
            {hosts.length === 0 && (
              <div style={{
                padding: '24px', textAlign: 'center',
                color: '#4a5568', fontSize: 14,
                border: '1px dashed #2a3344', borderRadius: 8,
              }}>
                {t('hostManager.noHosts')}
              </div>
            )}

            {/* Gefundene Companion-Instanzen (mDNS, ab Companion 5.0) */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: '#8896aa', fontWeight: 600, marginBottom: 6 }}>
                {t('hostManager.discoveredTitle')}
              </div>
              {unknownDiscovered.length === 0 ? (
                <div style={{ fontSize: 12, color: '#4a5568', lineHeight: 1.5 }}>
                  {t('hostManager.discoveredEmpty')}
                  <br />
                  <span style={{ fontSize: 11 }}>{t('hostManager.discoveryHint')}</span>
                </div>
              ) : (
                unknownDiscovered.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: '#121821', border: '1px solid #2a3344', borderRadius: 8,
                      padding: '8px 14px', marginBottom: 6,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e9edf2' }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: '#8896aa', display: 'flex', gap: 10 }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{d.address}:{d.port}</span>
                        {d.apiVersion && (
                          <span style={{
                            fontSize: 11, color: '#21d07a', border: '1px solid #21d07a',
                            borderRadius: 4, padding: '0 5px',
                          }}>
                            API {d.apiVersion}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      style={{ ...btnConnect, padding: '5px 12px', flexShrink: 0 }}
                      title={t('hostManager.addDiscovered')}
                      onClick={() => openAddDiscovered(d)}
                    >
                      + {t('hostManager.addDiscovered')}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={FOOTER}>
            <button
              style={{ ...btnPrimary, marginRight: 'auto' }}
              onClick={openAdd}
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

      {/* Host-Edit-Modal */}
      {editTarget !== null && (
        <HostEditModal
          host={editTarget === 'new' ? null : editTarget}
          prefill={prefill}
          onSave={handleEditSave}
          onCancel={() => setEditTarget(null)}
        />
      )}
    </>
  )
}

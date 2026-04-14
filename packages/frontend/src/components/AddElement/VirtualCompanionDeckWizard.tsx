/**
 * VirtualCompanionDeckWizard.tsx
 *
 * 3-Schritt-Wizard zum Erstellen eines virtualCompanionDeck-Elements:
 *   Schritt 1 — Name (surfaceName)
 *   Schritt 2 — Grid-Größe (cols × rows) + Live-Vorschau
 *   Schritt 3 — Host-Auswahl
 *
 * onConfirm liefert ein fertiges VirtualCompanionDeckElement (ohne id) zurück.
 */
import React, { useState } from 'react'
import { VirtualCompanionDeckElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { NumericInput } from '../PropertiesPanel/NumericInput'

interface Props {
  canvasPos: { x: number; y: number }
  onConfirm: (draft: Omit<VirtualCompanionDeckElement, 'id'>) => void
  onClose: () => void
}

type Step = 1 | 2 | 3

function generateDeviceId(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `cwp-${hex}`
}

export function VirtualCompanionDeckWizard({ canvasPos, onConfirm, onClose }: Props) {
  const settings = useAppStore((s) => s.settings)
  const sessionStatus = useAppStore((s) => s.sessionStatus)

  const [step, setStep] = useState<Step>(1)
  const [surfaceName, setSurfaceName] = useState('Webpanel Surface')
  const [cols, setCols] = useState(8)
  const [rows, setRows] = useState(4)
  const [selectedHostId, setSelectedHostId] = useState<string>(
    settings?.hosts.find(h => sessionStatus[h.id] === 'connected')?.id
    ?? settings?.hosts[0]?.id
    ?? '',
  )

  const hosts = settings?.hosts ?? []

  const handleCreate = () => {
    const deviceId = generateDeviceId()
    // Default-Größe: 60px pro Button + Padding + Gap
    const btnSize = 60
    const w = cols * btnSize + 2 * 8 + (cols - 1) * 5
    const h = rows * btnSize + 2 * 8 + (rows - 1) * 5
    const draft: Omit<VirtualCompanionDeckElement, 'id'> = {
      type: 'virtualCompanionDeck',
      x: Math.round(canvasPos.x),
      y: Math.round(canvasPos.y),
      w, h, z: 0,
      locked: false,
      hostId: selectedHostId,
      deviceId,
      surfaceName,
      grid: { cols, rows },
      style: { fill: '#1e3a5f', opacity: 0.85, borderRadius: 8, padding: 8, gap: 5 },
      render: { showBitmap: false, showText: true, showBgColor: true, borderRadius: 4, fontSize: 11, textAlign: 'bottom' },
    }
    onConfirm(draft)
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1090,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  const dialogStyle: React.CSSProperties = {
    background: '#1c1c2e',
    border: '1px solid #333',
    borderRadius: 8,
    width: 380,
    overflow: 'hidden',
  }

  const headerStyle: React.CSSProperties = {
    background: '#252540',
    padding: '12px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: '1px solid #333',
  }

  const stepBarStyle: React.CSSProperties = {
    display: 'flex',
    padding: '12px 16px',
    borderBottom: '1px solid #222',
    gap: 0,
  }

  const bodyStyle: React.CSSProperties = { padding: 16 }

  const footerStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderTop: '1px solid #222',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }

  const labelStyle: React.CSSProperties = { color: '#888', fontSize: 11, display: 'block', marginBottom: 5 }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#111', border: '1px solid #333', borderRadius: 4,
    padding: '7px 10px', color: '#ddd', fontSize: 12, boxSizing: 'border-box',
  }

  const btnPrimary: React.CSSProperties = {
    background: '#4a9eff', border: 'none', color: '#fff', borderRadius: 4,
    padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  }

  const btnSecondary: React.CSSProperties = {
    background: 'transparent', border: '1px solid #333',
    color: '#888', borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
  }

  const renderStepDot = (n: Step) => {
    const active = step === n
    const done = step > n
    return (
      <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: done || active ? '#4a9eff' : '#222',
          border: done || active ? 'none' : '1px solid #333',
          color: done || active ? '#fff' : '#555',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 600,
          boxShadow: active ? '0 0 0 3px #4a9eff33' : 'none',
        }}>
          {done ? '\u2713' : n}
        </div>
        <div style={{ fontSize: 9, color: active ? '#4a9eff' : '#555' }}>
          {n === 1 ? 'Name' : n === 2 ? 'Grid' : 'Host'}
        </div>
      </div>
    )
  }

  return (
    <div style={overlayStyle} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={dialogStyle}>
        <div style={headerStyle}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Virtual Companion Deck</span>
          <span style={{ color: '#555', cursor: 'pointer', fontSize: 16 }} onClick={onClose}>{'\u2715'}</span>
        </div>

        <div style={stepBarStyle}>
          {([1, 2, 3] as Step[]).map(renderStepDot)}
        </div>

        <div style={bodyStyle}>
          {step === 1 && (
            <div>
              <label style={labelStyle}>Surface-Name (erscheint in Companions Surface-Config)</label>
              <input
                style={inputStyle}
                value={surfaceName}
                onChange={e => setSurfaceName(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <label style={labelStyle}>Grid-Größe (Spalten × Zeilen)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <NumericInput value={cols} onChange={setCols} min={1} max={32} compact />
                <span style={{ color: '#555', fontSize: 14 }}>{'\u00d7'}</span>
                <NumericInput value={rows} onChange={setRows} min={1} max={32} compact />
              </div>
              {/* Grid-Vorschau */}
              <div style={{ marginTop: 12, background: '#111', border: '1px solid #222', borderRadius: 4, padding: 10 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(cols, 16)}, 1fr)`,
                  gap: 2,
                }}>
                  {Array.from({ length: Math.min(cols * rows, 128) }, (_, i) => (
                    <div key={i} style={{ aspectRatio: '1', background: '#2a2a2a', borderRadius: 2 }} />
                  ))}
                </div>
                <div style={{ color: '#555', fontSize: 10, marginTop: 6, textAlign: 'center' }}>
                  {cols * rows} Buttons (KEYS_TOTAL={cols * rows}, KEYS_PER_ROW={cols})
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <label style={labelStyle}>Companion-Host auswählen</label>
              {hosts.length === 0 && (
                <div style={{ color: '#888', fontSize: 12 }}>Keine Hosts konfiguriert. Bitte zuerst einen Host hinzufügen.</div>
              )}
              {hosts.map(host => (
                <div
                  key={host.id}
                  onClick={() => setSelectedHostId(host.id)}
                  style={{
                    background: selectedHostId === host.id ? '#0d1f3a' : '#111',
                    border: `1px solid ${selectedHostId === host.id ? '#4a9eff' : '#333'}`,
                    borderRadius: 4, padding: '8px 10px', marginBottom: 6, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: sessionStatus[host.id] === 'connected' ? '#4caf50' : '#ff9800',
                    boxShadow: sessionStatus[host.id] === 'connected' ? '0 0 4px #4caf5088' : 'none',
                  }} />
                  <span style={{ color: '#ddd', fontSize: 12, flex: 1 }}>{host.name}</span>
                  <span style={{ color: '#555', fontSize: 10 }}>{host.host}:{host.satellite.wsPort}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={footerStyle}>
          <button style={btnSecondary} onClick={step === 1 ? onClose : () => setStep((s) => (s - 1) as Step)}>
            {step === 1 ? 'Abbrechen' : 'Zur\u00fcck'}
          </button>
          {step < 3 ? (
            <button
              style={{ ...btnPrimary, opacity: step === 1 && !surfaceName.trim() ? 0.5 : 1 }}
              disabled={step === 1 && !surfaceName.trim()}
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              Weiter {'\u2192'}
            </button>
          ) : (
            <button
              style={{ ...btnPrimary, opacity: !selectedHostId ? 0.5 : 1 }}
              disabled={!selectedHostId}
              onClick={handleCreate}
            >
              Erstellen {'\u2713'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

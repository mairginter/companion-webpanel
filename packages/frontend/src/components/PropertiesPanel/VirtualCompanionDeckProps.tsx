/**
 * VirtualCompanionDeckProps.tsx
 *
 * PropertiesPanel-Block für virtualCompanionDeck-Elemente.
 * Sektionen: Surface (Name, Grid, Host, DeviceID), Darstellung, Button-Darstellung.
 */
import React, { useState } from 'react'
import { VirtualCompanionDeckElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { NumericInput } from './NumericInput'

interface Props {
  element: VirtualCompanionDeckElement
  panelId: string
}

function generateDeviceId(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `cwp-${hex}`
}

export function VirtualCompanionDeckProps({ element, panelId }: Props) {
  const updateElement = useAppStore((s) => s.updateElement)
  const settings = useAppStore((s) => s.settings)
  const vStatus = useAppStore((s) => s.getVirtualSessionStatus(element.deviceId))

  const [confirmNewId, setConfirmNewId] = useState(false)

  const hosts = settings?.hosts ?? []

  const update = (patch: Partial<VirtualCompanionDeckElement>) =>
    updateElement(panelId, element.id, patch)

  const updateStyle = (patch: Partial<VirtualCompanionDeckElement['style']>) =>
    update({ style: { ...element.style, ...patch } })

  const updateRender = (patch: Partial<NonNullable<VirtualCompanionDeckElement['render']>>) =>
    update({ render: { ...element.render, ...patch } })

  const labelStyle: React.CSSProperties = { color: '#888', fontSize: 11 }
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }
  const inputStyle: React.CSSProperties = {
    background: '#111', border: '1px solid #333', borderRadius: 3,
    padding: '3px 7px', color: '#ddd', fontSize: 11, textAlign: 'center',
  }
  const sectionTitleStyle: React.CSSProperties = { color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }

  const statusColor = vStatus === 'connected' ? '#4caf50' : vStatus === 'connecting' ? '#ff9800' : '#ff5555'

  return (
    <div style={{ fontSize: 12 }}>

      {/* Surface */}
      <div style={{ marginBottom: 12 }}>
        <div style={sectionTitleStyle}>Surface</div>

        <div style={rowStyle}>
          <span style={labelStyle}>Name</span>
          <input
            style={{ ...inputStyle, minWidth: 130 }}
            value={element.surfaceName}
            onChange={e => update({ surfaceName: e.target.value })}
          />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Grid</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <NumericInput value={element.grid.cols} onChange={v => update({ grid: { ...element.grid, cols: v } })} min={1} max={32} compact />
            <span style={{ color: '#555', fontSize: 11 }}>×</span>
            <NumericInput value={element.grid.rows} onChange={v => update({ grid: { ...element.grid, rows: v } })} min={1} max={32} compact />
          </div>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Host</span>
          <select
            style={{ ...inputStyle, minWidth: 130 }}
            value={element.hostId}
            onChange={e => update({ hostId: e.target.value })}
          >
            {hosts.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Status</span>
          <span style={{ fontSize: 11, color: statusColor }}>&#9679; {vStatus ?? 'unbekannt'}</span>
        </div>

        <div style={{ marginBottom: 7 }}>
          <div style={{ ...labelStyle, marginBottom: 4 }}>Device ID</div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <div style={{
              ...inputStyle, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 10, color: '#666',
            }}>
              {element.deviceId}
            </div>
            {!confirmNewId ? (
              <button
                onClick={() => setConfirmNewId(true)}
                style={{ ...inputStyle, color: '#888', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                &#8635; Neu
              </button>
            ) : (
              <button
                onClick={() => { update({ deviceId: generateDeviceId() }); setConfirmNewId(false) }}
                style={{ ...inputStyle, color: '#ff8a3d', cursor: 'pointer', whiteSpace: 'nowrap', borderColor: '#ff8a3d' }}
              >
                Best&auml;tigen
              </button>
            )}
          </div>
          {confirmNewId && (
            <div style={{ color: '#ff8a3d', fontSize: 10, marginTop: 3 }}>
              Neue ID setzt die Companion-Surface-Zuweisung zur&uuml;ck.{' '}
              <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setConfirmNewId(false)}>Abbrechen</span>
            </div>
          )}
        </div>
      </div>

      {/* Darstellung */}
      <div style={{ borderTop: '1px solid #222', paddingTop: 10, marginBottom: 12 }}>
        <div style={sectionTitleStyle}>Darstellung</div>

        <div style={rowStyle}>
          <span style={labelStyle}>Hintergrund</span>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <div style={{ width: 14, height: 14, borderRadius: 2, background: element.style.fill, border: '1px solid #444', cursor: 'pointer' }} />
            <input
              style={{ ...inputStyle, width: 70 }}
              value={element.style.fill}
              onChange={e => updateStyle({ fill: e.target.value })}
            />
          </div>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Deckkraft</span>
          <NumericInput
            value={Math.round(element.style.opacity * 100)}
            onChange={v => updateStyle({ opacity: Math.max(0, Math.min(1, v / 100)) })}
            min={0} compact
          />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Eckenradius</span>
          <NumericInput value={element.style.borderRadius} onChange={v => updateStyle({ borderRadius: v })} min={0} compact />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Padding</span>
          <NumericInput value={element.style.padding} onChange={v => updateStyle({ padding: v })} min={0} compact />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Gap</span>
          <NumericInput value={element.style.gap} onChange={v => updateStyle({ gap: v })} min={0} compact />
        </div>
      </div>

      {/* Button-Darstellung */}
      <div style={{ borderTop: '1px solid #222', paddingTop: 10 }}>
        <div style={sectionTitleStyle}>Button-Darstellung</div>

        <div style={rowStyle}>
          <span style={labelStyle}>Bitmap</span>
          <input
            type="checkbox"
            checked={element.render?.showBitmap === true}
            onChange={e => updateRender({ showBitmap: e.target.checked })}
          />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Text-Overlay</span>
          <input
            type="checkbox"
            checked={element.render?.showText !== false}
            onChange={e => updateRender({ showText: e.target.checked })}
          />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Button-Radius</span>
          <NumericInput value={element.render?.borderRadius ?? 4} onChange={v => updateRender({ borderRadius: v })} min={0} compact />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Schriftgr&ouml;&szlig;e</span>
          <NumericInput value={element.render?.fontSize ?? 11} onChange={v => updateRender({ fontSize: v })} min={6} compact />
        </div>
      </div>

    </div>
  )
}

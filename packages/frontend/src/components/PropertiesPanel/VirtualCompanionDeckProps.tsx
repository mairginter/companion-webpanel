/**
 * VirtualCompanionDeckProps.tsx
 *
 * PropertiesPanel-Block für virtualCompanionDeck-Elemente.
 * Sektionen: Surface (Name, Grid, Host, Status, DeviceID), Darstellung, Button-Darstellung.
 * Layout angelehnt an CompanionButtonProps.tsx (lbl/row/sel Style-Variablen, kompaktere Checkboxen).
 */
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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

  // Shared style tokens — entsprechen CompanionButtonProps.tsx
  const lbl: React.CSSProperties = { fontSize: 12, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }
  const sel: React.CSSProperties = { background: '#1a2030', border: '1px solid #2a3344', color: '#e9edf2', borderRadius: 4, padding: '8px 10px', fontSize: 14 }

  const statusColor = vStatus === 'connected' ? '#4caf50' : vStatus === 'connecting' ? '#ff9800' : '#ff5555'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── Surface ── */}
      <div style={lbl}>{t('propertiesPanel.surface')}</div>

      {/* Name */}
      <input
        style={{ background: '#1a2030', border: '1px solid #2a3344', borderRadius: 4, padding: '8px 10px', color: '#e9edf2', fontSize: 14, width: '100%', boxSizing: 'border-box' }}
        value={element.surfaceName}
        onChange={e => update({ surfaceName: e.target.value })}
        placeholder={t('propertiesPanel.surfaceName')}
      />

      {/* Grid */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.grid')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <NumericInput value={element.grid.cols} onChange={v => update({ grid: { ...element.grid, cols: v } })} min={1} max={32} compact />
          <span style={{ color: '#4a5568', fontSize: 12 }}>×</span>
          <NumericInput value={element.grid.rows} onChange={v => update({ grid: { ...element.grid, rows: v } })} min={1} max={32} compact />
        </div>
      </div>

      {/* Host */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.host')}</span>
        <select
          style={sel}
          value={element.hostId}
          onChange={e => update({ hostId: e.target.value })}
        >
          {hosts.map(h => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.status')}</span>
        <span style={{ fontSize: 13, color: statusColor }}>● {vStatus ?? '…'}</span>
      </div>

      {/* Device ID */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={lbl}>{t('propertiesPanel.deviceId')}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{
            background: '#1a2030', border: '1px solid #2a3344', borderRadius: 4, padding: '8px 10px',
            color: '#4a5568', fontSize: 11, fontFamily: 'monospace', flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {element.deviceId}
          </div>
          {!confirmNewId ? (
            <button
              onClick={() => setConfirmNewId(true)}
              style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #2a3344', background: '#1a2030', color: '#4a5568', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {t('propertiesPanel.newId')}
            </button>
          ) : (
            <button
              onClick={() => { update({ deviceId: generateDeviceId() }); setConfirmNewId(false) }}
              style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ff8a3d', background: '#1a2030', color: '#ff8a3d', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {t('propertiesPanel.confirm')}
            </button>
          )}
        </div>
        {confirmNewId && (
          <div style={{ color: '#ff8a3d', fontSize: 11, marginTop: 2 }}>
            {t('propertiesPanel.newIdWarning')}{' '}
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setConfirmNewId(false)}>{t('propertiesPanel.cancelAction')}</span>
          </div>
        )}
      </div>

      {/* ── Separator ── */}
      <div style={{ borderTop: '1px solid #1e2530' }} />

      {/* ── Darstellung ── */}
      <div style={lbl}>{t('propertiesPanel.display')}</div>

      {/* Hintergrundfarbe */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.background')}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="color"
            value={element.style.fill}
            onChange={e => updateStyle({ fill: e.target.value })}
            style={{ width: 24, height: 24, borderRadius: 3, border: '1px solid #2a3344', cursor: 'pointer', padding: 2, background: '#1a2030', flexShrink: 0 }}
          />
          <input
            style={{ background: '#1a2030', border: '1px solid #2a3344', borderRadius: 4, padding: '6px 8px', color: '#e9edf2', fontSize: 13, width: 80, textAlign: 'center' }}
            value={element.style.fill}
            onChange={e => updateStyle({ fill: e.target.value })}
          />
        </div>
      </div>

      {/* Deckkraft */}
      <NumericInput
        label={`${t('propertiesPanel.opacity')} %`}
        value={Math.round(element.style.opacity * 100)}
        onChange={v => updateStyle({ opacity: Math.max(0, Math.min(1, v / 100)) })}
        min={0}
      />

      {/* Eckenradius */}
      <NumericInput
        label={t('propertiesPanel.borderRadius')}
        value={element.style.borderRadius}
        onChange={v => updateStyle({ borderRadius: v })}
        min={0}
      />

      {/* Padding */}
      <NumericInput
        label={t('propertiesPanel.padding')}
        value={element.style.padding}
        onChange={v => updateStyle({ padding: v })}
        min={0}
      />

      {/* Gap */}
      <NumericInput
        label={t('propertiesPanel.gap')}
        value={element.style.gap}
        onChange={v => updateStyle({ gap: v })}
        min={0}
      />

      {/* ── Separator ── */}
      <div style={{ borderTop: '1px solid #1e2530' }} />

      {/* ── Button-Darstellung ── */}
      <div style={lbl}>{t('propertiesPanel.buttonDisplay')}</div>

      {/* Bitmap */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.showBitmap')}</span>
        <input
          type="checkbox"
          style={{ width: 20, height: 20, cursor: 'pointer' }}
          checked={element.render?.showBitmap === true}
          onChange={e => updateRender({ showBitmap: e.target.checked })}
        />
      </div>

      {element.render?.showBitmap === true && (
        <div style={row}>
          <span style={lbl}>{t('propertiesPanel.scaleBitmap')}</span>
          <input
            type="checkbox"
            style={{ width: 20, height: 20, cursor: 'pointer' }}
            checked={element.render?.scaleBitmap !== false}
            onChange={e => updateRender({ scaleBitmap: e.target.checked })}
          />
        </div>
      )}

      {/* Hintergrundfarbe */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.showBgColor')}</span>
        <input
          type="checkbox"
          style={{ width: 20, height: 20, cursor: 'pointer' }}
          checked={element.render?.showBgColor !== false}
          onChange={e => updateRender({ showBgColor: e.target.checked })}
        />
      </div>

      {/* Text-Overlay */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.textOverlay')}</span>
        <input
          type="checkbox"
          style={{ width: 20, height: 20, cursor: 'pointer' }}
          checked={element.render?.showText !== false}
          onChange={e => updateRender({ showText: e.target.checked })}
        />
      </div>

      {element.render?.showText !== false && (
        <div style={row}>
          <span style={lbl}>{t('propertiesPanel.textPosition')}</span>
          <select
            style={sel}
            value={element.render?.textAlign ?? 'bottom'}
            onChange={e => updateRender({ textAlign: e.target.value as 'top' | 'center' | 'bottom' })}
          >
            <option value="top">{t('propertiesPanel.top')}</option>
            <option value="center">{t('propertiesPanel.center')}</option>
            <option value="bottom">{t('propertiesPanel.bottom')}</option>
          </select>
        </div>
      )}

      {/* Button-Radius */}
      <NumericInput
        label={t('propertiesPanel.buttonRadius')}
        value={element.render?.borderRadius ?? 4}
        onChange={v => updateRender({ borderRadius: v })}
        min={0}
      />

      {/* Schriftgröße */}
      <NumericInput
        label={t('propertiesPanel.fontSize')}
        value={element.render?.fontSize ?? 11}
        onChange={v => updateRender({ fontSize: v })}
        min={6}
        unit="px"
      />

      {/* Leer-Button Farbe */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.emptyButtonColor')}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="color"
            value={element.render?.emptyButtonColor ?? '#111111'}
            onChange={e => updateRender({ emptyButtonColor: e.target.value })}
            style={{ width: 24, height: 24, borderRadius: 3, border: '1px solid #2a3344', cursor: 'pointer', padding: 2, background: '#1a2030', flexShrink: 0 }}
          />
          <input
            style={{ background: '#1a2030', border: '1px solid #2a3344', borderRadius: 4, padding: '6px 8px', color: '#e9edf2', fontSize: 13, width: 80, textAlign: 'center' }}
            value={element.render?.emptyButtonColor ?? '#111111'}
            onChange={e => updateRender({ emptyButtonColor: e.target.value })}
          />
        </div>
      </div>

    </div>
  )
}

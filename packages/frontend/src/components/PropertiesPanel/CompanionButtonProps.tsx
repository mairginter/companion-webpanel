import React, { useState } from 'react'
import { CompanionButtonElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { NumericInput } from './NumericInput'
import { CompanionButtonPickerDialog } from '../AddElement/CompanionButtonPickerDialog'

interface Props { element: CompanionButtonElement; panelId: string; side?: 'left' | 'right'; panelWidth?: number }

export function CompanionButtonProps({ element, panelId, side = 'right', panelWidth = 320 }: Props) {
  const setSettings = useAppStore((s) => s.setSettings)
  const settings = useAppStore((s) => s.settings)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const r = element.render ?? {}
  const [pickerOpen, setPickerOpen] = useState(false)

  const hostConnected = Object.entries(sessionStatus).some(
    ([k, v]) => k.startsWith(element.ref.hostId + ':') && v === 'connected',
  )

  const updateRender = (patch: Partial<NonNullable<CompanionButtonElement['render']>>) => {
    if (!settings) return
    setSettings({
      ...settings,
      panels: settings.panels.map((p) =>
        p.id !== panelId ? p : {
          ...p,
          elements: p.elements.map((el) =>
            el.id !== element.id ? el : { ...el, render: { ...r, ...patch } },
          ),
        },
      ),
    })
  }

  const updateRef = (patch: Partial<CompanionButtonElement['ref']>) => {
    if (!settings) return
    setSettings({
      ...settings,
      panels: settings.panels.map((p) =>
        p.id !== panelId ? p : {
          ...p,
          elements: p.elements.map((el) =>
            el.id !== element.id ? el : { ...el, ref: { ...element.ref, ...patch } },
          ),
        },
      ),
    })
  }

  const hostName = settings?.hosts.find((h) => h.id === element.ref.hostId)?.name ?? element.ref.hostId

  const lbl: React.CSSProperties = { fontSize: 12, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }
  const tog = (v: boolean | undefined, d: boolean) => v === undefined ? d : v
  const sel: React.CSSProperties = { background: '#1a2030', border: '1px solid #2a3344', color: '#e9edf2', borderRadius: 4, padding: '8px 10px', fontSize: 14 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ ...lbl, marginBottom: 2 }}>CompanionButton</div>

      {/* Ref: visueller Picker */}
      <div style={{ background: '#121821', borderRadius: 6, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={lbl}>Companion Ref</div>
        <div style={{ fontSize: 12, color: '#8896aa' }}>
          <span style={{ color: '#e9edf2' }}>{hostName}</span>
          {' · '}
          <span style={{ color: '#e9edf2' }}>P{element.ref.page}</span>
          {' · '}
          R{element.ref.row + 1} / C{element.ref.col + 1}
        </div>
        <button
          onClick={() => hostConnected && setPickerOpen(true)}
          disabled={!hostConnected}
          style={{
            padding: '10px 14px', borderRadius: 6, border: '1px solid #2a3344',
            background: '#1a2030', color: hostConnected ? '#4a9eff' : '#4a5568', fontSize: 13,
            cursor: hostConnected ? 'pointer' : 'not-allowed', textAlign: 'center', touchAction: 'manipulation',
          }}
        >
          {hostConnected ? 'Ändern…' : 'Host offline'}
        </button>
      </div>

      <div style={row}>
        <span style={lbl}>Show Background</span>
        <input type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }} checked={tog(r.showBgColor, true)} onChange={(e) => updateRender({ showBgColor: e.target.checked })} />
      </div>
      <div style={row}>
        <span style={lbl}>Show Bitmap</span>
        <input type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }} checked={tog(r.showBitmap, false)} onChange={(e) => updateRender({ showBitmap: e.target.checked })} />
      </div>
      <div style={row}>
        <span style={lbl}>Show Text</span>
        <input type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }} checked={tog(r.showText, true)} onChange={(e) => updateRender({ showText: e.target.checked })} />
      </div>
      <div style={row}>
        <span style={lbl}>Text-Align</span>
        <select value={r.textAlign ?? 'bottom'} style={sel}
          onChange={(e) => updateRender({ textAlign: e.target.value as 'top' | 'center' | 'bottom' })}>
          <option value="top">Top</option>
          <option value="center">Center</option>
          <option value="bottom">Bottom</option>
        </select>
      </div>
      <NumericInput label="Border-Radius" value={r.borderRadius ?? 6} min={0}
        onChange={(v) => updateRender({ borderRadius: v })} />
      <NumericInput label="Font-Size" value={r.fontSize ?? 11} min={6} unit="px"
        onChange={(v) => updateRender({ fontSize: v })} />

      {pickerOpen && (
        <CompanionButtonPickerDialog
          confirmLabel="Übernehmen"
          initialRef={{ hostId: element.ref.hostId, page: element.ref.page }}
          onConfirm={(ref) => { updateRef(ref); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
          alignSide={side}
          panelWidth={panelWidth}
        />
      )}
    </div>
  )
}

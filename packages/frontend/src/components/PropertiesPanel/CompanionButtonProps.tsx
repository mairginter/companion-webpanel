import React from 'react'
import { CompanionButtonElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { NumericInput } from './NumericInput'

interface Props { element: CompanionButtonElement; panelId: string }

export function CompanionButtonProps({ element, panelId }: Props) {
  const setSettings = useAppStore((s) => s.setSettings)
  const settings = useAppStore((s) => s.settings)
  const r = element.render ?? {}

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

  const lbl: React.CSSProperties = { fontSize: 9, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }
  const tog = (v: boolean | undefined, d: boolean) => v === undefined ? d : v
  const sel: React.CSSProperties = { background: '#1a2030', border: '1px solid #2a3344', color: '#e9edf2', borderRadius: 3, padding: '2px 4px', fontSize: 11 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ ...lbl, marginBottom: 2 }}>CompanionButton</div>
      <div style={row}>
        <span style={lbl}>Show Background</span>
        <input type="checkbox" checked={tog(r.showBgColor, true)} onChange={(e) => updateRender({ showBgColor: e.target.checked })} />
      </div>
      <div style={row}>
        <span style={lbl}>Show Bitmap</span>
        <input type="checkbox" checked={tog(r.showBitmap, false)} onChange={(e) => updateRender({ showBitmap: e.target.checked })} />
      </div>
      <div style={row}>
        <span style={lbl}>Show Text</span>
        <input type="checkbox" checked={tog(r.showText, true)} onChange={(e) => updateRender({ showText: e.target.checked })} />
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
    </div>
  )
}

/**
 * CompanionButtonMultiProps.tsx
 *
 * Batch-Edit-Panel für mehrere selektierte CompanionButton-Elemente.
 * Zeigt gemeinsame Werte an und ermöglicht das gleichzeitige Setzen von:
 * Host, showBgColor, showBitmap, showText, textAlign, borderRadius,
 * physicalStyle (Dome), forceBlackCap (Broadcast-LED), fontSize, bitmapSize.
 *
 * Mixed-State (verschiedene Werte in der Selektion) wird via Indeterminate-Checkbox
 * bzw. "—"-Platzhalter in Inputs/Selects angezeigt.
 */
import React, { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CompanionButtonElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'

interface Props {
  elements: CompanionButtonElement[]
  panelId: string
}

// Returns the common value if all elements share it, or null if mixed.
function common<T>(elements: CompanionButtonElement[], getter: (el: CompanionButtonElement) => T): T | null {
  if (elements.length === 0) return null
  const vals = elements.map(getter)
  return vals.every((v) => v === vals[0]) ? vals[0] : null
}

// Checkbox that supports indeterminate (mixed) state.
function MixedCheckbox({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = value === null
  }, [value])
  return (
    <input
      type="checkbox"
      ref={ref}
      checked={value === true}
      onChange={(e) => onChange(e.target.checked)}
      style={{ width: 20, height: 20, cursor: 'pointer' }}
    />
  )
}

export function CompanionButtonMultiProps({ elements, panelId }: Props) {
  const { t } = useTranslation()
  const setSettings = useAppStore((s) => s.setSettings)
  const settings = useAppStore((s) => s.settings)
  const hosts = settings?.hosts ?? []

  const lbl: React.CSSProperties = { fontSize: 12, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }
  const sel: React.CSSProperties = { background: '#1a2030', border: '1px solid #2a3344', color: '#e9edf2', borderRadius: 4, padding: '8px 10px', fontSize: 14 }

  // Patch render fields on all selected companionButton elements
  const patchRender = (patch: Partial<NonNullable<CompanionButtonElement['render']>>) => {
    if (!settings) return
    const ids = new Set(elements.map((e) => e.id))
    setSettings({
      ...settings,
      panels: settings.panels.map((p) =>
        p.id !== panelId ? p : {
          ...p,
          elements: p.elements.map((el) =>
            el.type !== 'companionButton' || !ids.has(el.id)
              ? el
              : { ...el, render: { ...(el as CompanionButtonElement).render, ...patch } },
          ),
        },
      ),
    })
  }

  // Patch ref.hostId on all selected elements
  const patchHostId = (hostId: string) => {
    if (!settings) return
    const ids = new Set(elements.map((e) => e.id))
    setSettings({
      ...settings,
      panels: settings.panels.map((p) =>
        p.id !== panelId ? p : {
          ...p,
          elements: p.elements.map((el) =>
            el.type !== 'companionButton' || !ids.has(el.id)
              ? el
              : { ...el, ref: { ...(el as CompanionButtonElement).ref, hostId } },
          ),
        },
      ),
    })
  }

  const r = (el: CompanionButtonElement) => el.render ?? {}
  const tog = (v: boolean | undefined, d: boolean) => v === undefined ? d : v

  const commonHostId = common(elements, (el) => el.ref.hostId)
  const commonShowBgColor = common(elements, (el) => tog(r(el).showBgColor, true))
  const commonShowBitmap = common(elements, (el) => tog(r(el).showBitmap, false))
  const commonShowText = common(elements, (el) => tog(r(el).showText, true))
  const commonTextAlign = common(elements, (el) => r(el).textAlign ?? 'center')
  const commonBorderRadius = common(elements, (el) => r(el).borderRadius)
  const commonPhysicalStyle = common(elements, (el) => tog(r(el).physicalStyle, false))
  const commonForceBlackCap = common(elements, (el) => tog(r(el).forceBlackCap, false))
  const commonFontSize = common(elements, (el) => r(el).fontSize)
  const commonBitmapSize = common(elements, (el) => r(el).bitmapSize ?? 72)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ ...lbl, marginBottom: 2 }}>
        CompanionButton <span style={{ color: '#4a9eff' }}>×{elements.length}</span>
      </div>

      {/* Host */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.host')}</span>
        <select
          style={{ ...sel, fontSize: 13, padding: '4px 8px' }}
          value={commonHostId ?? ''}
          onChange={(e) => e.target.value && patchHostId(e.target.value)}
        >
          {commonHostId === null && <option value="">—</option>}
          {hosts.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </div>

      {/* showBgColor */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.showBgColor')}</span>
        <MixedCheckbox value={commonShowBgColor} onChange={(v) => patchRender({ showBgColor: v })} />
      </div>

      {/* showBitmap */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.showBitmap')}</span>
        <MixedCheckbox value={commonShowBitmap} onChange={(v) => patchRender({ showBitmap: v })} />
      </div>

      {/* showText */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.showText')}</span>
        <MixedCheckbox value={commonShowText} onChange={(v) => patchRender({ showText: v })} />
      </div>

      {/* textAlign */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.textAlign')}</span>
        <select
          style={{ ...sel, fontSize: 13, padding: '4px 8px' }}
          value={commonTextAlign ?? ''}
          onChange={(e) => e.target.value && patchRender({ textAlign: e.target.value as 'center' | 'top' | 'bottom' })}
        >
          {commonTextAlign === null && <option value="">—</option>}
          <option value="center">{t('propertiesPanel.alignCenter')}</option>
          <option value="top">{t('propertiesPanel.alignTop')}</option>
          <option value="bottom">{t('propertiesPanel.alignBottom')}</option>
        </select>
      </div>

      {/* borderRadius */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.borderRadius')}</span>
        <input
          type="number"
          min={0}
          max={50}
          placeholder="—"
          value={commonBorderRadius ?? ''}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (!isNaN(v)) patchRender({ borderRadius: v })
          }}
          style={{
            width: 70, background: '#1a2030', border: '1px solid #2a3344',
            color: '#e9edf2', borderRadius: 4, padding: '4px 8px',
            fontSize: 13, textAlign: 'right',
          }}
        />
      </div>

      {/* physicalStyle (Dome, pro Button) */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.physicalStyle')}</span>
        <MixedCheckbox value={commonPhysicalStyle} onChange={(v) => patchRender({ physicalStyle: v || undefined })} />
      </div>

      {/* forceBlackCap — immer setzbar, zieht aber nur bei aktivem Broadcast-LED-Modus */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.forceBlackCap')}</span>
        <MixedCheckbox value={commonForceBlackCap} onChange={(v) => patchRender({ forceBlackCap: v || undefined })} />
      </div>

      {/* fontSize */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.fontSize')}</span>
        <input
          type="number"
          min={6}
          max={72}
          placeholder="—"
          value={commonFontSize ?? ''}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (!isNaN(v)) patchRender({ fontSize: v })
          }}
          style={{
            width: 70, background: '#1a2030', border: '1px solid #2a3344',
            color: '#e9edf2', borderRadius: 4, padding: '4px 8px',
            fontSize: 13, textAlign: 'right',
          }}
        />
      </div>

      {/* bitmapSize */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.bitmapSize')}</span>
        <select
          style={{ ...sel, fontSize: 13, padding: '4px 8px' }}
          value={commonBitmapSize ?? ''}
          onChange={(e) => e.target.value && patchRender({ bitmapSize: parseInt(e.target.value, 10) })}
        >
          {commonBitmapSize === null && <option value="">—</option>}
          <option value={72}>72 px</option>
          <option value={100}>100 px</option>
          <option value={144}>144 px</option>
          <option value={200}>200 px</option>
        </select>
      </div>
    </div>
  )
}

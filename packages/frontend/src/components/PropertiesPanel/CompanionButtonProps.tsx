import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CompanionButtonElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { NumericInput } from './NumericInput'
import { CompanionButtonPickerDialog } from '../AddElement/CompanionButtonPickerDialog'

interface Props { element: CompanionButtonElement; panelId: string; side?: 'left' | 'right'; panelWidth?: number }

export function CompanionButtonProps({ element, panelId, side = 'right', panelWidth = 320 }: Props) {
  const { t } = useTranslation()
  const setSettings = useAppStore((s) => s.setSettings)
  const settings = useAppStore((s) => s.settings)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const r = element.render ?? {}
  const [pickerOpen, setPickerOpen] = useState(false)

  const hostConnected = sessionStatus[element.ref.hostId] === 'connected'

  // Alle anderen companionButton-Elemente im Panel auf gleicher Host+Page → grüner Haken im Picker
  const usedCells = useMemo(() => {
    const panel = settings?.panels.find((p) => p.id === panelId)
    if (!panel) return undefined
    const { hostId, page } = element.ref
    const cells = new Set<string>()
    for (const el of panel.elements) {
      if (el.type === 'companionButton' && el.id !== element.id) {
        const btn = el as CompanionButtonElement
        if (btn.ref.hostId === hostId && btn.ref.page === page) {
          cells.add(`${btn.ref.row}:${btn.ref.col}`)
        }
      }
    }
    return cells
  }, [settings, panelId, element.id, element.ref.hostId, element.ref.page])

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
  const host = settings?.hosts.find((h) => h.id === element.ref.hostId)

  const lbl: React.CSSProperties = { fontSize: 12, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }
  const tog = (v: boolean | undefined, d: boolean) => v === undefined ? d : v
  const sel: React.CSSProperties = { background: '#1a2030', border: '1px solid #2a3344', color: '#e9edf2', borderRadius: 4, padding: '8px 10px', fontSize: 14 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ ...lbl, marginBottom: 2 }}>CompanionButton</div>

      {/* Ref: visueller Picker */}
      <div style={{ background: '#121821', borderRadius: 6, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={lbl}>{t('propertiesPanel.companionRef')}</div>
        <div style={{ fontSize: 12, color: '#8896aa' }}>
          <span style={{ color: '#e9edf2' }}>{hostName}</span>
          {' · '}
          <span style={{ color: '#e9edf2' }}>P{element.ref.page}</span>
          {' · '}
          R{element.ref.row} / C{element.ref.col}
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
          {hostConnected ? t('propertiesPanel.change') : t('propertiesPanel.hostOffline')}
        </button>
      </div>

      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.showBgColor')}</span>
        <input type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }} checked={tog(r.showBgColor, true)} onChange={(e) => updateRender({ showBgColor: e.target.checked })} />
      </div>
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.showBitmap')}</span>
        <input type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }} checked={tog(r.showBitmap, false)} onChange={(e) => updateRender({ showBitmap: e.target.checked })} />
      </div>
      {tog(r.showBitmap, false) && (
        <>
          <div style={row}>
            <span style={lbl}>{t('propertiesPanel.scaleBitmap')}</span>
            <input type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }} checked={tog(r.scaleBitmap, true)} onChange={(e) => updateRender({ scaleBitmap: e.target.checked })} />
          </div>
          <div style={row}>
            <span style={lbl}>{t('propertiesPanel.bitmapSize')}</span>
            <select
              value={r.bitmapSize ?? 72}
              style={sel}
              onChange={(e) => updateRender({ bitmapSize: parseInt(e.target.value, 10) })}
            >
              <option value={72}>72 px</option>
              <option value={100}>100 px</option>
              <option value={144}>144 px</option>
              <option value={200}>200 px</option>
            </select>
          </div>
        </>
      )}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.showText')}</span>
        <input type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }} checked={tog(r.showText, true)} onChange={(e) => updateRender({ showText: e.target.checked })} />
      </div>
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.textAlign')}</span>
        <select value={r.textAlign ?? 'bottom'} style={sel}
          onChange={(e) => updateRender({ textAlign: e.target.value as 'top' | 'center' | 'bottom' })}>
          <option value="top">{t('propertiesPanel.top')}</option>
          <option value="center">{t('propertiesPanel.center')}</option>
          <option value="bottom">{t('propertiesPanel.bottom')}</option>
        </select>
      </div>
      <NumericInput label={t('propertiesPanel.borderRadius')} value={r.borderRadius ?? 6} min={0}
        onChange={(v) => updateRender({ borderRadius: v })} />
      {/* Physischer Taster (Dome) — pro Button, unabhängig vom globalen Broadcast-LED-Style */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.physicalStyle')}</span>
        <input
          type="checkbox"
          style={{ width: 20, height: 20, cursor: 'pointer' }}
          checked={r.physicalStyle === true}
          onChange={(e) => updateRender({ physicalStyle: e.target.checked || undefined })}
        />
      </div>
      {/* forceBlackCap — immer setzbar, zieht aber nur bei aktivem Broadcast-LED-Modus
          (gilt für LED-Kappen UND Dome-Buttons) */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.forceBlackCap')}</span>
        <input
          type="checkbox"
          style={{ width: 20, height: 20, cursor: 'pointer' }}
          checked={r.forceBlackCap === true}
          onChange={(e) => updateRender({ forceBlackCap: e.target.checked || undefined })}
        />
      </div>
      {tog(r.showText, true) && (
        <NumericInput label={t('propertiesPanel.fontSize')} value={r.fontSize ?? 11} min={6} unit="px"
          onChange={(v) => updateRender({ fontSize: v })} />
      )}

      {pickerOpen && (
        <CompanionButtonPickerDialog
          confirmLabel={t('propertiesPanel.confirm')}
          initialRef={{ hostId: element.ref.hostId, page: element.ref.page, row: element.ref.row, col: element.ref.col }}
          usedCells={usedCells}
          onConfirm={(refs) => { if (refs.length > 0) updateRef(refs[0]); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
          alignSide={side}
          panelWidth={panelWidth}
          initialGridCols={host?.gridCols}
          initialGridRows={host?.gridRows}
        />
      )}
    </div>
  )
}

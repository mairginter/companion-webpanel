import React from 'react'
import { useTranslation } from 'react-i18next'
import { AnyElement, LabelElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { ColorPicker } from './ColorPicker'
import { NumericInput } from './NumericInput'

interface Props { element: LabelElement; panelId: string }

export function LabelProps({ element, panelId }: Props) {
  const { t } = useTranslation()
  const setSettings = useAppStore((s) => s.setSettings)
  const settings = useAppStore((s) => s.settings)
  const s = element.style ?? {}

  const updateText = (text: string) => {
    if (!settings) return
    setSettings({ ...settings, panels: settings.panels.map((p) =>
      p.id !== panelId ? p : { ...p, elements: p.elements.map((el) =>
        el.id !== element.id ? el : { ...el, text }) }) })
  }
  const updateStyle = (patch: Partial<NonNullable<LabelElement['style']>>) => {
    if (!settings) return
    setSettings({ ...settings, panels: settings.panels.map((p) =>
      p.id !== panelId ? p : { ...p, elements: p.elements.map((el) =>
        el.id !== element.id ? el : { ...el, style: { ...s, ...patch } } as AnyElement) }) })
  }

  const lbl: React.CSSProperties = { fontSize: 12, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }
  const sel: React.CSSProperties = { background: '#1a2030', border: '1px solid #2a3344', color: '#e9edf2', borderRadius: 4, padding: '8px 10px', fontSize: 14 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={lbl}>Label</div>
      <div>
        <div style={lbl}>{t('propertiesPanel.labelText')}</div>
        <textarea value={element.text} onChange={(e) => updateText(e.target.value)} rows={3}
          style={{ ...sel, width: '100%', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5 }} />
      </div>
      <ColorPicker label={t('propertiesPanel.color')} value={s.color ?? '#e9edf2'} onChange={(v) => updateStyle({ color: v })} />
      <NumericInput label={t('propertiesPanel.fontSize')} value={s.fontSize ?? 13} min={8} unit="px"
        onChange={(v) => updateStyle({ fontSize: v })} />
      <div>
        <div style={lbl}>{t('propertiesPanel.fontWeight')}</div>
        <select value={s.fontWeight ?? '400'} onChange={(e) => updateStyle({ fontWeight: e.target.value })} style={sel}>
          <option value="400">{t('propertiesPanel.fontWeightNormal')}</option>
          <option value="600">{t('propertiesPanel.fontWeightSemiBold')}</option>
          <option value="700">{t('propertiesPanel.fontWeightBold')}</option>
        </select>
      </div>
      <div>
        <div style={lbl}>{t('propertiesPanel.textAlignment')}</div>
        <select value={s.align ?? 'left'} style={sel}
          onChange={(e) => updateStyle({ align: e.target.value as 'left' | 'center' | 'right' })}>
          <option value="left">{t('propertiesPanel.left')}</option>
          <option value="center">{t('propertiesPanel.center')}</option>
          <option value="right">{t('propertiesPanel.right')}</option>
        </select>
      </div>
    </div>
  )
}

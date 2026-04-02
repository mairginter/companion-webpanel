import React from 'react'
import { AnyElement, ShapeElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { ColorPicker } from './ColorPicker'
import { NumericInput } from './NumericInput'

interface Props { element: ShapeElement; panelId: string }

export function ShapeProps({ element, panelId }: Props) {
  const setSettings = useAppStore((s) => s.setSettings)
  const settings = useAppStore((s) => s.settings)

  const updateStyle = (patch: Partial<ShapeElement['style']>) => {
    if (!settings) return
    setSettings({
      ...settings,
      panels: settings.panels.map((p) =>
        p.id !== panelId ? p : {
          ...p,
          elements: p.elements.map((el) =>
            el.id !== element.id ? el : { ...el, style: { ...element.style, ...patch } } as AnyElement,
          ),
        },
      ),
    })
  }

  const lbl: React.CSSProperties = { fontSize: 9, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={lbl}>Shape</div>
      <ColorPicker label="Fill" value={element.style.fill ?? ''} onChange={(v) => updateStyle({ fill: v })} />
      <ColorPicker label="Stroke" value={element.style.stroke ?? ''} onChange={(v) => updateStyle({ stroke: v })} />
      <NumericInput label="Stroke-Breite" value={element.style.strokeWidth ?? 1} min={0}
        onChange={(v) => updateStyle({ strokeWidth: v })} />
      <NumericInput label="Border-Radius" value={element.style.borderRadius ?? 10} min={0}
        onChange={(v) => updateStyle({ borderRadius: v })} />
    </div>
  )
}

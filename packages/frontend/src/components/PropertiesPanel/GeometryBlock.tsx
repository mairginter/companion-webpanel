/**
 * GeometryBlock.tsx — x/y/w/h Felder für alle Element-Typen.
 * Multi-Select: gemeinsame Werte; null wenn unterschiedlich.
 */
import React from 'react'
import { AnyElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { NumericInput } from './NumericInput'

interface Props { elements: AnyElement[]; panelId: string }

function commonValue(elements: AnyElement[], key: 'x' | 'y' | 'w' | 'h'): number | null {
  const vals = elements.map((el) => el[key])
  return vals.every((v) => v === vals[0]) ? vals[0] : null
}

export function GeometryBlock({ elements, panelId }: Props) {
  const updateElementGeometry = useAppStore((s) => s.updateElementGeometry)
  const setAll = (patch: Partial<{ x: number; y: number; w: number; h: number }>) => {
    for (const el of elements) updateElementGeometry(panelId, el.id, patch)
  }
  const sl: React.CSSProperties = {
    fontSize: 12, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6,
  }
  const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }
  return (
    <div>
      <div style={sl}>{'Position & Größe'}</div>
      <div style={row}>
        <NumericInput label="X" value={commonValue(elements, 'x') ?? 0} onChange={(v) => setAll({ x: v })} />
        <NumericInput label="Y" value={commonValue(elements, 'y') ?? 0} onChange={(v) => setAll({ y: v })} />
      </div>
      <div style={{ ...row, marginTop: 6 }}>
        <NumericInput label="Breite" value={commonValue(elements, 'w') ?? 0} min={8} onChange={(v) => setAll({ w: v })} />
        <NumericInput label="Höhe" value={commonValue(elements, 'h') ?? 0} min={8} onChange={(v) => setAll({ h: v })} />
      </div>
    </div>
  )
}

/**
 * ColorPicker.tsx — Farbwähler mit nativen Browser-Input.
 * Zeigt Farb-Vorschau + öffnet nativen <input type="color">.
 */
import { useRef } from 'react'

interface Props {
  value: string
  onChange: (color: string) => void
  label?: string
}

export function ColorPicker({ value, onChange, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hex = toHex(value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {label && <span style={{ fontSize: 12, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        onClick={() => inputRef.current?.click()}>
        <div style={{ width: 36, height: 36, background: value || '#000000', borderRadius: 4, border: '1px solid #2a3344', flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", color: '#e9edf2',
          background: '#1a2030', border: '1px solid #2a3344', borderRadius: 4, padding: '8px 10px', flex: 1 }}>
          {value || '—'}
        </span>
        <input ref={inputRef} type="color" value={hex} onChange={(e) => onChange(e.target.value)}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
      </div>
    </div>
  )
}

function toHex(color: string): string {
  if (!color) return '#000000'
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (m) return '#' + [m[1], m[2], m[3]].map((n) => parseInt(n).toString(16).padStart(2, '0')).join('')
  return '#000000'
}

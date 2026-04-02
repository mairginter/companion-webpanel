/**
 * NumericInput.tsx — Zahlenfeld für Properties Panel.
 * Mausrad ±1 (Shift ±10), Pfeiltasten ±1 (Shift ±10).
 * Store-Update bei blur oder Enter — Live-Preview via onChange.
 */
import React, { useState, useCallback, useEffect } from 'react'

interface Props {
  value: number
  onChange: (v: number) => void
  min?: number
  label?: string
  unit?: string
}

export function NumericInput({ value, onChange, min, label, unit }: Props) {
  const [localValue, setLocalValue] = useState(String(value))

  useEffect(() => { setLocalValue(String(value)) }, [value])

  const clamp = useCallback((v: number) => {
    if (min !== undefined && v < min) return min
    return v
  }, [min])

  const commit = useCallback((raw: string) => {
    const n = parseFloat(raw)
    if (!isNaN(n)) onChange(clamp(Math.round(n)))
  }, [onChange, clamp])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const step = e.shiftKey ? 10 : 1
    const delta = e.deltaY < 0 ? step : -step
    onChange(clamp(value + delta))
  }, [value, onChange, clamp])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { commit(localValue); (e.target as HTMLElement).blur() }
    if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(value + (e.shiftKey ? 10 : 1))) }
    if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - (e.shiftKey ? 10 : 1))) }
  }, [localValue, commit, value, onChange, clamp])

  const inputStyle: React.CSSProperties = {
    background: '#1a2030', border: '1px solid #2a3344', borderRadius: 3,
    padding: '3px 6px', color: '#e9edf2', fontSize: 11,
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    width: '100%', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {label && <span style={{ fontSize: 9, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <input
          type="text" value={localValue} style={inputStyle}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={onKeyDown}
          onWheel={onWheel}
        />
        {unit && <span style={{ fontSize: 10, color: '#4a5568' }}>{unit}</span>}
      </div>
    </div>
  )
}

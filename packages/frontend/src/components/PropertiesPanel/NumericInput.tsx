/**
 * NumericInput.tsx — Zahlenfeld für Properties Panel.
 * Mausrad ±1 (Shift ±10), Pfeiltasten ±1 (Shift ±10).
 * Touch: −/+ Buttons (44px Tap-Target).
 * Store-Update bei blur oder Enter — Live-Preview via onChange.
 */
import React, { useState, useCallback, useEffect } from 'react'

interface Props {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  label?: string
  unit?: string
  /** Kein ±-Button — für enge 2-Spalten-Layouts. Tastatur/Wheel funktionieren weiterhin. */
  compact?: boolean
}

export function NumericInput({ value, onChange, min, max, label, unit, compact }: Props) {
  const [localValue, setLocalValue] = useState(String(value))

  useEffect(() => { setLocalValue(String(value)) }, [value])

  const clamp = useCallback((v: number) => {
    if (min !== undefined && v < min) return min
    if (max !== undefined && v > max) return max
    return v
  }, [min, max])

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
    background: '#1a2030', border: '1px solid #2a3344', borderRadius: 4,
    padding: '8px 10px', color: '#e9edf2', fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    width: '100%', outline: 'none', boxSizing: 'border-box',
    minWidth: 0,
  }

  const stepBtn: React.CSSProperties = {
    width: 44, height: 44, minWidth: 44, flexShrink: 0,
    borderRadius: 4, border: '1px solid #2a3344',
    background: '#1a2030', color: '#e9edf2',
    fontSize: 18, lineHeight: 1, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, touchAction: 'manipulation',
    userSelect: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={{ fontSize: 12, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="text" value={localValue} style={inputStyle}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={onKeyDown}
          onWheel={onWheel}
        />
        {unit && <span style={{ fontSize: 12, color: '#4a5568', flexShrink: 0 }}>{unit}</span>}
        {!compact && <button style={stepBtn} onPointerDown={(e) => { e.preventDefault(); onChange(clamp(value - 1)) }}>−</button>}
        {!compact && <button style={stepBtn} onPointerDown={(e) => { e.preventDefault(); onChange(clamp(value + 1)) }}>+</button>}
      </div>
    </div>
  )
}

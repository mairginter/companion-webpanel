/**
 * ZoomControl.tsx
 *
 * Toolbar-Button mit Zoom-Popover.
 * Klick auf den Button öffnet Slider (20–200%, Step 5%), 100%-Reset und Fit-Button.
 * Bei Zoom ≠ 100% oder autoZoom: blauer Tint.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'

interface ZoomControlProps {
  zoom: number
  onZoomChange: (zoom: number) => void
  autoZoom: boolean
  onAutoZoomChange: (value: boolean) => void
}

export function ZoomControl({ zoom, onZoomChange, autoZoom, onAutoZoomChange }: ZoomControlProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pct = Math.round(zoom * 100)
  const isScaled = Math.abs(zoom - 1.0) > 0.01
  const isActive = isScaled || autoZoom || open

  const handleSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onZoomChange(parseInt(e.target.value, 10) / 100)
    },
    [onZoomChange],
  )

  const handleReset = useCallback(() => {
    onAutoZoomChange(false)
    onZoomChange(1.0)
  }, [onZoomChange, onAutoZoomChange])

  const handleFitToggle = useCallback(() => {
    onAutoZoomChange(!autoZoom)
  }, [autoZoom, onAutoZoomChange])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Icon-Button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Zoom (Ctrl+Scroll)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          height: 32,
          padding: '0 8px',
          borderRadius: 6,
          border: `1px solid ${isActive ? '#4a9eff' : '#2a3344'}`,
          background: isActive ? 'rgba(74,158,255,0.12)' : '#1a2030',
          color: isActive ? '#4a9eff' : '#8896aa',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          transition: 'all 0.15s',
        }}
      >
        <span className="material-icons" style={{ fontSize: 16 }}>
          {autoZoom ? 'fit_screen' : 'zoom_in'}
        </span>
        <span style={{ minWidth: 36, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
          {autoZoom ? 'Fit' : `${pct}%`}
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: '#1a2030',
            border: '1px solid #2a3344',
            borderRadius: 8,
            padding: '10px 12px',
            width: 220,
            zIndex: 500,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Slider-Zeile — deaktiviert wenn autoZoom aktiv */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min={20}
              max={200}
              step={5}
              value={pct}
              onChange={handleSlider}
              disabled={autoZoom}
              style={{
                flex: 1,
                accentColor: '#4a9eff',
                cursor: autoZoom ? 'not-allowed' : 'pointer',
                opacity: autoZoom ? 0.4 : 1,
              }}
            />
            <span
              style={{
                fontSize: 13,
                color: autoZoom ? '#4a5568' : '#e9edf2',
                minWidth: 38,
                textAlign: 'right',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {pct}%
            </span>
          </div>

          {/* Button-Zeile: 100% | Fit */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleReset}
              style={{
                padding: '3px 10px',
                borderRadius: 5,
                border: '1px solid #2a3344',
                background: 'transparent',
                color: '#8896aa',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              100%
            </button>
            <button
              onClick={handleFitToggle}
              title="Fit to Window — passt Zoom automatisch ans Fenster an"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                borderRadius: 5,
                border: `1px solid ${autoZoom ? '#4a9eff' : '#2a3344'}`,
                background: autoZoom ? 'rgba(74,158,255,0.12)' : 'transparent',
                color: autoZoom ? '#4a9eff' : '#8896aa',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>fit_screen</span>
              Fit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

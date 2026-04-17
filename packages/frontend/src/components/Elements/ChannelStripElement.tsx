/**
 * ChannelStripElement.tsx
 *
 * Kombiniertes Mixer-Channel-Strip Element.
 * Zeigt Meter L/R, Fader-Track, Pan-Indicator, Mute- und Solo-Button.
 * Ein Companion-Button liefert alle Daten via Multi-Wert TEXT-Feld.
 *
 * Interaktion:
 *  - Drum Wheel: Mausrad + Pointer-Drag (horizontal) → SUB-ROTATE (Fader)
 *  - Fader-Track: Pointer-Drag (vertikal) + Touch → SUB-ROTATE (Fader)
 *  - Shift+Wheel: coarseMultiplier× SUB-ROTATE
 *  - Doppelklick auf Wheel: SUB-PRESS (Unity Reset)
 *  - Mute-Button: SUB-PRESS auf buttonRef
 *  - Solo-Button: SUB-PRESS auf soloRef (nur sichtbar wenn refs.solo konfiguriert)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ChannelStripElement as ChannelStripElementType } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { parseChannelStripText, parsePanValue, isMuted } from '../../utils/channelStrip'

// Inject CSS keyframe animation once (for clip LED blink)
;(() => {
  if (typeof document === 'undefined') return
  if (document.getElementById('cwp-channelstrip-styles')) return
  const style = document.createElement('style')
  style.id = 'cwp-channelstrip-styles'
  style.textContent = `
    @keyframes cwp-clip-blink {
      0%,100% { background:#2a0a0a; box-shadow:none; }
      50% { background:#ff5a5f; box-shadow:0 0 6px 2px rgba(255,90,95,0.6); }
    }
  `
  document.head.appendChild(style)
})()

const DB_MIN = -60
const DB_MAX = 10
const PEAK_HOLD_MS = 2000
const WHEEL_DRAG_PX_PER_TICK = 8
const FADER_DRAG_PX_PER_TICK = 4

function dbToPercent(db: number): number {
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, db))
  return ((clamped - DB_MIN) / (DB_MAX - DB_MIN)) * 100
}

interface Props {
  element: ChannelStripElementType
  mode: 'view' | 'edit'
  sendPress: (hostId: string, page: number, row: number, col: number, pressed: boolean) => void
  sendRotate: (hostId: string, page: number, row: number, col: number, direction: 1 | -1) => void
  isContained?: boolean
}

export const ChannelStripElement = React.memo(function ChannelStripElement({
  element,
  mode,
  sendPress,
  sendRotate,
  isContained,
}: Props) {
  const { style, refs } = element
  const buttonRef = refs.button.ref
  const separator = refs.button.textSeparator ?? '|'
  const textIndices = {
    meterLIndex: refs.button.meterLIndex ?? 0,
    meterRIndex: refs.button.meterRIndex,
    levelIndex: refs.button.levelIndex,
    nameIndex: refs.button.nameIndex,
  }

  const clipThreshold = style.clipThreshold ?? 0
  const coarseMultiplier = style.coarseMultiplier ?? 10
  const isMono = style.mono === true
  const showWheel = style.showWheel !== false
  const hasSolo = !!refs.solo

  // State from store
  const buttonState = useAppStore((s) => s.getButtonState(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col))
  const soloState = useAppStore((s) =>
    refs.solo ? s.getButtonState(refs.solo.hostId, refs.solo.page, refs.solo.row, refs.solo.col) : undefined
  )
  const panState = useAppStore((s) =>
    refs.pan ? s.getButtonState(refs.pan.hostId, refs.pan.page, refs.pan.row, refs.pan.col) : undefined
  )
  const hostMissing = useAppStore((s) => !s.hostExists(buttonRef.hostId))

  // Parse TEXT field
  const parsed = parseChannelStripText(buttonState?.text ?? '', separator, textIndices)
  const meterLDb = parsed.meterL ?? -144
  const meterRDb = parsed.meterR ?? -144
  const levelDb = parsed.level
  const channelName = parsed.name ?? style.name ?? ''

  const muteBgColor = buttonState?.bgColor
  const rawSoloed = isMuted(soloState?.bgColor)
  const soloed = style.invertMute ? !rawSoloed : rawSoloed

  const panValue = refs.pan ? parsePanValue(panState?.text ?? '') : 0


  const isClipping = meterLDb >= clipThreshold || (!isMono && meterRDb >= clipThreshold)
  const showRChannel = !isMono && refs.button.meterRIndex !== undefined

  // Peak hold
  const peakLRef = useRef(-144)
  const peakRRef = useRef(-144)
  const [peakLDisplay, setPeakLDisplay] = useState(-144)
  const [peakRDisplay, setPeakRDisplay] = useState(-144)
  const peakLTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peakRTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (meterLDb > peakLRef.current) {
      peakLRef.current = meterLDb
      setPeakLDisplay(meterLDb)
      if (peakLTimer.current) clearTimeout(peakLTimer.current)
      peakLTimer.current = setTimeout(() => { peakLRef.current = -144; setPeakLDisplay(-144) }, PEAK_HOLD_MS)
    }
  }, [meterLDb])

  useEffect(() => {
    if (meterRDb > peakRRef.current) {
      peakRRef.current = meterRDb
      setPeakRDisplay(meterRDb)
      if (peakRTimer.current) clearTimeout(peakRTimer.current)
      peakRTimer.current = setTimeout(() => { peakRRef.current = -144; setPeakRDisplay(-144) }, PEAK_HOLD_MS)
    }
  }, [meterRDb])

  // ── Drum Wheel interaction ─────────────────────────────────────────────
  const [wheelSpin, setWheelSpin] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const wheelDragStartX = useRef<number | null>(null)
  const wheelDragAccum = useRef(0)

  const doRotate = useCallback((direction: 1 | -1, times = 1) => {
    if (mode !== 'view') return
    setWheelSpin((prev) => (prev + direction * 8 * times + 10000) % 100)
    for (let i = 0; i < times; i++) {
      sendRotate(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col, direction)
    }
  }, [mode, sendRotate, buttonRef])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (mode !== 'view') return
    e.preventDefault()
    e.stopPropagation()
    const direction: 1 | -1 = e.deltaY < 0 ? 1 : -1
    const times = e.shiftKey ? coarseMultiplier : 1
    doRotate(direction, times)
  }, [mode, doRotate, coarseMultiplier])

  const handleWheelPointerDown = useCallback((e: React.PointerEvent) => {
    if (mode !== 'view') return
    e.currentTarget.setPointerCapture(e.pointerId)
    wheelDragStartX.current = e.clientX
    wheelDragAccum.current = 0
    setIsDragging(true)
  }, [mode])

  const handleWheelPointerMove = useCallback((e: React.PointerEvent) => {
    if (wheelDragStartX.current === null) return
    const delta = e.clientX - wheelDragStartX.current
    wheelDragAccum.current += delta
    wheelDragStartX.current = e.clientX
    while (wheelDragAccum.current >= WHEEL_DRAG_PX_PER_TICK) {
      doRotate(1)
      wheelDragAccum.current -= WHEEL_DRAG_PX_PER_TICK
    }
    while (wheelDragAccum.current <= -WHEEL_DRAG_PX_PER_TICK) {
      doRotate(-1)
      wheelDragAccum.current += WHEEL_DRAG_PX_PER_TICK
    }
  }, [doRotate])

  const handleWheelPointerUp = useCallback(() => {
    wheelDragStartX.current = null
    wheelDragAccum.current = 0
    setIsDragging(false)
  }, [])

  const handleWheelDoubleClick = useCallback(() => {
    if (mode !== 'view') return
    sendPress(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col, true)
    setTimeout(() => sendPress(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col, false), 50)
  }, [mode, sendPress, buttonRef])

  // ── Fader Track interaction (vertikal) ────────────────────────────────
  const faderDragStartY = useRef<number | null>(null)
  const faderDragAccum = useRef(0)

  const handleFaderPointerDown = useCallback((e: React.PointerEvent) => {
    if (mode !== 'view') return
    e.currentTarget.setPointerCapture(e.pointerId)
    e.stopPropagation()
    faderDragStartY.current = e.clientY
    faderDragAccum.current = 0
  }, [mode])

  const handleFaderPointerMove = useCallback((e: React.PointerEvent) => {
    if (faderDragStartY.current === null) return
    // Drag nach oben (delta negativ) → level erhöhen → direction 1
    const delta = faderDragStartY.current - e.clientY
    faderDragAccum.current += delta
    faderDragStartY.current = e.clientY
    while (faderDragAccum.current >= FADER_DRAG_PX_PER_TICK) {
      doRotate(1)
      faderDragAccum.current -= FADER_DRAG_PX_PER_TICK
    }
    while (faderDragAccum.current <= -FADER_DRAG_PX_PER_TICK) {
      doRotate(-1)
      faderDragAccum.current += FADER_DRAG_PX_PER_TICK
    }
  }, [doRotate])

  const handleFaderPointerUp = useCallback(() => {
    faderDragStartY.current = null
    faderDragAccum.current = 0
  }, [])

  // ── Button handlers ───────────────────────────────────────────────────
  const handleMuteClick = useCallback(() => {
    if (mode !== 'view') return
    sendPress(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col, true)
    setTimeout(() => sendPress(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col, false), 50)
  }, [mode, sendPress, buttonRef])

  const handleSoloClick = useCallback(() => {
    if (mode !== 'view' || !refs.solo) return
    const s = refs.solo
    sendPress(s.hostId, s.page, s.row, s.col, true)
    setTimeout(() => sendPress(s.hostId, s.page, s.row, s.col, false), 50)
  }, [mode, sendPress, refs.solo])

  // ── Layout ────────────────────────────────────────────────────────────
  const containerStyle: React.CSSProperties = {
    ...(isContained
      ? { position: 'relative' as const, width: '100%', height: '100%' }
      : { position: 'absolute' as const, left: element.x, top: element.y, width: element.w, height: element.h }
    ),
    overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 6,
    // Neutrales Dunkelgrau — klar unterscheidbar von blauen/grünen Panel-Farben
    background: 'linear-gradient(to bottom, #3a3d46 0%, #2d3038 100%)',
    border: '1px solid #484c58',
    boxShadow: '0 4px 12px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.4)',
  }

  return (
    <div style={containerStyle}>
      {/* ── Color Stripe — Name + Clip LED (absolut, kein Platzverlust) ── */}
      <div style={{
        height: 20, flexShrink: 0, position: 'relative',
        background: style.color,
        display: 'flex', alignItems: 'center',
        padding: '0 6px',
      }}>
        <span style={{
          fontSize: 9, fontWeight: 700, color: 'rgba(0,0,0,0.65)',
          letterSpacing: 2, textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%',
        }}>
          {channelName}
        </span>
        {isClipping && (
          <div style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            width: 7, height: 7, borderRadius: '50%',
            animation: 'cwp-clip-blink 0.5s step-start infinite',
          }} />
        )}
      </div>

      {/* ── Pan (nur wenn refs.pan konfiguriert) ─────────────── */}
      {refs.pan && (
        <div style={{ padding: '5px 6px 3px', flexShrink: 0 }}>
          {/* Pan track */}
          <div style={{ position: 'relative', height: 6, background: '#0e1018', borderRadius: 3, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)' }}>
            <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: '#3a3e48' }} />
            <div style={{
              position: 'absolute',
              left: `calc(${50 + panValue * 50}% - 5px)`,
              top: -2, width: 10, height: 10, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #80c0ff, #2a7adf)',
              boxShadow: '0 0 5px rgba(74,158,255,0.7)',
              transition: 'left 0.1s ease',
            }} />
          </div>
        </div>
      )}

      {/* ── Meter + Fader Section ───────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, padding: refs.pan ? '0 6px 6px' : '6px 6px 6px', flex: 1, minHeight: 60, borderBottom: '1px solid #2a2e36' }}>
        {/* Meter bars */}
        <div style={{ display: 'flex', gap: 3, flex: 1, height: '100%' }}>
          <MeterBar db={meterLDb} peak={peakLDisplay} />
          {showRChannel && <MeterBar db={meterRDb} peak={peakRDisplay} />}
        </div>

        {/* Fader-Spalte */}
        {levelDb !== undefined && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0, height: '100%' }}>
            <span style={{
              fontSize: 10, color: '#5aacff',
              fontFamily: "'JetBrains Mono', monospace",
              lineHeight: '14px', flexShrink: 0,
              width: '100%', textAlign: 'center',
            }}>
              {levelDb === -144 ? '-∞' : Math.round(levelDb)}
            </span>
            {/* Fader Track — vertikal draggable */}
            <div
              style={{
                flex: 1, width: '100%', position: 'relative',
                cursor: mode === 'view' ? 'ns-resize' : 'default',
                touchAction: 'none', userSelect: 'none',
              }}
              onPointerDown={handleFaderPointerDown}
              onPointerMove={handleFaderPointerMove}
              onPointerUp={handleFaderPointerUp}
              onPointerCancel={handleFaderPointerUp}
            >
              {/* Track-Schiene — dunkel für Kontrast */}
              <div style={{
                position: 'absolute', left: '50%', top: 0, width: 6, height: '100%',
                background: 'linear-gradient(to right, #080a0e, #0f1116, #080a0e)',
                borderRadius: 3, transform: 'translateX(-50%)',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.9)',
              }} />
              {/* Fader-Knob — gerippte 3D-Metalltextur */}
              <div style={{
                position: 'absolute',
                left: 0, right: 0,
                bottom: `${Math.max(2, Math.min(95, levelDb))}%`,
                height: 10,
                borderRadius: 3,
                transform: 'translateY(50%)',
                transition: 'bottom 0.05s linear',
                pointerEvents: 'none',
                overflow: 'hidden',
                background: 'repeating-linear-gradient(to bottom, #606878 0px, #8898b0 1px, #a8b8cc 2px, #8898b0 3px, #505868 4px, #3a4858 5px)',
                boxShadow: 'inset 2px 0 3px rgba(255,255,255,0.25), inset -2px 0 3px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.7)',
              }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(255,255,255,0.55)', transform: 'translateY(-50%)' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Drum Wheel — warmes Amber, 3D-Rillentextur ───────── */}
      {showWheel && (
        <div style={{ flexShrink: 0, height: 48, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4px 6px' }}>
          <div
            style={{
              flex: 1,
              borderRadius: 10,
              cursor: mode === 'view' ? 'ew-resize' : 'default',
              userSelect: 'none',
              touchAction: 'none',
              // Gummirippen: sehr dunkel mit hellen Stegen — Mausrad-Optik
              background: 'repeating-linear-gradient(90deg, #141414 0px, #141414 3px, #484848 3px, #585858 4px, #484848 5px, #141414 5px, #141414 8px)',
              backgroundPositionX: `${wheelSpin}px`,
              boxShadow: isDragging
                ? 'inset 0 4px 8px rgba(0,0,0,0.9), inset 0 -4px 8px rgba(0,0,0,0.9), 0 0 6px rgba(120,120,140,0.35)'
                : 'inset 0 4px 8px rgba(0,0,0,0.9), inset 0 -4px 8px rgba(0,0,0,0.9)',
              border: '1px solid #222222',
              position: 'relative',
              overflow: 'hidden',
              transition: 'box-shadow 0.12s',
            }}
            onWheel={handleWheel}
            onPointerDown={handleWheelPointerDown}
            onPointerMove={handleWheelPointerMove}
            onPointerUp={handleWheelPointerUp}
            onPointerCancel={handleWheelPointerUp}
            onDoubleClick={handleWheelDoubleClick}
          >
            {/* Zylindrischer Lichtschein: obere Kante hell, Mitte leicht aufgehellt = Scheiben-Effekt */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.06) 75%, rgba(0,0,0,0.55) 100%)',
            }} />
          </div>
        </div>
      )}

      {/* ── Solo + Mute Buttons — 3D Bevel-Look ─────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 6px 6px', flexShrink: 0 }}>
        {hasSolo && (
          <button
            onClick={handleSoloClick}
            disabled={mode !== 'view'}
            style={{
              width: '100%', height: 36, borderRadius: 5,
              cursor: mode === 'view' ? 'pointer' : 'default',
              fontSize: 10, fontWeight: 700, letterSpacing: 1,
              transition: 'all 0.1s',
              ...(soloed
                ? {
                    background: 'linear-gradient(to bottom, #ffaa50 0%, #cc6010 100%)',
                    border: '1px solid #aa4800',
                    color: '#fff',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), inset 0 2px 4px rgba(0,0,0,0.2), 0 0 10px rgba(255,140,30,0.5)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                  }
                : {
                    background: 'linear-gradient(to bottom, #202226 0%, #16181c 100%)',
                    border: '1px solid #2a2c32',
                    color: '#5a6070',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 4px rgba(0,0,0,0.6)',
                  }
              ),
            }}
          >
            SOLO
          </button>
        )}
        <button
          onClick={handleMuteClick}
          style={{
            width: '100%', height: 36, borderRadius: 5,
            cursor: mode === 'view' ? 'pointer' : 'default',
            fontSize: 10, fontWeight: 700, letterSpacing: 1,
            transition: 'background 0.1s, color 0.1s, box-shadow 0.1s',
            background: muteBgColor
              ? muteBgColor
              : 'linear-gradient(to bottom, #202226 0%, #16181c 100%)',
            border: muteBgColor ? `1px solid ${muteBgColor}` : '1px solid #2a2c32',
            color: buttonState?.textColor ?? (muteBgColor ? '#fff' : '#5a6070'),
            boxShadow: muteBgColor
              ? 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 2px 4px rgba(0,0,0,0.2), 0 0 8px rgba(0,0,0,0.3)'
              : 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 4px rgba(0,0,0,0.6)',
            textShadow: muteBgColor ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
          }}
        >
          MUTE
        </button>
      </div>

      {/* 3D-Bevel-Overlay (äußerer Rahmen) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, borderRadius: 6, pointerEvents: 'none',
          boxShadow: 'inset 0 1.5px 2px rgba(255,255,255,0.18), inset 1.5px 0 2px rgba(255,255,255,0.09), inset 0 -2.5px 5px rgba(0,0,0,0.55), inset -2.5px 0 4px rgba(0,0,0,0.35)',
        }}
      />

      {/* hostMissing overlay */}
      {hostMissing && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,14,20,0.75)', fontSize: 16, color: '#ff8a3d',
        }}>
          ⛔
        </div>
      )}
    </div>
  )
})

// ─── MeterBar sub-component ──────────────────────────────────────────────────
// Gradient auf dem Container, dunkles Overlay deckt ungefüllten Bereich ab.
// Funktioniert bei beliebiger Höhe ohne height-prop.

interface MeterBarProps {
  db: number
  peak: number
}

function MeterBar({ db, peak }: MeterBarProps) {
  const fillPct = dbToPercent(db)
  const peakPct = dbToPercent(peak)

  return (
    <div style={{
      width: 10, height: '100%', flexShrink: 0,
      position: 'relative', borderRadius: 2, overflow: 'hidden',
      // Farbzonen (von unten nach oben):
      // 0–60%  = -60 bis -18 dBFS → Grün
      // 60–73% = -18 bis  -9 dBFS → Gelb
      // 73–81% =  -9 bis  -3 dBFS → Orange
      // 81–100%=       > -3 dBFS  → Rot
      background: 'linear-gradient(to top, #21d07a 0%, #21d07a 60%, #f0d040 60%, #f0d040 73%, #ff8a3d 73%, #ff8a3d 81%, #ff3a3a 81%, #ff3a3a 100%)',
    }}>
      {/* Dunkles Overlay deckt ungefüllten Bereich von oben ab */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: `${100 - fillPct}%`,
        background: '#0a0e14',
        transition: 'height 0.05s linear',
      }} />
      {/* Peak hold line */}
      {peak > -144 && (
        <div style={{
          position: 'absolute',
          left: 0, right: 0, height: 2,
          bottom: `${peakPct}%`,
          background: '#b060ff',
          boxShadow: '0 0 3px rgba(176,96,255,0.8)',
        }} />
      )}
    </div>
  )
}

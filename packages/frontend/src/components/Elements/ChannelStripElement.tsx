/**
 * ChannelStripElement.tsx
 *
 * Kombiniertes Mixer-Channel-Strip Element.
 * Zeigt Meter L/R, Fader-Track, Pan-Indicator, Mute- und Solo-Button.
 * Ein Companion-Button liefert alle Daten via Multi-Wert TEXT-Feld.
 *
 * Interaktion:
 *  - Drum Wheel: Mausrad + Pointer-Drag → SUB-ROTATE (Fader)
 *  - Shift+Wheel: coarseMultiplier× SUB-ROTATE
 *  - Doppelklick auf Wheel: SUB-PRESS (Unity Reset)
 *  - Mute-Button: SUB-PRESS auf buttonRef
 *  - Solo-Button: SUB-PRESS auf soloRef
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
const DRAG_PX_PER_TICK = 8

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

  // Mute / Solo state (invertMute für Companion-Module die Farbe bei UNMUTED setzen)
  const rawMuted = isMuted(buttonState?.bgColor)
  const muted = style.invertMute ? !rawMuted : rawMuted
  const rawSoloed = isMuted(soloState?.bgColor)
  const soloed = style.invertMute ? !rawSoloed : rawSoloed

  // Pan value
  const panValue = refs.pan ? parsePanValue(panState?.text ?? '') : 0
  const panDisabled = isMono || !refs.pan

  // Clip LED
  const isClipping = meterLDb >= clipThreshold || (!isMono && meterRDb >= clipThreshold)

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

  // Drum wheel interaction + animation offset
  const [wheelSpin, setWheelSpin] = useState(0)
  const dragStartX = useRef<number | null>(null)
  const dragAccum = useRef(0)

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
    dragStartX.current = e.clientX
    dragAccum.current = 0
  }, [mode])

  const handleWheelPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartX.current === null) return
    const delta = e.clientX - dragStartX.current
    dragAccum.current += delta
    dragStartX.current = e.clientX
    while (dragAccum.current >= DRAG_PX_PER_TICK) {
      doRotate(1)
      dragAccum.current -= DRAG_PX_PER_TICK
    }
    while (dragAccum.current <= -DRAG_PX_PER_TICK) {
      doRotate(-1)
      dragAccum.current += DRAG_PX_PER_TICK
    }
  }, [doRotate])

  const handleWheelPointerUp = useCallback(() => {
    dragStartX.current = null
    dragAccum.current = 0
  }, [])

  const handleWheelDoubleClick = useCallback(() => {
    if (mode !== 'view') return
    // Unity Reset: SUB-PRESS true + false
    sendPress(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col, true)
    setTimeout(() => sendPress(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col, false), 50)
  }, [mode, sendPress, buttonRef])

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

  // Layout
  const containerStyle: React.CSSProperties = isContained
    ? { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 6, background: '#0f141a', border: '1px solid #1e2535' }
    : { position: 'absolute', left: element.x, top: element.y, width: element.w, height: element.h, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 6, background: '#0f141a', border: '1px solid #1e2535' }

  const meterHeight = 80
  const showRChannel = !isMono && refs.button.meterRIndex !== undefined

  return (
    <div style={containerStyle}>
      {/* ── Color Stripe ─────────────────────────────────────── */}
      <div style={{
        height: 20, flexShrink: 0,
        background: style.color,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 6px',
      }}>
        <span style={{
          fontSize: 9, fontWeight: 700, color: 'rgba(0,0,0,0.6)',
          letterSpacing: 2, textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {channelName}
        </span>
        {/* Clip LED */}
        <div style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          ...(isClipping
            ? { animation: 'cwp-clip-blink 0.5s step-start infinite' }
            : { background: '#2a0a0a' }
          ),
        }} />
      </div>

      {/* ── Pan Indicator ────────────────────────────────────── */}
      <div style={{
        padding: '4px 6px 2px',
        opacity: panDisabled ? 0.2 : 1,
        flexShrink: 0,
      }}>
        <div style={{ position: 'relative', height: 4, background: '#1a2030', borderRadius: 2 }}>
          {/* Center mark */}
          <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: '#2a3344' }} />
          {/* Pan dot */}
          <div style={{
            position: 'absolute',
            left: `calc(${50 + panValue * 50}% - 4px)`,
            top: -2, width: 8, height: 8,
            borderRadius: '50%',
            background: panDisabled ? '#2a3344' : '#4a9eff',
            transition: 'left 0.1s ease',
          }} />
        </div>
        <div style={{ fontSize: 7, color: '#3a4a5e', marginTop: 1, textAlign: 'center' }}>
          {panDisabled ? 'PAN' : (panValue === 0 ? 'C' : panValue < 0 ? `L${Math.round(-panValue * 100)}` : `R${Math.round(panValue * 100)}`)}
        </div>
      </div>

      {/* ── Meter + Fader Section ────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, padding: '0 6px', flexShrink: 0, height: meterHeight }}>
        {/* Meter bars */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', flex: 1 }}>
          <MeterBar db={meterLDb} peak={peakLDisplay} height={meterHeight} />
          {showRChannel && <MeterBar db={meterRDb} peak={peakRDisplay} height={meterHeight} />}
        </div>

        {/* Fader track */}
        {levelDb !== undefined && (
          <div style={{ width: 20, height: meterHeight, position: 'relative', flexShrink: 0 }}>
            {/* Track */}
            <div style={{
              position: 'absolute', left: 7, top: 0, width: 6, height: '100%',
              background: '#1a2030', borderRadius: 3,
            }} />
            {/* Fader knob */}
            <div style={{
              position: 'absolute',
              left: 2,
              top: `${100 - dbToPercent(levelDb)}%`,
              width: 16, height: 7,
              background: 'linear-gradient(#5a6a8a, #3a4a6a)',
              borderRadius: 2,
              transform: 'translateY(-50%)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }} />
          </div>
        )}

        {/* dB level value */}
        {levelDb !== undefined && (
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
            <span style={{
              fontSize: 10, color: '#4a9eff',
              fontFamily: "'JetBrains Mono', monospace",
              whiteSpace: 'nowrap',
            }}>
              {levelDb === -144 ? '-∞' : `${levelDb.toFixed(1)}`}
            </span>
          </div>
        )}
      </div>

      {/* ── Drum Wheel ───────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          height: 28,
          margin: '4px 6px',
          borderRadius: 4,
          cursor: mode === 'view' ? 'ew-resize' : 'default',
          userSelect: 'none',
          touchAction: 'none',
          background: 'repeating-linear-gradient(90deg, #1a2030 0px, #1a2030 6px, #243040 6px, #243040 8px)',
          backgroundPositionX: `${wheelSpin}px`,
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5), inset 0 -1px 3px rgba(0,0,0,0.5)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onWheel={handleWheel}
        onPointerDown={handleWheelPointerDown}
        onPointerMove={handleWheelPointerMove}
        onPointerUp={handleWheelPointerUp}
        onPointerCancel={handleWheelPointerUp}
        onDoubleClick={handleWheelDoubleClick}
      >
        {/* Center highlight line */}
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.1)', transform: 'translateY(-50%)' }} />
        {/* Grip dots */}
        {[25, 37.5, 50, 62.5, 75].map((pos) => (
          <div key={pos} style={{
            position: 'absolute', left: `${pos}%`,
            width: 4, height: 4, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            transform: 'translateX(-50%)',
          }} />
        ))}
      </div>

      {/* ── Mute / Solo Buttons ──────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, padding: '0 6px 6px', flexShrink: 0, flex: 1, alignItems: 'flex-end' }}>
        <button
          onClick={handleMuteClick}
          style={{
            flex: 1, height: 28, border: 'none', borderRadius: 4, cursor: mode === 'view' ? 'pointer' : 'default',
            fontSize: 10, fontWeight: 700, letterSpacing: 1,
            transition: 'all 0.1s',
            ...(muted
              ? { background: 'linear-gradient(#ff6b6b, #d94848)', color: '#fff', boxShadow: '0 0 8px rgba(255,90,95,0.4)' }
              : { background: '#141b28', border: '1px solid #253045', color: '#3a4a5e' }
            ),
          }}
        >
          MUTE
        </button>
        <button
          onClick={handleSoloClick}
          disabled={!refs.solo || mode !== 'view'}
          style={{
            flex: 1, height: 28, border: 'none', borderRadius: 4,
            cursor: refs.solo && mode === 'view' ? 'pointer' : 'default',
            fontSize: 10, fontWeight: 700, letterSpacing: 1,
            transition: 'all 0.1s',
            opacity: refs.solo ? 1 : 0.3,
            ...(soloed
              ? { background: '#ff8a3d', color: '#fff', boxShadow: '0 0 8px rgba(255,138,61,0.4)' }
              : { background: '#141b28', border: '1px solid #253045', color: '#3a4a5e' }
            ),
          }}
        >
          SOLO
        </button>
      </div>

      {/* ── hostMissing overlay ──────────────────────────────── */}
      {hostMissing && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,14,20,0.7)', fontSize: 16, color: '#ff8a3d',
        }}>
          ⛔
        </div>
      )}
    </div>
  )
})

// ─── MeterBar sub-component ──────────────────────────────────────────────────

interface MeterBarProps {
  db: number
  peak: number
  height: number
}

function MeterBar({ db, peak, height }: MeterBarProps) {
  const fillPct = dbToPercent(db)
  const peakPct = dbToPercent(peak)

  return (
    <div style={{ width: 10, height, position: 'relative', background: '#0a0e14', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
      {/* Meter fill */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: `${fillPct}%`,
        background: 'linear-gradient(to top, #21d07a 0%, #21d07a 55%, #ff8a3d 78%, #ff5a5f 92%, #ff5a5f 100%)',
        borderRadius: '0 0 2px 2px',
        transition: 'height 0.05s linear',
      }} />
      {/* Peak hold line */}
      {peak > -144 && (
        <div style={{
          position: 'absolute',
          left: 0, right: 0, height: 2,
          bottom: `${peakPct}%`,
          background: '#ff5a5f',
          boxShadow: '0 0 3px rgba(255,90,95,0.8)',
        }} />
      )}
    </div>
  )
}

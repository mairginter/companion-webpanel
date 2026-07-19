import React, { useState, useCallback, useMemo } from 'react'
import { CompanionButtonElement as CompanionButtonElementType, defaultLayerFor } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { rawRgbBase64ToDataUrl } from '../../utils/bitmap'
import {
  buildDomeRecessStyle,
  buildDomeCapStyle,
  buildDomeStyle,
  buildDomeLedGlow,
  ledGlowShadow,
  LED_COLLAR_STYLE,
  buildLedCapStyle,
  buildLedLegend,
  isLit,
} from '../../utils/physical'

interface Props {
  element: CompanionButtonElementType
  mode: 'view' | 'edit'
  sendPress: (hostId: string, page: number, row: number, col: number, pressed: boolean) => void
  /** true wenn von EditableElement gewrapped — überlässt Positionierung dem Wrapper */
  isContained?: boolean
}

export const CompanionButtonElement = React.memo(function CompanionButtonElement({
  element,
  mode,
  sendPress,
  isContained,
}: Props) {
  const { ref, render } = element
  const bitmapSize = render?.bitmapSize ?? 72
  const borderRadius = render?.borderRadius ?? 6
  const showBitmap = render?.showBitmap === true      // default: false
  const scaleBitmap = render?.scaleBitmap !== false   // default: true
  const showText = render?.showText !== false          // default: true
  const showBgColor = render?.showBgColor !== false    // default: true
  const textAlign = render?.textAlign ?? 'bottom'
  const fontSize = render?.fontSize ?? 11

  // Zwei unabhängige Style-Mechanismen (v1.5.0):
  //  1. physicalStyle (Dome) — PRO BUTTON: matte Gummikappe mit konkaver Mulde.
  //  2. buttonStyle 'broadcast-led' — GLOBAL (Settings): Overlay-Style über alle
  //     CompanionButtons; re-interpretiert bgColor als LED-Signalfarbe und gibt
  //     der Legende einen Glow in ihrer eigenen Farbe (auch auf Dome-Buttons).
  // Dome-Buttons behalten im LED-Modus ihre Dome-Geometrie.
  // forceBlackCap (pro Button, immer setzbar) zieht NUR bei aktivem LED-Modus:
  // Kappe fest auf Referenz-Schwarz #1d1f23 — gilt für LED-Kappen UND Domes.
  const globalButtonStyle = useAppStore((s) => s.settings?.buttonStyle ?? 'default')
  const ledModeActive = globalButtonStyle === 'broadcast-led'
  const physicalDome = render?.physicalStyle === true
  const broadcastLed = ledModeActive && !physicalDome
  const forceBlackCap = ledModeActive && render?.forceBlackCap === true

  // Button-State direkt per row/col — kein keysPerRow-Lookup mehr nötig
  const keyState = useAppStore((s) => s.getButtonState(ref.hostId, ref.page, ref.row, ref.col))
  // Session-Status pro Host (nicht mehr pro Page)
  const sessionStatus = useAppStore((s) => s.getSessionStatus(ref.hostId))
  // Prüfen ob der Host noch in den Settings existiert
  const hostMissing = useAppStore((s) => !s.hostExists(ref.hostId))
  const showHostLabels = useAppStore((s) => s.showHostLabels)
  const hostName = useAppStore((s) => s.settings?.hosts.find((h) => h.id === ref.hostId)?.name ?? ref.hostId)

  const isStale = sessionStatus === 'stale' || sessionStatus === 'error'
  const hasData = !!keyState?.bgColor || !!keyState?.bitmap || !!keyState?.text

  const [pressed, setPressed] = useState(false)

  const handlePointerDown = useCallback(() => {
    if (mode !== 'view') return
    setPressed(true)
    sendPress(ref.hostId, ref.page, ref.row, ref.col, true)
  }, [mode, ref, sendPress])

  const handlePointerUp = useCallback(() => {
    if (mode !== 'view' || !pressed) return
    setPressed(false)
    sendPress(ref.hostId, ref.page, ref.row, ref.col, false)
  }, [mode, ref, sendPress, pressed])

  const handlePointerLeave = useCallback(() => {
    if (mode !== 'view' || !pressed) return
    setPressed(false)
    sendPress(ref.hostId, ref.page, ref.row, ref.col, false)
  }, [mode, ref, sendPress, pressed])

  const bgColor = keyState?.bgColor
  const textColor = keyState?.textColor ?? '#ffffff'
  const text = keyState?.text ?? ''
  const bitmap = keyState?.bitmap
  // LED-Variante: leuchtet nur bei aktivem (gesättigtem/hellem) Feedback-Farbwechsel
  const lit = isLit(bgColor)

  const bitmapSrc = useMemo(
    () => (showBitmap && bitmap ? rawRgbBase64ToDataUrl(bitmap, bitmapSize, bitmapSize) : ''),
    [showBitmap, bitmap, bitmapSize],
  )

  // ─── Positionierung ────────────────────────────────────────────────────────
  const positionBase: React.CSSProperties = isContained
    ? { position: 'relative' as const, width: '100%', height: '100%' }
    : { position: 'absolute' as const, left: element.x, top: element.y,
        width: element.w, height: element.h, zIndex: (element.layer ?? defaultLayerFor(element.type)) * 1000 + (element.z ?? 0) + 100 }

  // Gemeinsame Interaktions-Props (alle Varianten)
  const interaction: React.CSSProperties = {
    cursor: mode === 'view' ? 'pointer' : 'default',
    userSelect: 'none',
    touchAction: 'none',
    boxSizing: 'border-box',
  }

  // Opacity-/Stale-Overlay auf dem äußersten Container (alle Varianten)
  const stateOverlay: React.CSSProperties = {
    ...(!hasData && { opacity: 0.6 }),
    ...(isStale && { opacity: 0.5, outline: '2px solid #ff8a3d', outlineOffset: '-2px' }),
  }

  // ─── Text-Positionierung ──────────────────────────────────────────────────
  // Cap font size so text doesn't overflow small buttons
  const effectiveFontSize = Math.min(fontSize, Math.max(7, Math.floor(element.h * 0.22)))

  const textPos: React.CSSProperties =
    textAlign === 'top'
      ? { top: 4 }
      : textAlign === 'center'
      ? { top: '50%', transform: 'translateY(-50%)' }
      : { bottom: 4 }

  const textStyle: React.CSSProperties = {
    position: 'absolute',
    left: 4,
    right: 4,
    color: textColor,
    fontSize: effectiveFontSize,
    fontWeight: 600,
    fontFamily: "'Inter', system-ui, sans-serif",
    textAlign: 'center',
    lineHeight: 1.3,
    pointerEvents: 'none',
    overflow: 'hidden',
    textShadow: bgColor ? '0 1px 3px rgba(0,0,0,0.6)' : 'none',
    ...textPos,
  }

  // ─── Wiederverwendbare Kind-Elemente ───────────────────────────────────────
  const bitmapImg = bitmapSrc ? (
    <img
      src={bitmapSrc}
      {...(scaleBitmap
        ? { style: { display: 'block', width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'auto', pointerEvents: 'none' } as React.CSSProperties }
        : { width: bitmapSize, height: bitmapSize, style: { display: 'block', imageRendering: 'pixelated', pointerEvents: 'none', flexShrink: 0 } as React.CSSProperties }
      )}
      alt=""
      draggable={false}
    />
  ) : null

  const textLines = text.split('\n').map((line, i, arr) =>
    i < arr.length - 1
      ? <React.Fragment key={i}>{line}<br /></React.Fragment>
      : <React.Fragment key={i}>{line}</React.Fragment>,
  )

  const indicators = (
    <>
      {hostMissing && (
        <div
          title="Host nicht mehr in den Settings vorhanden"
          style={{ position: 'absolute', top: 2, right: 4, fontSize: 11, pointerEvents: 'none' }}
        >
          ⛔
        </div>
      )}
      {!hostMissing && isStale && (
        <div style={{ position: 'absolute', top: 2, right: 4, fontSize: 10, color: '#ff8a3d', pointerEvents: 'none' }}>
          ⚠
        </div>
      )}
      {mode === 'edit' && showHostLabels && (
        <>
          {/* Oben: Companion-Referenz (Page/Row/Col) — überlappend, wie das Host-Label */}
          <div style={{
            position: 'absolute', top: 2, left: 2, right: 2,
            fontSize: 8, color: 'rgba(255,255,255,0.75)', textAlign: 'center',
            background: 'rgba(0,0,0,0.55)', borderRadius: 2, padding: '1px 2px',
            pointerEvents: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            P{ref.page} · R{ref.row}/C{ref.col}
          </div>
          {/* Unten: Host-Name */}
          <div style={{
            position: 'absolute', bottom: 2, left: 2, right: 2,
            fontSize: 8, color: 'rgba(255,255,255,0.75)', textAlign: 'center',
            background: 'rgba(0,0,0,0.55)', borderRadius: 2, padding: '1px 2px',
            pointerEvents: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {hostName}
          </div>
        </>
      )}
    </>
  )

  const pointerHandlers = {
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerUp,
    onPointerLeave: handlePointerLeave,
    onPointerCancel: handlePointerLeave,
  }

  // ─── Physischer Taster (Dome pro Button / Broadcast-LED global) ─────────────
  // Struktur: Rand/Kragen (Vertiefung) → bewegliche Kappe → (bei Dome) konkave Mulde.
  // Kein scale beim Drücken — der Hub (translateY) + kollabierende Schatten tragen die Physik.
  // Keine rote Pressed-Outline im View-Mode — der Hub + Glow ersetzt sie (Spec Abschnitt 7).
  if (physicalDome || broadcastLed) {
    // Dome + forceBlackCap (LED-Modus): Dome-Geometrie bleibt, aber die Kappe wird
    // vom Referenz-Schwarz #1d1f23 abgeleitet statt von der Companion-Farbe —
    // dunkle Hardware-Optik wie die LED-Kappen (Referenz: „PV Programm Aximmetry").
    const domeColor = forceBlackCap ? '#1d1f23' : bgColor
    // Dome im LED-Modus + aktives Feedback: LED-Leuchten auch am Dome —
    // Außen-Glow am Rand (Recess) + Leucht-Overlay über der Mulde (siehe unten).
    const domeLedLit = !broadcastLed && ledModeActive && lit
    let recess = broadcastLed ? LED_COLLAR_STYLE : buildDomeRecessStyle(domeColor)
    if (domeLedLit) {
      recess = { ...recess, boxShadow: `${recess.boxShadow}, ${ledGlowShadow(bgColor, pressed)}` }
    }
    // position:relative + overflow:hidden → Bitmap/Text sitzen in der Kappe und fahren den Hub mit
    const cap: React.CSSProperties = {
      ...(broadcastLed ? buildLedCapStyle(bgColor, pressed, lit, forceBlackCap) : buildDomeCapStyle(domeColor, pressed)),
      position: 'relative',
      overflow: 'hidden',
    }
    const outer: React.CSSProperties = {
      ...positionBase,
      // Kragen-Radius: Button-Radius + 4px (LED, Spec Abschnitt 2) bzw. + 5px (Dome)
      borderRadius: borderRadius + (broadcastLed ? 4 : 5),
      overflow: 'visible',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...interaction,
      ...recess,
      ...stateOverlay,
    }
    // Im LED-Modus (auch auf Domes): unlit glüht die Legende in ihrer eigenen
    // Farbe (roter „CUT"-Schriftzug glüht rot); lit wird sie DURCHLEUCHTET —
    // fast-weißes LED-Tint + zweischichtiger Glow in der LED-Farbe (bgColor).
    // overflow MUSS hier 'visible' sein: overflow:hidden clippt den text-shadow
    // hart an der Span-Box → farbiges Rechteck statt Glow. Die Kappe selbst
    // clippt mit overflow:hidden — das ist die physische Lichtgrenze.
    const legend = ledModeActive ? buildLedLegend(bgColor, textColor, pressed, lit, effectiveFontSize) : null
    const ledText: React.CSSProperties = legend
      ? { ...textStyle, overflow: 'visible', ...(legend.color && { color: legend.color }), textShadow: legend.textShadow }
      : textStyle
    return (
      <div style={outer} {...pointerHandlers}>
        <div style={cap}>
          {bitmapImg}
          {!broadcastLed && <div aria-hidden="true" style={buildDomeStyle(domeColor, pressed)} />}
          {/* Aktives Feedback im LED-Modus: die LED durchleuchtet auch die Dome-Mulde */}
          {domeLedLit && <div aria-hidden="true" style={buildDomeLedGlow(bgColor, pressed)} />}
          {showText && text && <span style={ledText}>{textLines}</span>}
        </div>
        {indicators}
      </div>
    )
  }

  // ─── Standard-Button (kein physischer Stil) ─────────────────────────────────
  const containerStyle: React.CSSProperties = {
    ...positionBase,
    borderRadius,
    overflow: 'hidden',
    ...interaction,
    background: showBgColor && bgColor ? bgColor : (hasData ? '#1a2030' : 'transparent'),
    ...(!hasData && !isStale && { border: '1.5px dashed #2a3344', opacity: 0.6 }),
    ...(isStale && { opacity: 0.5, outline: '2px solid #ff8a3d', outlineOffset: '-2px' }),
    ...(pressed && { transform: 'scale(0.97)', outline: '2.5px solid #ff5a5f', outlineOffset: '-2px' }),
    transition: pressed ? 'none' : 'transform 0.08s, box-shadow 0.08s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...(hasData && {
      boxShadow: pressed
        ? '0 1px 2px rgba(0,0,0,0.4)'
        : '0 3px 8px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.3)',
    }),
  }

  return (
    <div style={containerStyle} {...pointerHandlers}>
      {bitmapImg}

      {/* Normales 3D-Bevel-Overlay (nur wenn Daten vorhanden) */}
      {hasData && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius,
            pointerEvents: 'none',
            boxShadow: pressed
              ? 'inset 0 2px 5px rgba(0,0,0,0.65), inset 2px 0 4px rgba(0,0,0,0.45), inset 0 -1px 2px rgba(255,255,255,0.07), inset -1px 0 2px rgba(255,255,255,0.05)'
              : 'inset 0 1.5px 2px rgba(255,255,255,0.22), inset 1.5px 0 2px rgba(255,255,255,0.11), inset 0 -2.5px 5px rgba(0,0,0,0.60), inset -2.5px 0 4px rgba(0,0,0,0.42)',
            transition: pressed ? 'none' : 'box-shadow 0.08s',
          }}
        />
      )}

      {showText && text && <span style={textStyle}>{textLines}</span>}

      {indicators}
    </div>
  )
})

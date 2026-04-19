import React, { useState, useCallback, useMemo } from 'react'
import { CompanionButtonElement as CompanionButtonElementType } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { rawRgbBase64ToDataUrl } from '../../utils/bitmap'

/** Blends hex color channels toward white. amount: 0=unchanged, 1=white */
export function lightenHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r + (255 - r) * amount)},${Math.round(g + (255 - g) * amount)},${Math.round(b + (255 - b) * amount)})`
}

/** Multiplies hex color channels toward black. amount: 0=unchanged, 1=black */
export function darkenHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * (1 - amount))},${Math.round(g * (1 - amount))},${Math.round(b * (1 - amount))})`
}

/** CSS background for the physical-style dome.
 *  Center and rim colors are computed from bgColor (lighten/darken) — no white/black overlays
 *  so the hue stays correct across all companion colors (including black buttons). */
export function buildDomeBackground(bgColor: string | undefined, pressed: boolean): string {
  let r = 168, g = 170, b = 178
  if (bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor)) {
    r = parseInt(bgColor.slice(1, 3), 16)
    g = parseInt(bgColor.slice(3, 5), 16)
    b = parseInt(bgColor.slice(5, 7), 16)
  }
  // mix toward white; dim toward black
  const mix = (ch: number, f: number) => Math.round(ch + (255 - ch) * f)
  const dim  = (ch: number, f: number) => Math.round(ch * f)

  // 4-stop curve approximating cos(θ) hemispheric reflectance:
  // center changes slowly, outer rim drops steeply — matches reference image physics
  if (pressed) {
    const br = dim(r, 0.82), bg_ = dim(g, 0.82), bb_ = dim(b, 0.82)
    return `radial-gradient(circle at 50% 45%,` +
      ` rgb(${mix(br,0.24)},${mix(bg_,0.24)},${mix(bb_,0.24)}) 0%,` +
      ` rgb(${br},${bg_},${bb_}) 42%,` +
      ` rgb(${dim(br,0.68)},${dim(bg_,0.68)},${dim(bb_,0.68)}) 68%,` +
      ` rgb(${dim(br,0.36)},${dim(bg_,0.36)},${dim(bb_,0.36)}) 100%)`
  }
  return `radial-gradient(circle at 50% 40%,` +
    ` rgb(${mix(r,0.52)},${mix(g,0.52)},${mix(b,0.52)}) 0%,` +
    ` rgb(${r},${g},${b}) 38%,` +
    ` rgb(${dim(r,0.66)},${dim(g,0.66)},${dim(b,0.66)}) 65%,` +
    ` rgb(${dim(r,0.35)},${dim(g,0.35)},${dim(b,0.35)}) 100%)`
}

/** CSS background for the physical-style outer frame.
 *  Layers (top→bottom):
 *  1. Metallic top-edge highlight — horizontal bright band simulating overhead light on polished surface
 *  2. Radial vignette — corners/edges significantly darker → strong 3D curvature illusion
 *  3. Base color (companion color or default grey) */
export function buildFrameBackground(bgColor: string | undefined, pressed: boolean): string {
  let r = 210, g = 212, b = 218
  if (bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor)) {
    r = parseInt(bgColor.slice(1, 3), 16)
    g = parseInt(bgColor.slice(3, 5), 16)
    b = parseInt(bgColor.slice(5, 7), 16)
  }
  // Polished-metal top highlight: bright band at top edge (light source from above),
  // quick fade + slight bottom shadow = realistic curved-surface reflection
  const metal = pressed
    ? `linear-gradient(to bottom, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 28%, rgba(0,0,0,0.10) 100%)`
    : `linear-gradient(to bottom, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0.08) 18%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.16) 100%)`
  // Stronger radial vignette: smaller ellipse + higher opacity → darker corners, more curvature depth
  const vignette = pressed
    ? `radial-gradient(ellipse 65% 65% at 50% 50%, rgba(0,0,0,0) 24%, rgba(0,0,0,0.58) 100%)`
    : `radial-gradient(ellipse 65% 65% at 50% 50%, rgba(0,0,0,0) 26%, rgba(0,0,0,0.52) 100%)`
  return `${metal}, ${vignette}, rgb(${r},${g},${b})`
}

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
  const physicalStyle = render?.physicalStyle === true

  // Button-State direkt per row/col — kein keysPerRow-Lookup mehr nötig
  const keyState = useAppStore((s) => s.getButtonState(ref.hostId, ref.page, ref.row, ref.col))
  // Session-Status pro Host (nicht mehr pro Page)
  const sessionStatus = useAppStore((s) => s.getSessionStatus(ref.hostId))
  // Prüfen ob der Host noch in den Settings existiert
  const hostMissing = useAppStore((s) => !s.hostExists(ref.hostId))

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

  const bitmapSrc = useMemo(
    () => (showBitmap && bitmap ? rawRgbBase64ToDataUrl(bitmap, bitmapSize, bitmapSize) : ''),
    [showBitmap, bitmap, bitmapSize],
  )

  // ─── Container ────────────────────────────────────────────────────────────
  const positionBase: React.CSSProperties = isContained
    ? { position: 'relative' as const, width: '100%', height: '100%' }
    : { position: 'absolute' as const, left: element.x, top: element.y,
        width: element.w, height: element.h, zIndex: element.z }

  const containerStyle: React.CSSProperties = physicalStyle
    ? {
        ...positionBase,
        borderRadius,
        overflow: 'hidden',
        cursor: mode === 'view' ? 'pointer' : 'default',
        userSelect: 'none',
        touchAction: 'none',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: buildFrameBackground(bgColor, pressed),
        boxShadow: pressed
          ? '0 1px 4px rgba(0,0,0,0.55), inset 0 1px 3px rgba(0,0,0,0.25)'
          : '0 4px 14px rgba(0,0,0,0.50), inset 0 1px 2px rgba(255,255,255,0.60)',
        transition: pressed ? 'none' : 'transform 0.08s, box-shadow 0.08s',
        ...(!hasData && { opacity: 0.6 }),
        ...(isStale && { opacity: 0.5, outline: '2px solid #ff8a3d', outlineOffset: '-2px' }),
        ...(pressed && { outline: '2.5px solid #ff5a5f', outlineOffset: '-2px' }),
      }
    : {
        ...positionBase,
        borderRadius,
        overflow: 'hidden',
        cursor: mode === 'view' ? 'pointer' : 'default',
        userSelect: 'none',
        touchAction: 'none',
        boxSizing: 'border-box',
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

  // ─── Text-Positionierung ──────────────────────────────────────────────────
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
    fontSize,
    fontWeight: 600,
    fontFamily: "'Inter', system-ui, sans-serif",
    textAlign: 'center',
    lineHeight: 1.3,
    pointerEvents: 'none',
    textShadow: bgColor ? '0 1px 3px rgba(0,0,0,0.6)' : 'none',
    ...textPos,
  }

  return (
    <div
      style={containerStyle}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
    >
      {bitmapSrc && (
        <img
          src={bitmapSrc}
          {...(scaleBitmap
            ? { style: { display: 'block', width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'auto', pointerEvents: 'none' } }
            : { width: bitmapSize, height: bitmapSize, style: { display: 'block', imageRendering: 'pixelated', pointerEvents: 'none', flexShrink: 0 } }
          )}
          alt=""
          draggable={false}
        />
      )}

      {/* Physical dome OR normal 3D bevel overlay */}
      {physicalStyle ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '9%',
            borderRadius: '50%',
            pointerEvents: 'none',
            background: buildDomeBackground(bgColor, pressed),
            // The gradient itself creates the dome edge; just a hairline ring for separation
            boxShadow: '0 0 0 1px rgba(0,0,0,0.10)',
            transform: pressed ? 'scale(0.97)' : undefined,
            transition: pressed ? 'none' : 'transform 0.08s',
          }}
        />
      ) : hasData ? (
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
      ) : null}

      {showText && text && (
        <span style={textStyle}>
          {text.split('\n').map((line, i, arr) =>
            i < arr.length - 1
              ? <React.Fragment key={i}>{line}<br /></React.Fragment>
              : <React.Fragment key={i}>{line}</React.Fragment>
          )}
        </span>
      )}

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
    </div>
  )
})

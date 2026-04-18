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

/** CSS background value for the physical-style dome circle.
 *  bgColor must be #rrggbb — anything else falls back to the default grey dome. */
export function buildDomeBackground(bgColor: string | undefined, pressed: boolean): string {
  const s1 = pressed ? 0.6 : 0.9
  const s2 = pressed ? 0.3 : 0.4
  if (bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor)) {
    const r = parseInt(bgColor.slice(1, 3), 16)
    const g = parseInt(bgColor.slice(3, 5), 16)
    const b = parseInt(bgColor.slice(5, 7), 16)
    return [
      `radial-gradient(ellipse 80% 50% at 50% 70%, rgba(${r},${g},${b},${s1}) 0%, rgba(${r},${g},${b},${s2}) 35%, transparent 70%)`,
      `radial-gradient(circle at 50% 50%, ${lightenHex(bgColor, 0.5)} 0%, ${bgColor} 48%, ${darkenHex(bgColor, 0.6)} 100%)`,
    ].join(', ')
  }
  return [
    `radial-gradient(ellipse 80% 50% at 50% 70%, rgba(255,255,255,${s1}) 0%, rgba(255,255,255,${s2}) 35%, transparent 70%)`,
    `radial-gradient(circle at 50% 50%, #f4f6fa 0%, #e0e4ec 25%, #c8ccd8 48%, #a8acb8 65%, #888c98 80%, #6c7080 92%, #545868 100%)`,
  ].join(', ')
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
        background: pressed
          ? 'linear-gradient(145deg, #a8acb8 0%, #d4d8e0 30%, #ccd0d8 50%, #b0b4c0 75%, #909098 100%)'
          : 'linear-gradient(145deg, #c0c4ce 0%, #eceef6 30%, #e4e8f0 50%, #c4c8d4 75%, #a0a4b0 100%)',
        boxShadow: pressed
          ? '0 2px 6px rgba(0,0,0,0.7), inset 0 2px 5px rgba(0,0,0,0.35), inset 0 -1px 2px rgba(255,255,255,0.3)'
          : '0 6px 20px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.9), inset 0 -1px 3px rgba(0,0,0,0.2)',
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
            inset: '10px',
            borderRadius: '50%',
            pointerEvents: 'none',
            background: buildDomeBackground(bgColor, pressed),
            boxShadow: pressed
              ? 'inset 0 3px 12px rgba(0,0,0,0.25), inset 0 5px 20px rgba(0,0,0,0.15), inset 2px 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.3)'
              : 'inset 0 2px 8px rgba(0,0,0,0.18), inset 0 4px 16px rgba(0,0,0,0.10), inset 2px 2px 6px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.25)',
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

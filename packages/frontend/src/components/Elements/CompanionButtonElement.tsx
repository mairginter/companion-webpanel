import React, { useState, useCallback, useMemo } from 'react'
import { CompanionButtonElement as CompanionButtonElementType, keyIndex } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { rawRgbBase64ToDataUrl } from '../../utils/bitmap'

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
  const showText = render?.showText !== false          // default: true
  const showBgColor = render?.showBgColor !== false    // default: true
  const textAlign = render?.textAlign ?? 'bottom'
  const fontSize = render?.fontSize ?? 11

  const keysPerRow = useAppStore((s) => {
    const pk = `${ref.hostId}:${ref.page}`
    return s.settings?.wizard?.pageAssignments?.[pk]?.surfaceConfig.keysPerRow ?? 8
  })

  const keyIdx = keyIndex(ref.row, ref.col, keysPerRow)
  const keyState = useAppStore((s) => s.getButtonState(ref.hostId, ref.page, keyIdx))
  const sessionStatus = useAppStore((s) => s.getSessionStatus(ref.hostId, ref.page))

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

  // Konvertierung Raw-RGB → Data-URL, nur wenn showBitmap aktiv
  const bitmapSrc = useMemo(
    () => (showBitmap && bitmap ? rawRgbBase64ToDataUrl(bitmap, bitmapSize, bitmapSize) : ''),
    [showBitmap, bitmap, bitmapSize],
  )

  // ─── Container ────────────────────────────────────────────────────────────
  const containerStyle: React.CSSProperties = {
    // isContained: EditableElement übernimmt position/left/top/width/height
    ...(isContained
      ? { position: 'relative' as const, width: '100%', height: '100%' }
      : { position: 'absolute' as const, left: element.x, top: element.y,
          width: element.w, height: element.h, zIndex: element.z }
    ),
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
    transition: pressed ? 'none' : 'transform 0.08s',
    // Flex: Bitmap zentriert, Text als Overlay
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  // ─── Text-Positionierung ──────────────────────────────────────────────────
  // Kein Bitmap → Text vollflächig zentriert
  // Mit Bitmap → Text per textAlign (top/center/bottom)
  const textPos: React.CSSProperties =
    textAlign === 'top'
      ? { top: 4 }
      : textAlign === 'center'
      ? { top: '50%', transform: 'translateY(-50%)' }
      : { bottom: 4 }  // 'bottom' ist default

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
      {/* Bitmap — nur rendern wenn Data-URL erfolgreich erzeugt */}
      {bitmapSrc && (
        <img
          src={bitmapSrc}
          width={bitmapSize}
          height={bitmapSize}
          style={{ display: 'block', imageRendering: 'pixelated', pointerEvents: 'none', flexShrink: 0 }}
          alt=""
          draggable={false}
        />
      )}

      {/* Text — mehrzeilig, zentriert */}
      {showText && text && (
        <span style={textStyle}>
          {text.split('\n').map((line, i, arr) =>
            i < arr.length - 1
              ? <React.Fragment key={i}>{line}<br /></React.Fragment>
              : <React.Fragment key={i}>{line}</React.Fragment>
          )}
        </span>
      )}

      {/* Stale-Indikator */}
      {isStale && (
        <div style={{ position: 'absolute', top: 2, right: 4, fontSize: 10, color: '#ff8a3d', pointerEvents: 'none' }}>
          ⚠
        </div>
      )}
    </div>
  )
})


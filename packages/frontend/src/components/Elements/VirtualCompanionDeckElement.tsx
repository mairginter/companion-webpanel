/**
 * VirtualCompanionDeckElement.tsx
 *
 * Rendert ein Virtual Companion Deck auf dem Canvas.
 * Hintergrund: farbige Shape mit Opacity.
 * Buttons: CSS-Grid, skalieren mit Element-W/H.
 * Jede Zelle: identische Rendering-Logik wie CompanionButtonElement.
 * View-Mode: Klick → sendVPress(deviceId, keyIndex, true/false)
 */
import React, { useState, useCallback, useMemo } from 'react'
import { VirtualCompanionDeckElement as VirtualCompanionDeckElementType } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { rawRgbBase64ToDataUrl } from '../../utils/bitmap'

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

interface Props {
  element: VirtualCompanionDeckElementType
  mode: 'view' | 'edit'
  sendVPress: (deviceId: string, keyIndex: number, pressed: boolean) => void
  isContained?: boolean
}

/**
 * Einzelner Button innerhalb des Decks.
 * keyIndex = row * cols + col
 */
const DeckButton = React.memo(function DeckButton({
  deviceId,
  keyIndex,
  mode,
  render,
  sendVPress,
}: {
  deviceId: string
  keyIndex: number
  mode: 'view' | 'edit'
  render: VirtualCompanionDeckElementType['render']
  sendVPress: Props['sendVPress']
}) {
  const keyState = useAppStore((s) => s.getVirtualKeyState(deviceId, keyIndex))

  const showBitmap  = render?.showBitmap === true
  const scaleBitmap = render?.scaleBitmap !== false
  const showText    = render?.showText !== false
  const showBgColor = render?.showBgColor !== false
  const borderRadius = render?.borderRadius ?? 4
  const emptyButtonColor = render?.emptyButtonColor ?? '#111'
  const fontSize    = render?.fontSize ?? 11
  const textAlign   = render?.textAlign ?? 'bottom'
  const bitmapSize  = 72

  const [pressed, setPressed] = useState(false)

  const handlePointerDown = useCallback(() => {
    if (mode !== 'view') return
    setPressed(true)
    sendVPress(deviceId, keyIndex, true)
  }, [mode, deviceId, keyIndex, sendVPress])

  const handlePointerUp = useCallback(() => {
    if (mode !== 'view' || !pressed) return
    setPressed(false)
    sendVPress(deviceId, keyIndex, false)
  }, [mode, deviceId, keyIndex, sendVPress, pressed])

  const handlePointerLeave = useCallback(() => {
    if (mode !== 'view' || !pressed) return
    setPressed(false)
    sendVPress(deviceId, keyIndex, false)
  }, [mode, deviceId, keyIndex, sendVPress, pressed])

  const bgColor   = keyState?.bgColor
  const textColor = keyState?.textColor ?? '#ffffff'
  const text      = keyState?.text ?? ''
  const bitmap    = keyState?.bitmap

  const bitmapSrc = useMemo(
    () => (showBitmap && bitmap ? rawRgbBase64ToDataUrl(bitmap, bitmapSize, bitmapSize) : ''),
    [showBitmap, bitmap],
  )

  const hasData = !!bgColor || !!bitmap || !!text

  const textPos: React.CSSProperties =
    textAlign === 'top'    ? { top: 4 } :
    textAlign === 'center' ? { top: '50%', transform: 'translateY(-50%)' } :
                             { bottom: 4 }

  return (
    <div
      style={{
        position: 'relative',
        borderRadius,
        overflow: 'hidden',
        cursor: mode === 'view' ? 'pointer' : 'default',
        userSelect: 'none',
        touchAction: 'none',
        aspectRatio: '1',
        background: showBgColor && bgColor ? bgColor : (hasData ? '#1a2030' : emptyButtonColor),
        ...(!hasData && { border: '1px solid #1e2530', opacity: 0.6 }),
        ...(pressed && { transform: 'scale(0.95)', outline: '2px solid #ff5a5f', outlineOffset: '-2px' }),
        transition: pressed ? 'none' : 'transform 0.08s, box-shadow 0.08s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        // Äußerer Drop-Shadow für Tiefe
        ...(hasData && {
          boxShadow: pressed
            ? '0 1px 2px rgba(0,0,0,0.4)'
            : '0 3px 8px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.3)',
        }),
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
    >
      {bitmapSrc && (
        <img
          src={bitmapSrc}
          style={scaleBitmap
            ? { display: 'block', width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'auto', pointerEvents: 'none' }
            : { display: 'block', width: bitmapSize, height: bitmapSize, imageRendering: 'pixelated', pointerEvents: 'none', flexShrink: 0 }
          }
          alt=""
          draggable={false}
        />
      )}
      {/* 3D-Bevel-Overlay: Inset-Shadow am Randbereich, Text/Bitmap bleiben frei */}
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

      {showText && text && (
        <span style={{
          position: 'absolute',
          left: 3, right: 3,
          color: textColor,
          fontSize,
          fontWeight: 600,
          fontFamily: "'Inter', system-ui, sans-serif",
          textAlign: 'center',
          lineHeight: 1.3,
          pointerEvents: 'none',
          textShadow: bgColor ? '0 1px 3px rgba(0,0,0,0.6)' : 'none',
          ...textPos,
        }}>
          {text.split('\n').map((line, i, arr) =>
            i < arr.length - 1
              ? <React.Fragment key={i}>{line}<br /></React.Fragment>
              : <React.Fragment key={i}>{line}</React.Fragment>
          )}
        </span>
      )}
    </div>
  )
})

export const VirtualCompanionDeckElement = React.memo(function VirtualCompanionDeckElement({
  element,
  mode,
  sendVPress,
  isContained,
}: Props) {
  const { deviceId, grid, style, render } = element
  const { cols, rows } = grid
  const { fill, opacity, borderRadius, padding, gap } = style

  const vStatus = useAppStore((s) => s.getVirtualSessionStatus(deviceId))
  const isStale = vStatus === 'stale' || vStatus === 'error'

  const containerStyle: React.CSSProperties = {
    ...(isContained
      ? { position: 'relative' as const, width: '100%', height: '100%' }
      : { position: 'absolute' as const, left: element.x, top: element.y,
          width: element.w, height: element.h, zIndex: element.z }
    ),
    background: hexToRgba(fill, opacity),
    borderRadius,
    padding,
    boxSizing: 'border-box',
    overflow: 'hidden',
    // Äußerer Drop-Shadow für Tiefe
    boxShadow: '0 3px 8px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.3)',
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap,
    width: '100%',
    height: '100%',
  }

  return (
    <div style={containerStyle}>
      <div style={gridStyle}>
        {Array.from({ length: cols * rows }, (_, i) => (
          <DeckButton
            key={i}
            deviceId={deviceId}
            keyIndex={i}
            mode={mode}
            render={render}
            sendVPress={sendVPress}
          />
        ))}
      </div>

      {/* 3D-Bevel-Overlay: Inset-Shadow am äußeren Rand des Decks */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius,
          pointerEvents: 'none',
          boxShadow: 'inset 0 1.5px 2px rgba(255,255,255,0.22), inset 1.5px 0 2px rgba(255,255,255,0.11), inset 0 -2.5px 5px rgba(0,0,0,0.60), inset -2.5px 0 4px rgba(0,0,0,0.42)',
        }}
      />

      {isStale && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius,
          pointerEvents: 'none',
        }}>
          <span style={{ color: '#ff8a3d', fontSize: 12, fontWeight: 600 }}>⚠ {vStatus}</span>
        </div>
      )}
    </div>
  )
})

import React from 'react'
import { ShapeElement as ShapeElementType } from '@cwp/shared'

interface Props {
  element: ShapeElementType
  isContained?: boolean
}

export const ShapeElement = React.memo(function ShapeElement({ element, isContained }: Props) {
  const { style } = element
  const borderRadius = style.borderRadius ?? 10
  const hasFill = !!style.fill && style.fill !== 'transparent'

  return (
    <div
      style={{
        ...(isContained
          ? { position: 'relative' as const, width: '100%', height: '100%' }
          : { position: 'absolute' as const, left: element.x, top: element.y,
              width: element.w, height: element.h, zIndex: element.z }
        ),
        borderRadius,
        background: style.fill,
        border: style.stroke
          ? `${style.strokeWidth ?? 1}px solid ${style.stroke}`
          : 'none',
        boxSizing: 'border-box',
        overflow: 'hidden',
        pointerEvents: 'none',
        // Äußerer Drop-Shadow für Tiefe
        ...(hasFill && { boxShadow: '0 3px 8px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.3)' }),
      }}
    >
      {/* 3D-Bevel-Overlay: Inset-Shadow am Randbereich */}
      {hasFill && (
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
      )}
    </div>
  )
})

import React from 'react'
import { ShapeElement as ShapeElementType, defaultLayerFor } from '@cwp/shared'
import { NOISE_URL } from '../../utils/physical'

interface Props {
  element: ShapeElementType
  isContained?: boolean
}

export const ShapeElement = React.memo(function ShapeElement({ element, isContained }: Props) {
  const { style } = element
  const borderRadius = style.borderRadius ?? 10
  const hasFill = !!style.fill && style.fill !== 'transparent'
  // 'plastic' = Kunststoff-Relief (Körnung + Glanz-Verlauf + Reliefschatten); 'flat' = heutiges Verhalten
  const plastic = style.finish === 'plastic' && hasFill

  return (
    <div
      style={{
        ...(isContained
          ? { position: 'relative' as const, width: '100%', height: '100%' }
          : { position: 'absolute' as const, left: element.x, top: element.y,
              width: element.w, height: element.h, zIndex: (element.layer ?? defaultLayerFor(element.type)) * 1000 + (element.z ?? 0) + 100 }
        ),
        borderRadius,
        // Plastik: Körnung + Lichtverlauf über die Füllfarbe; sonst nur Füllfarbe
        background: plastic
          ? `${NOISE_URL}, linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.03) 24%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.16) 100%), ${style.fill}`
          : style.fill,
        border: style.stroke
          ? `${style.strokeWidth ?? 1}px solid ${style.stroke}`
          : 'none',
        boxSizing: 'border-box',
        overflow: 'hidden',
        pointerEvents: 'none',
        // Plastik bringt sein Relief direkt im boxShadow mit (Bevel-Overlay entfällt);
        // flat: äußerer Drop-Shadow für Tiefe
        ...(plastic
          ? { boxShadow: '0 6px 14px rgba(0,0,0,0.5), 0 2px 3px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.32), inset 0 -2px 4px rgba(0,0,0,0.40), inset 1px 0 1px rgba(255,255,255,0.10)' }
          : hasFill && { boxShadow: '0 3px 8px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.3)' }),
      }}
    >
      {/* 3D-Bevel-Overlay: Inset-Shadow am Randbereich — nur im flachen Finish */}
      {hasFill && !plastic && (
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

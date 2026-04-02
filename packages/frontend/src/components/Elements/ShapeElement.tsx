import React from 'react'
import { ShapeElement as ShapeElementType } from '@cwp/shared'

interface Props {
  element: ShapeElementType
  isContained?: boolean
}

export const ShapeElement = React.memo(function ShapeElement({ element, isContained }: Props) {
  const { style } = element
  return (
    <div
      style={{
        ...(isContained
          ? { position: 'relative' as const, width: '100%', height: '100%' }
          : { position: 'absolute' as const, left: element.x, top: element.y,
              width: element.w, height: element.h, zIndex: element.z }
        ),
        borderRadius: style.borderRadius ?? 10,
        background: style.fill,
        border: style.stroke
          ? `${style.strokeWidth ?? 1}px solid ${style.stroke}`
          : 'none',
        boxSizing: 'border-box',
        pointerEvents: 'none',
      }}
    />
  )
})

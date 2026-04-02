import React from 'react'
import { ShapeElement as ShapeElementType } from '@cwp/shared'

interface Props {
  element: ShapeElementType
}

export const ShapeElement = React.memo(function ShapeElement({ element }: Props) {
  const { style } = element
  return (
    <div
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.w,
        height: element.h,
        zIndex: element.z,
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

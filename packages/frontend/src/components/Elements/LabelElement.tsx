import React from 'react'
import { LabelElement as LabelElementType } from '@cwp/shared'

interface Props {
  element: LabelElementType
}

export const LabelElement = React.memo(function LabelElement({ element }: Props) {
  const { text, style } = element
  return (
    <div
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.w,
        height: element.h,
        zIndex: element.z,
        display: 'flex',
        alignItems: 'center',
        justifyContent:
          style?.align === 'right'
            ? 'flex-end'
            : style?.align === 'center'
            ? 'center'
            : 'flex-start',
        color: style?.color ?? '#ffffff',
        fontSize: style?.fontSize ?? 18,
        fontFamily: style?.fontFamily ?? 'Inter, system-ui, sans-serif',
        fontWeight: style?.fontWeight ?? '600',
        overflow: 'hidden',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {text}
    </div>
  )
})

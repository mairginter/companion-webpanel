import React from 'react'
import { LabelElement as LabelElementType, defaultLayerFor } from '@cwp/shared'

interface Props {
  element: LabelElementType
  isContained?: boolean
}

export const LabelElement = React.memo(function LabelElement({ element, isContained }: Props) {
  const { text, style } = element
  return (
    <div
      style={{
        ...(isContained
          ? { position: 'relative' as const, width: '100%', height: '100%' }
          : { position: 'absolute' as const, left: element.x, top: element.y,
              width: element.w, height: element.h, zIndex: (element.layer ?? defaultLayerFor(element.type)) * 1000 + (element.z ?? 0) + 100 }
        ),
        display: 'flex',
        alignItems: 'center',
        justifyContent: style?.align === 'right' ? 'flex-end' : style?.align === 'center' ? 'center' : 'flex-start',
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

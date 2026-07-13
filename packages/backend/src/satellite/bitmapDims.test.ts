// packages/backend/src/satellite/bitmapDims.test.ts
//
// Quantisierung der Element-Geometrie auf Non-square-Bitmap-Dimensionen (Companion 5.0 STYLE).
import { describe, it, expect } from 'vitest'
import { deriveBitmapDims } from './bitmapDims'

describe('deriveBitmapDims', () => {
  it('quadratische Elemente bleiben quadratisch (Passthrough)', () => {
    expect(deriveBitmapDims(100, 100, 72)).toEqual({ w: 72, h: 72 })
    expect(deriveBitmapDims(100, 100, 200)).toEqual({ w: 200, h: 200 })
  })

  it('quantisiert auf die nächste Aspect-Stufe (2:1 Landscape)', () => {
    // 200×100 → exakt 2:1, base = lange Seite
    expect(deriveBitmapDims(200, 100, 144)).toEqual({ w: 144, h: 72 })
  })

  it('quantisiert auf 16:9', () => {
    // 160×90 = 16:9 → base 200 → kurze Seite 200/(16/9)=112.5 → gerade gerundet 112
    expect(deriveBitmapDims(160, 90, 200)).toEqual({ w: 200, h: 112 })
  })

  it('quantisiert auf 4:3 bei nahe liegendem Verhältnis', () => {
    // 130×100 = 1.3 → log-nächste Stufe ist 4:3 (1.333)
    expect(deriveBitmapDims(130, 100, 144)).toEqual({ w: 144, h: 108 })
  })

  it('Portrait: base ist die lange Seite (Höhe)', () => {
    // 100×200 → 1:2 Portrait
    expect(deriveBitmapDims(100, 200, 144)).toEqual({ w: 72, h: 144 })
    // 90×160 = 9:16
    expect(deriveBitmapDims(90, 160, 200)).toEqual({ w: 112, h: 200 })
  })

  it('clampt extreme Verhältnisse auf [1/3, 3] → äußerste Stufe 2:1 bzw. 1:2', () => {
    expect(deriveBitmapDims(1000, 100, 144)).toEqual({ w: 144, h: 72 })
    expect(deriveBitmapDims(100, 1000, 144)).toEqual({ w: 72, h: 144 })
  })

  it('rundet die kurze Seite auf gerade Zahlen', () => {
    // 3:4 bei base 100: kurze Seite 75 → gerade gerundet 76
    const d = deriveBitmapDims(75, 100, 100)
    expect(d.h).toBe(100)
    expect(d.w % 2).toBe(0)
  })

  it('fällt bei ungültiger Geometrie auf Quadrat zurück', () => {
    expect(deriveBitmapDims(0, 100, 72)).toEqual({ w: 72, h: 72 })
    expect(deriveBitmapDims(100, 0, 72)).toEqual({ w: 72, h: 72 })
    expect(deriveBitmapDims(NaN, 100, 72)).toEqual({ w: 72, h: 72 })
  })
})

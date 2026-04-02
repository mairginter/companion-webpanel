import { describe, it, expect } from 'vitest'
import { clampMin, applyResizeDelta, rectsOverlap } from './geometry'

describe('clampMin', () => {
  it('gibt Wert zurück wenn über Minimum', () => {
    expect(clampMin(100, 72)).toBe(100)
  })
  it('gibt Minimum zurück wenn darunter', () => {
    expect(clampMin(50, 72)).toBe(72)
  })
  it('gibt Minimum zurück bei genau Minimum', () => {
    expect(clampMin(72, 72)).toBe(72)
  })
})

describe('applyResizeDelta', () => {
  const base = { x: 100, y: 100, w: 200, h: 150 }

  it('br handle: ändert w und h', () => {
    const result = applyResizeDelta(base, 'br', 20, 10, 8)
    expect(result).toEqual({ x: 100, y: 100, w: 220, h: 160 })
  })
  it('tl handle: ändert x, y, w, h', () => {
    const result = applyResizeDelta(base, 'tl', -10, -20, 8)
    expect(result).toEqual({ x: 90, y: 80, w: 210, h: 170 })
  })
  it('tl handle: respektiert minSize', () => {
    const result = applyResizeDelta(base, 'tl', 195, 0, 8)
    expect(result.w).toBe(8)
    expect(result.x).toBe(base.x + base.w - 8)
  })
  it('ml handle: ändert nur x und w', () => {
    const result = applyResizeDelta(base, 'ml', -30, 50, 8)
    expect(result).toEqual({ x: 70, y: 100, w: 230, h: 150 })
  })
  it('tc handle: ändert nur y und h', () => {
    const result = applyResizeDelta(base, 'tc', 999, -20, 8)
    expect(result).toEqual({ x: 100, y: 80, w: 200, h: 170 })
  })
})

describe('rectsOverlap', () => {
  it('überlappende Rechtecke', () => {
    expect(rectsOverlap(
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 50, y: 50, w: 100, h: 100 }
    )).toBe(true)
  })
  it('nicht überlappende Rechtecke', () => {
    expect(rectsOverlap(
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 200, y: 0, w: 100, h: 100 }
    )).toBe(false)
  })
  it('berühren sich genau — kein Overlap', () => {
    expect(rectsOverlap(
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 100, y: 0, w: 100, h: 100 }
    )).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { lightenHex, darkenHex, buildDomeBackground } from './CompanionButtonElement'

describe('lightenHex', () => {
  it('returns white for amount=1', () => {
    expect(lightenHex('#000000', 1)).toBe('rgb(255,255,255)')
  })
  it('returns unchanged for amount=0', () => {
    expect(lightenHex('#ff0000', 0)).toBe('rgb(255,0,0)')
  })
  it('blends midway toward white', () => {
    expect(lightenHex('#000000', 0.5)).toBe('rgb(128,128,128)')
  })
})

describe('darkenHex', () => {
  it('returns black for amount=1', () => {
    expect(darkenHex('#ffffff', 1)).toBe('rgb(0,0,0)')
  })
  it('returns unchanged for amount=0', () => {
    expect(darkenHex('#ff0000', 0)).toBe('rgb(255,0,0)')
  })
  it('halves all channels for amount=0.5', () => {
    expect(darkenHex('#ffffff', 0.5)).toBe('rgb(128,128,128)')
  })
})

describe('buildDomeBackground', () => {
  it('returns grey gradient when bgColor is undefined', () => {
    const bg = buildDomeBackground(undefined, false)
    expect(bg).toContain('rgba(255,255,255,0.9)')
    expect(bg).toContain('#f4f6fa')
  })
  it('uses bgColor rgba tint for valid #rrggbb hex', () => {
    const bg = buildDomeBackground('#ff0000', false)
    expect(bg).toContain('rgba(255,0,0,')
    expect(bg).not.toContain('#f4f6fa')
  })
  it('uses lower specular opacity when pressed', () => {
    const idle = buildDomeBackground(undefined, false)
    const pressed = buildDomeBackground(undefined, true)
    expect(idle).toContain('rgba(255,255,255,0.9)')
    expect(pressed).toContain('rgba(255,255,255,0.6)')
    expect(pressed).not.toContain('rgba(255,255,255,0.9)')
  })
  it('falls back to grey gradient for non-#rrggbb value', () => {
    const bg = buildDomeBackground('red', false)
    expect(bg).toContain('#f4f6fa')
  })
  it('falls back to grey gradient for 3-char hex', () => {
    const bg = buildDomeBackground('#f00', false)
    expect(bg).toContain('#f4f6fa')
  })
})

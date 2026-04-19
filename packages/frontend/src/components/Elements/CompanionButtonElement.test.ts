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
  // default grey: r=168,g=170,b=178
  // center stop (mix 52%): mix(168,0.52)=256→255? → 168+(255-168)*0.52=168+45.24=213
  // rim stop   (dim 0.35): dim(168,0.35)=59
  it('center lightened, rim darkened for default grey (4-stop curve)', () => {
    const bg = buildDomeBackground(undefined, false)
    expect(bg).toContain('rgb(213,')   // center stop (mix 52%)
    expect(bg).toContain('rgb(168,170,178)')  // base stop at 38%
    expect(bg).toContain('rgb(59,')    // rim stop (dim 0.35)
  })
  it('hue is preserved for red — no white pinpoint', () => {
    const bg = buildDomeBackground('#ff0000', false)
    // center: mix(255,0.52)=255, mix(0,0.52)=133
    expect(bg).toContain('rgb(255,133,133)')
    // base stop: rgb(255,0,0)
    expect(bg).toContain('rgb(255,0,0)')
  })
  it('hue is preserved for black — center is grey, not white', () => {
    const bg = buildDomeBackground('#000000', false)
    // center: mix(0,0.52)=133 for all channels
    expect(bg).toContain('rgb(133,133,133)')
  })
  it('pressed state uses muted highlight and explicit 45% center', () => {
    const pressed = buildDomeBackground(undefined, true)
    expect(pressed).toContain('45%')
    expect(pressed).not.toContain('40%')
  })
  it('falls back to grey for non-#rrggbb value', () => {
    const bg = buildDomeBackground('red', false)
    expect(bg).toContain('rgb(213,')
  })
  it('falls back to grey for 3-char hex', () => {
    const bg = buildDomeBackground('#f00', false)
    expect(bg).toContain('rgb(213,')
  })
})

// packages/frontend/src/utils/bitmap.test.ts
//
// Data-URL-Passthrough (webp/png ab Companion 5.0) — läuft ohne jsdom-Canvas,
// weil der Early-Return vor jeglichem Canvas-Zugriff greift.
import { describe, it, expect } from 'vitest'
import { rawRgbBase64ToDataUrl } from './bitmap'

describe('rawRgbBase64ToDataUrl', () => {
  it('reicht webp-Data-URLs (Companion 5.0) unverändert durch', () => {
    const url = 'data:image/webp;base64,UklGRn4DAABXRUJQ'
    expect(rawRgbBase64ToDataUrl(url, 72, 72)).toBe(url)
  })

  it('reicht png-Data-URLs unverändert durch', () => {
    const url = 'data:image/png;base64,iVBORw0KGgoAAAANSU'
    expect(rawRgbBase64ToDataUrl(url, 144, 72)).toBe(url)
  })
})

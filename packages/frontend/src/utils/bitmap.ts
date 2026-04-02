/**
 * Companion Satellite sendet Bitmaps als Raw-RGB (width*height*3 Bytes, kein Header).
 * Diese Funktion konvertiert base64-Raw-RGB in eine Canvas-Data-URL (PNG).
 * Ergebnis ist gecacht via useMemo im Component.
 */
export function rawRgbBase64ToDataUrl(base64: string, width: number, height: number): string {
  const expectedB64Len = Math.ceil((width * height * 3) / 3) * 4

  // Ist es wirklich Raw-RGB? (Längenprüfung, grobe Toleranz)
  const isRawRgb = Math.abs(base64.length - expectedB64Len) <= 4

  if (!isRawRgb) {
    // JPEG/PNG/etc — direkt verwenden
    const mime = detectMime(base64)
    if (mime) return `data:${mime};base64,${base64}`
    return ''  // unbekanntes Format → nicht rendern
  }

  // Raw-RGB → RGBA → Canvas → PNG data URL
  const binary = atob(base64)
  const pixelCount = width * height
  const rgba = new Uint8ClampedArray(pixelCount * 4)

  for (let i = 0; i < pixelCount; i++) {
    rgba[i * 4]     = binary.charCodeAt(i * 3)      // R
    rgba[i * 4 + 1] = binary.charCodeAt(i * 3 + 1)  // G
    rgba[i * 4 + 2] = binary.charCodeAt(i * 3 + 2)  // B
    rgba[i * 4 + 3] = 255                             // A
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.putImageData(new ImageData(rgba, width, height), 0, 0)
  return canvas.toDataURL('image/png')
}

function detectMime(base64: string): string | null {
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('iVBOR')) return 'image/png'
  if (base64.startsWith('Qk')) return 'image/bmp'
  return null
}

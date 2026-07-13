/**
 * Companion Satellite sendet Bitmaps als Raw-RGB (width*height*3 Bytes, kein Header).
 * Diese Funktion konvertiert base64-Raw-RGB in eine Canvas-Data-URL (PNG).
 *
 * Performance:
 *  - Modul-Level Cache (base64 → Data-URL) — identische Bitmaps werden nicht
 *    erneut kodiert. Da Companion bei Button-Press/Release oft dieselben
 *    Bitmaps schickt, ist die Hit-Rate hoch.
 *  - Shared Canvas-Element wiederverwendet, statt pro Aufruf eins zu erzeugen.
 *  - FIFO-Eviction bei Max-Cache-Size, damit der Speicher nicht endlos wächst.
 */

const MAX_CACHE_SIZE = 500
const EVICT_COUNT = 100

// Map erhält Einfüge-Reihenfolge → FIFO geht via Array.from(keys()).slice(...)
const bitmapCache = new Map<string, string>()
let sharedCanvas: HTMLCanvasElement | null = null

export function rawRgbBase64ToDataUrl(base64: string, width: number, height: number): string {
  // Data-URL (webp/png ab Companion 5.0): selbstbeschreibend — direkt durchreichen,
  // kein Canvas-Roundtrip und kein Cache nötig (<img src> rendert Data-URLs nativ)
  if (base64.startsWith('data:')) return base64

  const cacheKey = `${width}x${height}:${base64}`
  const cached = bitmapCache.get(cacheKey)
  if (cached !== undefined) return cached

  const expectedB64Len = Math.ceil((width * height * 3) / 3) * 4

  // Ist es wirklich Raw-RGB? (Längenprüfung, grobe Toleranz)
  const isRawRgb = Math.abs(base64.length - expectedB64Len) <= 4

  let dataUrl: string

  if (!isRawRgb) {
    // JPEG/PNG/etc — direkt verwenden, kein Canvas-Roundtrip nötig
    const mime = detectMime(base64)
    dataUrl = mime ? `data:${mime};base64,${base64}` : ''
  } else {
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

    if (!sharedCanvas) sharedCanvas = document.createElement('canvas')
    sharedCanvas.width = width
    sharedCanvas.height = height
    const ctx = sharedCanvas.getContext('2d')
    if (!ctx) return ''
    ctx.putImageData(new ImageData(rgba, width, height), 0, 0)
    dataUrl = sharedCanvas.toDataURL('image/png')
  }

  if (bitmapCache.size >= MAX_CACHE_SIZE) {
    // FIFO-Evict: älteste EVICT_COUNT Einträge entfernen (Map behält Insertion-Order)
    const iter = bitmapCache.keys()
    for (let i = 0; i < EVICT_COUNT; i++) {
      const next = iter.next()
      if (next.done) break
      bitmapCache.delete(next.value)
    }
  }
  bitmapCache.set(cacheKey, dataUrl)
  return dataUrl
}

function detectMime(base64: string): string | null {
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('iVBOR')) return 'image/png'
  if (base64.startsWith('Qk')) return 'image/bmp'
  return null
}

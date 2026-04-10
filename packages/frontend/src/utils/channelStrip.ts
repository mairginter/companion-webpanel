/**
 * channelStrip.ts
 *
 * Hilfs-Funktionen für das ChannelStrip-Element:
 *  - parseChannelStripText: Parst den Multi-Wert TEXT-String eines Companion-Buttons
 *  - parsePanValue: Konvertiert Pan-Strings (L20, R10, C, numerisch) → -1.0..+1.0
 *  - isMuted: Bestimmt Mute-State anhand der bgColor des Companion-Buttons
 */

export interface ParsedChannelText {
  meterL?: number
  meterR?: number
  level?: number
  name?: string
}

interface TextIndices {
  meterLIndex?: number
  meterRIndex?: number
  levelIndex?: number
  nameIndex?: number
}

/**
 * Parst einen Multi-Wert TEXT-String aus einem Companion-Button.
 *
 * Beispiel: "-18.5|-12.0|-6.0|Guitar" mit separator="|"
 * → { meterL: -18.5, meterR: -12.0, level: -6.0, name: "Guitar" }
 */
export function parseChannelStripText(
  text: string,
  separator: string,
  indices: TextIndices,
): ParsedChannelText {
  const parts = separator ? text.split(separator) : [text]

  const getNum = (index: number | undefined): number | undefined => {
    if (index === undefined) return undefined
    const raw = parts[index]?.trim()
    if (!raw) return undefined
    // Wing sendet "-oo", andere "-inf" für -∞
    if (raw === '-oo' || raw === '-inf' || raw.toLowerCase() === '-infinity') return -144
    const n = parseFloat(raw)
    return isNaN(n) ? undefined : n
  }

  const getStr = (index: number | undefined): string | undefined => {
    if (index === undefined) return undefined
    const raw = parts[index]?.trim()
    return raw || undefined
  }

  return {
    meterL: getNum(indices.meterLIndex),
    meterR: getNum(indices.meterRIndex),
    level: getNum(indices.levelIndex),
    name: getStr(indices.nameIndex),
  }
}

/**
 * Konvertiert Pan-Strings in einen Wert von -1.0 (full left) bis +1.0 (full right).
 *
 * Unterstützte Formate:
 *  - "C" / "CTR" → 0
 *  - "L20" → -0.2, "R10" → +0.1 (L/R-Offset 0–100 → ±0..1)
 *  - "-0.5" / "0.75" → direkt als Zahl
 */
export function parsePanValue(raw: string): number {
  if (!raw) return 0
  const s = raw.trim().toUpperCase()

  // Center variants
  if (s === 'C' || s === 'CTR' || s === 'CENTER') return 0

  // L/R offset format: "L20" = -0.2, "R10" = +0.1
  const lrMatch = s.match(/^([LR])(\d+)$/)
  if (lrMatch) {
    const offset = parseInt(lrMatch[2], 10) / 100
    return lrMatch[1] === 'L' ? -Math.min(offset, 1) : Math.min(offset, 1)
  }

  // Numeric -1.0..+1.0
  const n = parseFloat(s)
  if (!isNaN(n)) return Math.max(-1, Math.min(1, n))

  return 0
}

/**
 * Bestimmt ob ein Companion-Button im "muted/active"-Zustand ist,
 * anhand seiner bgColor. Dunkle Farben (< 5% Helligkeit) = inaktiv.
 * Jede helle/gesättigte Farbe = aktiv.
 */
export function isMuted(bgColor: string | undefined): boolean {
  if (!bgColor) return false
  const hex = bgColor.replace('#', '')
  if (hex.length !== 6) return false
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  // Relative Luminanz (WCAG-Formel, vereinfacht ohne Gamma-Korrektur)
  // Threshold 0.15: Companion-Surface-Farben (#0a0e14 ≈ 0.053, #121821 ≈ 0.092) bleiben false
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.15
}

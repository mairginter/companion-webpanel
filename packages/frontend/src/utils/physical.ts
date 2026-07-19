/**
 * physical.ts
 *
 * Reine (seiteneffektfreie) CSS-Helfer für die physischen Taster-Optiken.
 * Zwei Varianten:
 *   - 'dome' — matte Gummi-/Kunststoff-Kappe in einer Vertiefung mit konkaver Mulde
 *   - 'led'  — dunkle Kappe in einem Metallkragen, die Companion-Farbe leuchtet als LED
 *
 * Alle Funktionen sind bewusst pur (nur Farb-/String-Mathematik, keine DOM- oder
 * React-Abhängigkeit außer dem CSSProperties-Typ) → direkt unit-testbar
 * (siehe physical.test.ts). Sowohl CompanionButtonElement als auch ShapeElement
 * (Plastik-Finish) teilen sich `NOISE_URL` und die Farb-Primitive von hier.
 */
import type { CSSProperties } from 'react'

/** RGB-Tupel — [r, g, b] je 0…255 */
export type RGB = [number, number, number]

/** Feine Spritzguss-Körnung als wiederverwendbare Noise-Layer (SVG data URI). */
export const NOISE_URL =
  `url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27140%27 height=%27140%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3CfeColorMatrix type=%27saturate%27 values=%270%27/%3E%3C/filter%3E%3Crect width=%27140%27 height=%27140%27 filter=%27url(%23n)%27 opacity=%270.06%27/%3E%3C/svg%3E')`

// ─── Farb-Primitive ───────────────────────────────────────────────────────────

/** Parst "#rrggbb" in ein RGB-Tupel; bei ungültigem/fehlendem Wert → fallback. */
export function parseHex(hex: string | undefined, fallback: RGB): RGB {
  if (hex && /^#[0-9a-fA-F]{6}$/.test(hex)) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
  }
  return fallback
}

/** Mischt jeden Kanal Richtung Weiß. f: 0 = unverändert, 1 = weiß. */
export const mix = (c: RGB, f: number): RGB =>
  c.map((ch) => Math.round(ch + (255 - ch) * f)) as RGB

/** Dimmt jeden Kanal Richtung Schwarz um den Bruchteil f (×(1−f)). f: 0 = unverändert, 1 = schwarz. */
export const dim = (c: RGB, f: number): RGB =>
  c.map((ch) => Math.round(ch * (1 - f))) as RGB

/** RGB-Tupel → CSS "rgb(r,g,b)". */
export const rgb = (c: RGB): string => `rgb(${c[0]},${c[1]},${c[2]})`

/**
 * Aktiv-Heuristik für die LED-Variante: Companion signalisiert „aktiv" über einen
 * Farbwechsel des Buttons. Gesättigte/helle Feedback-Farben leuchten (LED an),
 * dunkle/graue Defaults glimmen nur. Schwelle = relative Luminanz > 0.18.
 */
export function isLit(bgColor: string | undefined): boolean {
  const [r, g, b] = parseHex(bgColor, [0, 0, 0])
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.18
}

// ─── Variante 'dome' (2a) ─────────────────────────────────────────────────────
// 3 Schichten: Rand (Vertiefung) → Kappe → konkave Mulde.

/**
 * Äußerer Container / Rand. Der Rand hat dieselbe Farbe wie die Kappe —
 * die Vertiefung entsteht rein aus dem Innenschatten (kein Farbrand).
 */
export function buildDomeRecessStyle(bgColor: string | undefined): CSSProperties {
  const cap = dim(parseHex(bgColor, [168, 170, 178]), 0.17) // Kappen-/Randfarbe = bgColor × 0.83
  return {
    padding: 5,
    background: rgb(cap),
    boxShadow:
      'inset 0 3px 7px rgba(0,0,0,0.50), inset 2px 0 4px rgba(0,0,0,0.20), ' +
      'inset -2px 0 4px rgba(0,0,0,0.20), inset 0 -1px 2px rgba(255,255,255,0.20), ' +
      '0 2px 5px rgba(0,0,0,0.35)',
  }
}

/** Matte Kappe in der Vertiefung. pressed: Hub nach unten, Licht dimmt. */
export function buildDomeCapStyle(bgColor: string | undefined, pressed: boolean): CSSProperties {
  const base = parseHex(bgColor, [168, 170, 178])
  const cap = dim(base, pressed ? 0.28 : 0.17)
  const gloss = pressed
    ? 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 30%, rgba(0,0,0,0.22) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 30%, rgba(0,0,0,0.18) 100%)'
  return {
    width: '100%',
    height: '100%',
    borderRadius: 7,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transform: pressed ? 'translateY(2px)' : 'translateY(-1.5px)',
    background: `${NOISE_URL}, ${gloss}, ${rgb(cap)}`,
    boxShadow: pressed
      ? '0 1px 2px rgba(0,0,0,0.7), inset 0 2px 3px rgba(0,0,0,0.35), inset 0 -1px 1px rgba(255,255,255,0.10)'
      : '0 4px 7px rgba(0,0,0,0.7), inset 0 1px 1px rgba(255,255,255,0.22), inset 0 -1px 2px rgba(0,0,0,0.45)',
    transition: pressed ? 'none' : 'transform 0.06s, box-shadow 0.06s, background 0.06s',
  }
}

/**
 * Eindeutig KONKAVE Mulde: Schatten oben, Licht sammelt sich unten.
 * pressed: Mulde wird tiefer + dunkler.
 */
export function buildDomeStyle(bgColor: string | undefined, pressed: boolean): CSSProperties {
  const base = pressed ? dim(parseHex(bgColor, [168, 170, 178]), 0.18) : parseHex(bgColor, [168, 170, 178])
  const stops = pressed
    ? [dim(base, 0.6), dim(base, 0.3), base, mix(base, 0.17), mix(base, 0.3)]
    : [dim(base, 0.55), dim(base, 0.28), base, mix(base, 0.3), mix(base, 0.5)]
  const pool = pressed ? 0.12 : 0.28
  return {
    position: 'absolute',
    inset: '8%',
    borderRadius: '50%',
    pointerEvents: 'none',
    background:
      `radial-gradient(circle at 50% 118%, rgba(255,255,255,${pool}) 0%, rgba(255,255,255,0) ${pressed ? 40 : 42}%), ` +
      `linear-gradient(180deg, ${rgb(stops[0])} 0%, ${rgb(stops[1])} ${pressed ? 26 : 24}%, ${rgb(stops[2])} ${pressed ? 60 : 58}%, ${rgb(stops[3])} ${pressed ? 86 : 84}%, ${rgb(stops[4])} 100%)`,
    boxShadow: pressed
      ? 'inset 0 7px 12px rgba(0,0,0,0.60), inset 0 -2px 3px rgba(255,255,255,0.25), 0 1px 1px rgba(255,255,255,0.18), 0 0 0 1px rgba(0,0,0,0.30)'
      : 'inset 0 5px 9px rgba(0,0,0,0.50), inset 0 -2px 3px rgba(255,255,255,0.40), 0 1px 1px rgba(255,255,255,0.30), 0 0 0 1px rgba(0,0,0,0.25)',
    transition: pressed ? 'none' : 'background 0.06s, box-shadow 0.06s',
  }
}

// ─── Broadcast-LED-Style (2b, Spec: BroadcastLED-Style.md) ────────────────────
// Panel-weiter Overlay-Style: die Companion-Buttonfarbe (bgColor) wird zur
// LED-SIGNALFARBE — sie füllt nicht mehr die Fläche, sondern durchleuchtet die
// dunkle Kappe von innen und färbt den Schrift-Glow. Die Companion-Textfarbe
// bleibt Legenden-Farbe. Dunkle Default-Farben (Companion-Schwarz) → LED aus.
// Zustände (Spec 3.1–3.4): idle glimmt · pressed blüht auf · lit voll durchleuchtet.
// forceBlackCap (Spec 6): Kappe bleibt IMMER Referenz-Schwarz #1d1f23 — die
// Companion-Farbe wirkt nur noch als LED (Radial-/Außen-/Text-Glow), auch aktiv.

/** Neutrale LED-Fallback-Farbe wenn (noch) kein Companion-State da ist. */
const LED_FALLBACK: RGB = [148, 163, 184]

/** Kragen (fest, neutral dunkelgrau — bewegt sich nie mit). */
export const LED_COLLAR_STYLE: CSSProperties = {
  padding: 5,
  background: 'linear-gradient(180deg, #383b41 0%, #24272c 55%, #1a1c20 100%)',
  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.18), 0 3px 7px rgba(0,0,0,0.6)',
}

/**
 * Kappe mit LED-Durchleuchtung (Spec 3.1–3.4).
 * `lit` = Companion-Feedback aktiv (siehe isLit) · `forceBlackCap` = Spec Abschnitt 6.
 * Layer-Reihenfolge (alle Zustände): Noise, Gloss-Verlauf, LED-Radial, Grundfarbe.
 */
export function buildLedCapStyle(
  bgColor: string | undefined,
  pressed: boolean,
  lit: boolean,
  forceBlackCap: boolean,
): CSSProperties {
  const c = parseHex(bgColor, LED_FALLBACK)
  const led = `${c[0]},${c[1]},${c[2]}`
  // POC-Sättigung: der innere Radial-Stop nutzt bei lit die AUFGEHELLTE LED-Farbe
  // (mix 0.3 — Agent-Beispiel: Grün 60,220,110 → 70,255,130), unlit den Kern.
  const hell = mix(c, 0.3)
  const innerColor = lit ? `${hell[0]},${hell[1]},${hell[2]}` : led

  // Radial-Intensitäten [innen, mitte] je Zustand.
  // forceBlackCap: Grundfarbe bleibt schwarz, der Aktiv-Bloom ist gedämpft aber
  // klar sichtbar; beim Drücken blüht die LED voll auf (taktiles Feedback).
  const inner = pressed
    ? (lit ? [0.95, 0.6] : [0.65, 0.28])
    : lit
      ? (forceBlackCap ? [0.6, 0.35] : [0.85, 0.55])
      : [0.3, 0.1]

  // Radial-Geometrie: idle bei 62% (Spec 3.1), pressed/lit bei 58% (3.2/3.3)
  const radialY = !pressed && !lit ? 62 : 58
  const midStop = pressed ? 55 : lit ? 52 : 50
  const endStop = pressed ? 'rgba(0,0,0,0) 82%' : lit && !forceBlackCap ? 'rgba(0,0,0,0.15) 100%' : 'rgba(0,0,0,0) 78%'

  // Grundfarbe: forceBlackCap → immer Referenz-Schwarz; lit → satt getönt
  // (led×0.35 — POC-Beispiel #10281a ist deutlich heller als die Spec-Prosa
  // ×0.16/0.10/0.10, die zu matt wirkte); pressed unlit → Spec 3.2-Tönung.
  const baseTint = forceBlackCap
    ? '#1d1f23'
    : lit
      ? rgb(dim(c, 0.65))
      : pressed
        ? `rgb(${Math.round(c[0] * 0.13)},${Math.round(c[1] * 0.08)},${Math.round(c[2] * 0.09)})`
        : '#1d1f23'

  // Gloss-Verlauf: idle 0.10/0.02/0.18 · lit 0.10/0.02/0.14 · pressed 0.06/0/0.22
  const gloss = pressed
    ? 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 30%, rgba(0,0,0,0.22) 100%)'
    : `linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 30%, rgba(0,0,0,${lit ? 0.14 : 0.18}) 100%)`

  return {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transform: pressed ? 'translateY(2px)' : 'translateY(-1.5px)',
    background:
      `${NOISE_URL}, ` +
      `${gloss}, ` +
      `radial-gradient(circle at 50% ${radialY}%, rgba(${innerColor},${inner[0]}) 0%, rgba(${led},${inner[1]}) ${midStop}%, ${endStop}), ` +
      baseTint,
    boxShadow: pressed
      ? `0 1px 2px rgba(0,0,0,0.7), 0 0 ${lit ? 28 : 18}px rgba(${led},${lit ? 0.7 : 0.35}), inset 0 2px 3px rgba(0,0,0,0.45)`
      : lit
        ? `0 3px 6px rgba(0,0,0,0.6), 0 0 ${forceBlackCap ? 20 : 22}px rgba(${led},${forceBlackCap ? 0.5 : 0.55}), inset 0 1px 1px rgba(255,255,255,0.16), inset 0 -1px 2px rgba(0,0,0,0.4)`
        : `0 4px 7px rgba(0,0,0,0.7), inset 0 1px 1px rgba(255,255,255,0.16), inset 0 -1px 2px rgba(0,0,0,0.5)`,
    transition: pressed ? 'none' : 'transform 0.06s, box-shadow 0.06s, background 0.06s',
  }
}

/**
 * Aktiv-Leuchten für DOME-Buttons im Broadcast-LED-Modus: Overlay über der
 * konkaven Mulde. `mixBlendMode: screen` hellt die Mulde auf wie echtes Licht —
 * funktioniert auch auf schwarzen Domes (forceBlackCap). Ohne dieses Overlay
 * wäre der Aktiv-Zustand auf Domes fast unsichtbar (nur Text-Glow).
 */
export function buildDomeLedGlow(bgColor: string | undefined, pressed: boolean): CSSProperties {
  const c = parseHex(bgColor, LED_FALLBACK)
  const led = `${c[0]},${c[1]},${c[2]}`
  const hell = mix(c, 0.3)
  const a = pressed ? [0.9, 0.5] : [0.7, 0.4]
  return {
    position: 'absolute',
    inset: '8%',
    borderRadius: '50%',
    pointerEvents: 'none',
    mixBlendMode: 'screen',
    background: `radial-gradient(circle at 50% 58%, rgba(${hell[0]},${hell[1]},${hell[2]},${a[0]}) 0%, rgba(${led},${a[1]}) 55%, rgba(0,0,0,0) 85%)`,
    transition: pressed ? 'none' : 'background 0.06s',
  }
}

/** Außen-Glow (Rand-Schein) in der LED-Farbe — für den Dome-Rand bei lit. */
export function ledGlowShadow(bgColor: string | undefined, pressed: boolean): string {
  const c = parseHex(bgColor, LED_FALLBACK)
  return `0 0 ${pressed ? 28 : 20}px rgba(${c[0]},${c[1]},${c[2]},${pressed ? 0.65 : 0.5})`
}

/**
 * Legenden-Glow in der LEGENDEN-Farbe (Companion-textColor) — eine durchleuchtete
 * Legende glüht in ihrer eigenen Farbe. So glüht ein roter „CUT"-Schriftzug auch
 * auf dunkler Companion-bgColor, und weiße Schrift auf einem aktiven (lit)
 * Button bekommt ihren leichten eigenen weißen Glow (Referenz: „CUT AKTIV").
 * `strong` = lit oder pressed. Schwarze Legendenfarbe → Glow faktisch aus.
 * (Abweichung von Spec Abschnitt 4 „Glow in Signalfarbe" — per Design-Review
 * auf die Legendenfarbe festgelegt, weil reale Companion-Buttons die Signal-
 * Info oft in der Textfarbe tragen.)
 *
 * Die Glow-Radien skalieren mit `fontSize`: Die Spec-Werte (idle 8/18, strong
 * 10/26 px) sind für die große Mock-Schrift (~24 px) ausgelegt — bei kleiner
 * Panel-Schrift (11 px) würde ein 18-px-Glow die Legende als Farbfläche
 * ertränken. WICHTIG (Aufrufer): der Text-Span darf kein `overflow: hidden`
 * haben, sonst clippt CSS den text-shadow hart an der Span-Box → sichtbares
 * farbiges Rechteck statt weichem Glow.
 */
export function buildLedTextShadow(legendColor: string | undefined, strong: boolean, fontSize: number): string {
  const c = parseHex(legendColor, LED_FALLBACK)
  const led = `${c[0]},${c[1]},${c[2]}`
  // Referenz: fs 24 → idle 8/19, strong 11/26 (≈ Spec 8/18 bzw. 10/26)
  const r1 = Math.max(3, Math.round(fontSize * (strong ? 0.45 : 0.35)))
  const r2 = Math.max(6, Math.round(fontSize * (strong ? 1.1 : 0.8)))
  return strong
    ? `0 0 ${r1}px rgba(${led},0.95), 0 0 ${r2}px rgba(${led},0.55)`
    : `0 0 ${r1}px rgba(${led},0.8), 0 0 ${r2}px rgba(${led},0.4)`
}

/**
 * Komplette Legenden-Darstellung im Broadcast-LED-Modus (Design-Agent-Referenz):
 *
 *   lit   — die Legende wirkt DURCHLEUCHTET: Textfarbe wird auf ein fast-weißes
 *           Tint der LED-Farbe gehoben (#eafff1 grün / #fff0f0 rot), der Glow ist
 *           zweischichtig in der LED-Farbe — innen aufgehellt (α 0.9), außen
 *           Kern-LED (α 0.5); Radien ≈ 0.65×/1.5× fontSize (12 px → 8/18 px).
 *   unlit — Companion-Textfarbe bleibt (kein Override), Glow in der
 *           Legendenfarbe via buildLedTextShadow (strong nur bei pressed).
 *
 * `color === undefined` heißt: Companion-Textfarbe unverändert verwenden.
 */
export function buildLedLegend(
  bgColor: string | undefined,
  textColor: string | undefined,
  pressed: boolean,
  lit: boolean,
  fontSize: number,
): { color?: string; textShadow: string } {
  if (!lit) {
    return { textShadow: buildLedTextShadow(textColor, pressed, fontSize) }
  }
  const c = parseHex(bgColor, LED_FALLBACK)
  const inner = mix(c, 0.35) // aufgehellte LED-Farbe für den inneren Halo
  const r1 = Math.max(4, Math.round(fontSize * 0.65))
  const r2 = Math.max(8, Math.round(fontSize * 1.5))
  const [a1, a2] = pressed ? [0.95, 0.6] : [0.9, 0.5]
  return {
    color: rgb(mix(c, 0.88)), // fast-weißes LED-Tint — „durchleuchtet statt gedruckt"
    textShadow: `0 0 ${r1}px rgba(${inner[0]},${inner[1]},${inner[2]},${a1}), 0 0 ${r2}px rgba(${c[0]},${c[1]},${c[2]},${a2})`,
  }
}

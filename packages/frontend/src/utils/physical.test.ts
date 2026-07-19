import { describe, it, expect } from 'vitest'
import {
  parseHex,
  mix,
  dim,
  rgb,
  isLit,
  buildDomeRecessStyle,
  buildDomeCapStyle,
  buildDomeStyle,
  LED_COLLAR_STYLE,
  buildLedCapStyle,
  buildLedTextShadow,
  buildLedLegend,
  buildDomeLedGlow,
  ledGlowShadow,
} from './physical'

// ─── Reine Farb-Primitive ─────────────────────────────────────────────────────

describe('parseHex', () => {
  it('parses #rrggbb into an [r,g,b] tuple', () => {
    expect(parseHex('#ff8000', [0, 0, 0])).toEqual([255, 128, 0])
  })
  it('falls back for undefined', () => {
    expect(parseHex(undefined, [1, 2, 3])).toEqual([1, 2, 3])
  })
  it('falls back for 3-char shorthand hex', () => {
    expect(parseHex('#f00', [9, 9, 9])).toEqual([9, 9, 9])
  })
  it('falls back for non-hex strings', () => {
    expect(parseHex('red', [9, 9, 9])).toEqual([9, 9, 9])
  })
})

describe('mix (toward white)', () => {
  it('returns white for f=1', () => {
    expect(mix([0, 0, 0], 1)).toEqual([255, 255, 255])
  })
  it('returns unchanged for f=0', () => {
    expect(mix([100, 100, 100], 0)).toEqual([100, 100, 100])
  })
  it('blends midway from black', () => {
    expect(mix([0, 0, 0], 0.5)).toEqual([128, 128, 128])
  })
})

describe('dim (toward black, by fraction)', () => {
  it('returns unchanged for f=0', () => {
    expect(dim([255, 255, 255], 0)).toEqual([255, 255, 255])
  })
  it('returns black for f=1', () => {
    expect(dim([100, 100, 100], 1)).toEqual([0, 0, 0])
  })
  it('reduces by fraction: dim(200,0.5)=100', () => {
    expect(dim([200, 200, 200], 0.5)).toEqual([100, 100, 100])
  })
  it('dim(100,0.17) ≈ 83 (×0.83)', () => {
    expect(dim([100, 100, 100], 0.17)).toEqual([83, 83, 83])
  })
})

describe('rgb', () => {
  it('formats a tuple as a css rgb() string', () => {
    expect(rgb([1, 2, 3])).toBe('rgb(1,2,3)')
  })
})

describe('isLit (luminance heuristic > 0.18)', () => {
  it('white is lit', () => {
    expect(isLit('#ffffff')).toBe(true)
  })
  it('black is not lit', () => {
    expect(isLit('#000000')).toBe(false)
  })
  it('undefined defaults to not lit', () => {
    expect(isLit(undefined)).toBe(false)
  })
  it('saturated red (lum 0.2126) is lit', () => {
    expect(isLit('#ff0000')).toBe(true)
  })
  it('dark grey (#202020, lum 0.125) is not lit', () => {
    expect(isLit('#202020')).toBe(false)
  })
})

// ─── Dome-Variante ────────────────────────────────────────────────────────────

describe('buildDomeRecessStyle', () => {
  it('pads the recess and uses the dimmed bg color as background', () => {
    const s = buildDomeRecessStyle('#646464') // 100,100,100 → dim 0.17 → 83
    expect(s.padding).toBe(5)
    expect(s.background).toBe('rgb(83,83,83)')
  })
  it('has an inset shadow to sink the cap', () => {
    const s = buildDomeRecessStyle('#646464')
    expect(String(s.boxShadow)).toContain('inset')
  })
})

describe('buildDomeCapStyle', () => {
  it('lifts the cap when not pressed', () => {
    expect(buildDomeCapStyle('#646464', false).transform).toBe('translateY(-1.5px)')
  })
  it('sinks the cap when pressed', () => {
    expect(buildDomeCapStyle('#646464', true).transform).toBe('translateY(2px)')
  })
  it('layers the injection-mould noise into the background', () => {
    expect(String(buildDomeCapStyle('#646464', false).background)).toContain('data:image/svg+xml')
  })
  it('disables transition while pressed', () => {
    expect(buildDomeCapStyle('#646464', true).transition).toBe('none')
  })
})

describe('buildDomeStyle', () => {
  it('is an absolute circular concave overlay', () => {
    const s = buildDomeStyle('#646464', false)
    expect(s.position).toBe('absolute')
    expect(s.borderRadius).toBe('50%')
  })
  it('combines a radial light pool with a linear body gradient', () => {
    const bg = String(buildDomeStyle('#646464', false).background)
    expect(bg).toContain('radial-gradient')
    expect(bg).toContain('linear-gradient')
  })
  it('deepens the shadow when pressed (differs from idle)', () => {
    const idle = String(buildDomeStyle('#646464', false).boxShadow)
    const down = String(buildDomeStyle('#646464', true).boxShadow)
    expect(down).not.toBe(idle)
  })
})

// ─── LED-Variante ─────────────────────────────────────────────────────────────

describe('LED_COLLAR_STYLE', () => {
  it('is a fixed neutral metal collar', () => {
    expect(LED_COLLAR_STYLE.padding).toBe(5)
    expect(String(LED_COLLAR_STYLE.background)).toContain('linear-gradient')
  })
})

// Broadcast-LED-Spec (BroadcastLED-Style.md): bgColor = LED-Signalfarbe.
// Zustände 3.1–3.4 + forceBlackCap (Abschnitt 6).
describe('buildLedCapStyle (Broadcast-LED)', () => {
  const RED = '#d32027' // lit (Luminanz > 0.18)

  it('3.1 idle: weak glimmer of the bgColor at 62%, dark base #1d1f23, no outer glow', () => {
    const s = buildLedCapStyle('#3c1013', false, false, false) // dark red, unlit
    const bg = String(s.background)
    expect(bg).toContain('rgba(60,16,19,0.3)')  // LED radial = bgColor triple, idle alpha 0.30
    expect(bg).toContain('62%')                  // idle radial position
    expect(bg).toContain('#1d1f23')              // base cap
    expect(String(s.boxShadow)).not.toContain('0 0 18px')
    expect(s.transform).toBe('translateY(-1.5px)')
  })

  it('3.1 idle: black companion button = LED off (Cam1 buttons in the reference)', () => {
    const bg = String(buildLedCapStyle('#000000', false, false, false).background)
    expect(bg).toContain('rgba(0,0,0,0.3)') // black LED radial = invisible → plain dark cap
  })

  it('3.2 pressed: cap sinks, LED blooms, base tinted toward the LED color, outer glow', () => {
    const s = buildLedCapStyle(RED, true, false, false)
    expect(s.transform).toBe('translateY(2px)')
    const bg = String(s.background)
    expect(bg).toContain('rgba(211,32,39,0.65)')                 // pressed radial inner alpha
    expect(bg).toContain(`rgb(${Math.round(211 * 0.13)},${Math.round(32 * 0.08)},${Math.round(39 * 0.09)})`) // tinted base r*0.13/g*0.08/b*0.09
    expect(String(s.boxShadow)).toContain('rgba(211,32,39,0.35)') // outer glow 18px
    expect(s.transition).toBe('none')
  })

  // POC-Sättigung (Design-Referenz „CUT AKTIV"/„PV Backup"): innerer Radial-Stop
  // in AUFGEHELLTER LED-Farbe (mix 0.3), Grundtönung deutlich heller (led×0.35 —
  // POC-Beispiel #10281a), kräftigerer Außen-Glow. mix([211,32,39],0.3) = (224,99,104).
  it('3.3 lit: fully illuminated — lightened inner stop 0.85, base led×0.35, outer glow 22px', () => {
    const s = buildLedCapStyle(RED, false, true, false)
    const bg = String(s.background)
    expect(bg).toContain('rgba(224,99,104,0.85)')                 // lightened inner stop
    expect(bg).toContain('rgba(211,32,39,0.55)')                  // core mid stop
    expect(bg).toContain('rgb(74,11,14)')                         // base = led×0.35 (POC saturation)
    expect(String(s.boxShadow)).toContain('0 0 22px rgba(211,32,39,0.55)')
  })

  it('3.4 lit + pressed: inner blooms to 0.95, outer glow 28px 0.7', () => {
    const s = buildLedCapStyle(RED, true, true, false)
    expect(String(s.background)).toContain('rgba(224,99,104,0.95)')
    expect(String(s.boxShadow)).toContain('0 0 28px rgba(211,32,39,0.7)')
  })

  it('forceBlackCap: base stays #1d1f23 even when lit, bloom clearly visible (lightened 0.6)', () => {
    const s = buildLedCapStyle(RED, false, true, true)
    const bg = String(s.background)
    expect(bg).toContain('#1d1f23')                               // never tinted
    expect(bg).toContain('rgba(224,99,104,0.6)')                  // active bloom clearly visible…
    expect(bg).not.toContain('rgba(224,99,104,0.85)')             // …but below full illumination
    expect(String(s.boxShadow)).toContain('0 0 20px rgba(211,32,39,0.5)') // color still acts as LED
  })

  it('forceBlackCap: pressed still blooms (tactile feedback) but base stays black', () => {
    const s = buildLedCapStyle(RED, true, true, true)
    const bg = String(s.background)
    expect(bg).toContain('rgba(224,99,104,0.95)') // bloom like 3.4
    expect(bg).toContain('#1d1f23')               // base still black
  })

  it('missing bgColor falls back to a neutral slate tone (no red default)', () => {
    const bg = String(buildLedCapStyle(undefined, false, false, false).background)
    expect(bg).toContain('148,163,184')
  })
})

describe('buildLedTextShadow (Broadcast-LED)', () => {
  // Der Legenden-Glow folgt der LEGENDEN-Farbe (Companion-textColor) — eine
  // durchleuchtete Legende glüht in ihrer eigenen Farbe. So glüht „CUT" rot auch
  // wenn die Companion-bgColor dunkel ist, und weißer Text auf einem aktiven
  // Button bekommt seinen leichten eigenen (weißen) Glow.
  // Die Glow-Radien skalieren mit der Schriftgröße — die Spec-Werte (8/18 bzw.
  // 10/26 px) gelten für die große Mock-Schrift (~24 px); bei 11-px-Panel-Schrift
  // würde ein 18-px-Glow die Legende als Farbfläche ertränken.
  it('legend glows in the legend/text color (red CUT on dark button)', () => {
    expect(buildLedTextShadow('#ff4545', false, 24)).toContain('255,69,69')
  })
  it('white legend on a lit button gets its own light white glow', () => {
    expect(buildLedTextShadow('#ffffff', true, 24)).toContain('255,255,255')
  })
  it('at mock font size (24px) the radii match the spec values', () => {
    expect(buildLedTextShadow('#ff4545', false, 24)).toContain('0 0 8px')
    expect(buildLedTextShadow('#ff4545', true, 24)).toContain('0 0 11px')
  })
  it('small panel font (11px) gets proportionally smaller radii', () => {
    const idle = buildLedTextShadow('#ff4545', false, 11)
    expect(idle).toContain('0 0 4px')  // round(11*0.35)
    expect(idle).toContain('0 0 9px')  // round(11*0.8)
    expect(idle).not.toContain('18px')
  })
  it('strong glow when lit or pressed', () => {
    const idle = buildLedTextShadow('#ff4545', false, 24)
    const strong = buildLedTextShadow('#ff4545', true, 24)
    expect(strong).not.toBe(idle)
  })
  it('black legend color → glow is effectively off', () => {
    expect(buildLedTextShadow('#000000', false, 24)).toContain('rgba(0,0,0,')
  })
})

describe('buildDomeLedGlow / ledGlowShadow (Dome-Aktiv-Leuchten im LED-Modus)', () => {
  // Dome-Buttons haben keine LED-Kappe — bei aktivem Feedback bekommen sie ein
  // Leucht-Overlay über der Mulde (screen-blend hellt auf wie echtes Licht) plus
  // einen Außen-Glow am Rand. Sonst ist „aktiv" auf Domes fast unsichtbar.
  it('overlay sits on the dome circle and lightens it via screen blend', () => {
    const s = buildDomeLedGlow('#d32027', false)
    expect(s.position).toBe('absolute')
    expect(s.borderRadius).toBe('50%')
    expect(s.mixBlendMode).toBe('screen')
    expect(String(s.background)).toContain('224,99,104') // lightened LED color
  })
  it('pressed intensifies the overlay', () => {
    const idle = String(buildDomeLedGlow('#d32027', false).background)
    const down = String(buildDomeLedGlow('#d32027', true).background)
    expect(down).not.toBe(idle)
  })
  it('ledGlowShadow produces the outer glow for the recess', () => {
    expect(ledGlowShadow('#d32027', false)).toBe('0 0 20px rgba(211,32,39,0.5)')
    expect(ledGlowShadow('#d32027', true)).toBe('0 0 28px rgba(211,32,39,0.65)')
  })
})

describe('buildLedLegend (Broadcast-LED, komplette Legende)', () => {
  // Design-Agent-Referenz: Bei AKTIVEN Buttons wird die Textfarbe auf ein
  // fast-weißes Tint der LED-Farbe gehoben (#eafff1 grün / #fff0f0 rot) und der
  // Glow ist zweischichtig in der LED-Farbe (innen aufgehellt 0.9, außen Kern 0.5,
  // Radien ≈ 0.65×/1.5× fontSize → 12px: 8/18px). Idle-Buttons behalten ihre
  // Companion-Textfarbe und glühen in der Legendenfarbe.
  const GREEN = '#1d8a3e' // 29,138,62 — lit

  it('lit: legend color is lifted to a near-white tint of the LED color', () => {
    const l = buildLedLegend(GREEN, '#ffffff', false, true, 12)
    // mix([29,138,62], 0.88) = rgb(228,241,232)
    expect(l.color).toBe('rgb(228,241,232)')
  })
  it('lit: two-layer glow in the LED color — inner lightened 0.9, outer core 0.5', () => {
    const l = buildLedLegend(GREEN, '#ffffff', false, true, 12)
    // mix([29,138,62], 0.35) = rgb(108,179,130)
    expect(l.textShadow).toContain('0 0 8px rgba(108,179,130,0.9)')
    expect(l.textShadow).toContain('0 0 18px rgba(29,138,62,0.5)')
  })
  it('unlit: keeps the companion text color (no override) and glows in the legend color', () => {
    const l = buildLedLegend('#141414', '#ff4040', false, false, 11)
    expect(l.color).toBeUndefined()
    expect(l.textShadow).toContain('255,64,64')
  })
  it('pressed while lit intensifies the glow alphas', () => {
    const idle = buildLedLegend(GREEN, '#ffffff', false, true, 12)
    const down = buildLedLegend(GREEN, '#ffffff', true, true, 12)
    expect(down.textShadow).not.toBe(idle.textShadow)
  })
})

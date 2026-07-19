# Physische Buttons — Umsetzung (Variante 2a „Dome" + 2b „LED")

Freigegebenes Design: `Physische Buttons.dc.html`, Abschnitt 2a/2b.
Betroffene Dateien: `packages/frontend/src/components/Elements/CompanionButtonElement.tsx`, `packages/frontend/src/utils/textures.ts`, `packages/frontend/src/components/Elements/ShapeElement.tsx`, `packages/shared` (Render-Typ).

---

## 1. Shared-Typ erweitern

```ts
// im Render-Settings-Typ des CompanionButton:
physicalStyle?: boolean            // bleibt (Abwärtskompatibilität)
physicalVariant?: 'dome' | 'led'   // NEU — default 'dome' wenn physicalStyle true
```

---

## 2. CompanionButtonElement.tsx

### 2.1 Gemeinsame Helfer (ersetzen/ergänzen die bestehenden `buildDome…`/`buildFrame…`)

```tsx
/** Feine Spritzguss-Körnung als wiederverwendbare Noise-Layer (SVG data URI). */
const NOISE_URL = `url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27140%27 height=%27140%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3CfeColorMatrix type=%27saturate%27 values=%270%27/%3E%3C/filter%3E%3Crect width=%27140%27 height=%27140%27 filter=%27url(%23n)%27 opacity=%270.06%27/%3E%3C/svg%3E')`

function parseHex(hex: string | undefined, fallback: [number, number, number]): [number, number, number] {
  if (hex && /^#[0-9a-fA-F]{6}$/.test(hex)) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
  }
  return fallback
}
const mix = (c: [number, number, number], f: number) => c.map((ch) => Math.round(ch + (255 - ch) * f)) as [number, number, number]
const dim = (c: [number, number, number], f: number) => c.map((ch) => Math.round(ch * (1 - f))) as [number, number, number]
const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`
```

### 2.2 Variante `dome` (2a) — 3 Schichten: Rand (Vertiefung) → Kappe → konkave Mulde

**Rand = Buttonfarbe, Vertiefung nur durch Innenschatten:**

```tsx
/** Äußerer Container (ersetzt das bisherige physicalStyle-containerStyle).
 *  Rand hat dieselbe Farbe wie die Kappe — die Vertiefung entsteht rein aus Schatten. */
export function buildDomeRecessStyle(bgColor: string | undefined): React.CSSProperties {
  const cap = dim(parseHex(bgColor, [168, 170, 178]), 0.17)   // Kappen-/Randfarbe = bgColor × 0.83
  return {
    padding: 5,
    background: rgb(cap),
    boxShadow:
      'inset 0 3px 7px rgba(0,0,0,0.50), inset 2px 0 4px rgba(0,0,0,0.20), ' +
      'inset -2px 0 4px rgba(0,0,0,0.20), inset 0 -1px 2px rgba(255,255,255,0.20), ' +
      '0 2px 5px rgba(0,0,0,0.35)',
  }
}

/** Matte Kappe in der Vertiefung. pressed: 3.5px Hub nach unten, Licht dimmt. */
export function buildDomeCapStyle(bgColor: string | undefined, pressed: boolean): React.CSSProperties {
  const base = parseHex(bgColor, [168, 170, 178])
  const cap = dim(base, pressed ? 0.28 : 0.17)
  const gloss = pressed
    ? 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 30%, rgba(0,0,0,0.22) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 30%, rgba(0,0,0,0.18) 100%)'
  return {
    width: '100%', height: '100%', borderRadius: 7,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transform: pressed ? 'translateY(2px)' : 'translateY(-1.5px)',
    background: `${NOISE_URL}, ${gloss}, ${rgb(cap)}`,
    boxShadow: pressed
      ? '0 1px 2px rgba(0,0,0,0.7), inset 0 2px 3px rgba(0,0,0,0.35), inset 0 -1px 1px rgba(255,255,255,0.10)'
      : '0 4px 7px rgba(0,0,0,0.7), inset 0 1px 1px rgba(255,255,255,0.22), inset 0 -1px 2px rgba(0,0,0,0.45)',
    transition: pressed ? 'none' : 'transform 0.06s, box-shadow 0.06s, background 0.06s',
  }
}

/** Eindeutig KONKAVE Mulde: Schatten oben, Licht sammelt sich unten.
 *  pressed: Mulde wird tiefer + dunkler. */
export function buildDomeStyle(bgColor: string | undefined, pressed: boolean): React.CSSProperties {
  const base = pressed ? dim(parseHex(bgColor, [168, 170, 178]), 0.18) : parseHex(bgColor, [168, 170, 178])
  const stops = pressed
    ? [dim(base, 0.60), dim(base, 0.30), base, mix(base, 0.17), mix(base, 0.30)]
    : [dim(base, 0.55), dim(base, 0.28), base, mix(base, 0.30), mix(base, 0.50)]
  const pool = pressed ? 0.12 : 0.28
  return {
    position: 'absolute', inset: '8%', borderRadius: '50%', pointerEvents: 'none',
    background:
      `radial-gradient(circle at 50% 118%, rgba(255,255,255,${pool}) 0%, rgba(255,255,255,0) ${pressed ? 40 : 42}%), ` +
      `linear-gradient(180deg, ${rgb(stops[0])} 0%, ${rgb(stops[1])} ${pressed ? 26 : 24}%, ${rgb(stops[2])} ${pressed ? 60 : 58}%, ${rgb(stops[3])} ${pressed ? 86 : 84}%, ${rgb(stops[4])} 100%)`,
    boxShadow: pressed
      ? 'inset 0 7px 12px rgba(0,0,0,0.60), inset 0 -2px 3px rgba(255,255,255,0.25), 0 1px 1px rgba(255,255,255,0.18), 0 0 0 1px rgba(0,0,0,0.30)'
      : 'inset 0 5px 9px rgba(0,0,0,0.50), inset 0 -2px 3px rgba(255,255,255,0.40), 0 1px 1px rgba(255,255,255,0.30), 0 0 0 1px rgba(0,0,0,0.25)',
    transition: pressed ? 'none' : 'background 0.06s, box-shadow 0.06s',
  }
}
```

**JSX-Struktur (dome):**

```tsx
<div style={{ ...positionBase, borderRadius: borderRadius + 5, boxSizing: 'border-box', overflow: 'visible', ...buildDomeRecessStyle(bgColor) }} onPointerDown={…}>
  <div style={buildDomeCapStyle(bgColor, pressed)}>
    <div aria-hidden="true" style={buildDomeStyle(bgColor, pressed)} />
    {/* Text-Span wie bisher, aber position:relative statt absolute,
        damit er mit der Kappe mitfährt */}
  </div>
</div>
```

### 2.3 Variante `led` (2b) — Metallkragen + dunkle Kappe, Companion-Farbe = LED-Farbe

```tsx
/** Kragen (fest, neutral — bewegt sich nicht mit). */
export const LED_COLLAR_STYLE: React.CSSProperties = {
  padding: 5,
  background: 'linear-gradient(180deg, #383b41 0%, #24272c 55%, #1a1c20 100%)',
  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.18), 0 3px 7px rgba(0,0,0,0.6)',
}

/** Kappe mit LED-Durchleuchtung. `lit` = Button aktiv (siehe Heuristik unten). */
export function buildLedCapStyle(bgColor: string | undefined, pressed: boolean, lit: boolean): React.CSSProperties {
  const c = parseHex(bgColor, [255, 60, 66])
  const led = `${c[0]},${c[1]},${c[2]}`
  // Idle: schwaches Glimmen · lit: voll durchleuchtet · pressed: Bloom
  const inner = lit
    ? (pressed ? [0.90, 0.55] : [0.75, 0.45])
    : (pressed ? [0.65, 0.28] : [0.30, 0.10])
  const baseTint = lit ? `rgb(${Math.round(c[0]*0.16)},${Math.round(c[1]*0.10)},${Math.round(c[2]*0.10)})` : '#1d1f23'
  return {
    width: '100%', height: '100%', borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transform: pressed ? 'translateY(2px)' : 'translateY(-1.5px)',
    background:
      `${NOISE_URL}, ` +
      `linear-gradient(180deg, rgba(255,255,255,${pressed ? 0.06 : 0.10}) 0%, rgba(255,255,255,${pressed ? 0 : 0.02}) 30%, rgba(0,0,0,${pressed ? 0.22 : 0.18}) 100%), ` +
      `radial-gradient(circle at 50% ${pressed ? 55 : 58}%, rgba(${led},${inner[0]}) 0%, rgba(${led},${inner[1]}) ${pressed ? 55 : 52}%, rgba(0,0,0,0) 80%), ` +
      baseTint,
    boxShadow: pressed
      ? `0 1px 2px rgba(0,0,0,0.7), 0 0 ${lit ? 26 : 18}px rgba(${led},${lit ? 0.65 : 0.35}), inset 0 2px 3px rgba(0,0,0,0.45)`
      : `0 4px 7px rgba(0,0,0,0.7), ${lit ? `0 0 18px rgba(${led},0.45), ` : ''}inset 0 1px 1px rgba(255,255,255,0.16), inset 0 -1px 2px rgba(0,0,0,0.5)`,
    transition: pressed ? 'none' : 'transform 0.06s, box-shadow 0.06s, background 0.06s',
  }
}

/** Text bei LED-Variante: Legende glüht in der LED-Farbe. */
export function buildLedTextShadow(bgColor: string | undefined, lit: boolean): string {
  const c = parseHex(bgColor, [255, 60, 66])
  const led = `${c[0]},${c[1]},${c[2]}`
  return lit
    ? `0 0 10px rgba(${led},0.95), 0 0 26px rgba(${led},0.55)`
    : `0 0 8px rgba(${led},0.8), 0 0 18px rgba(${led},0.4)`
}
```

**Aktiv-Heuristik (`lit`):** Companion signalisiert „aktiv" über einen Farbwechsel des Buttons.
Praktikabel: `lit = relative Luminanz von bgColor > 0.18` (gesättigte/helle Feedback-Farben leuchten, dunkle/graue Defaults glimmen nur):

```tsx
function isLit(bgColor: string | undefined): boolean {
  const [r, g, b] = parseHex(bgColor, [0, 0, 0])
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.18
}
```

---

## 3. textures.ts — 3 neue Canvas-Texturen

```ts
{
  id: 'plastic',
  label: 'Plastik (Spritzguss)',
  css: [
    `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='0.07'/></svg>`,
    )}")`,
    `radial-gradient(130% 110% at 50% 0%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 55%, rgba(0,0,0,0.12) 100%)`,
  ].join(', '),
},
{
  id: 'abs',
  label: 'ABS glänzend',
  css: [
    `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='0.05'/></svg>`,
    )}")`,
    `linear-gradient(115deg, rgba(255,255,255,0) 32%, rgba(255,255,255,0.045) 44%, rgba(255,255,255,0) 52%)`,
    `radial-gradient(130% 110% at 50% 0%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 55%, rgba(0,0,0,0.10) 100%)`,
  ].join(', '),
},
{
  id: 'matt',
  label: 'Plastik matt genarbt',
  css: [
    `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='0.12'/></svg>`,
    )}")`,
    `repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 4px)`,
  ].join(', '),
},
```

---

## 4. ShapeElement.tsx — Plastik-Finish

Neues optionales Feld `style.finish?: 'flat' | 'plastic'` (default `'flat'` = heutiges Verhalten).
Bei `'plastic'` zusätzlich zur Füllfarbe:

```tsx
// background statt nur style.fill:
background: `${NOISE_URL}, linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.03) 24%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.16) 100%), ${style.fill}`,
// boxShadow:
boxShadow: '0 6px 14px rgba(0,0,0,0.5), 0 2px 3px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.32), inset 0 -2px 4px rgba(0,0,0,0.40), inset 1px 0 1px rgba(255,255,255,0.10)',
```

Das bisherige Bevel-Overlay-Div entfällt bei `finish: 'plastic'`.

---

## 5. Hinweise

- **Kein `scale` mehr beim Drücken** — der Hubweg (`translateY`) + kollabierender Schatten trägt die Physik. Die rote Pressed-Outline nur noch im Edit-Mode anzeigen, im View-Mode weglassen.
- `transition: 'none'` im Pressed-Zustand (sofortiges Feedback), `0.06s` beim Loslassen.
- Text-Span bei beiden Varianten als Kind der Kappe (`position: relative`), damit er den Hub mitmacht.
- PropertiesPanel: `physicalVariant`-Auswahl (Dome / LED) neben dem bestehenden „Physical button style"-Toggle.

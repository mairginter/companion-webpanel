# Physical Button Style — Design Spec

**Datum:** 2026-04-19
**Status:** Approved

---

## Überblick

Optionaler visueller Stil für `CompanionButtonElement` der einen physischen Taster mit leicht konkaver Wölbung simuliert. Aktivierbar per Toggle im PropertiesPanel. Bestehende Buttons ändern sich nicht (opt-in, Default: aus).

---

## Visuelles Ergebnis

Der Button besteht aus zwei Schichten:

1. **Outer Frame** — abgerundetes Rechteck mit silbrig-metallischem Linear-Gradient + Drop-Shadow
2. **Inner Dome** — kreisförmiger Bereich (50% border-radius) mit zwei gestapelten Radial-Gradients:
   - Spekularer Reflex (elliptisch, Fokuspunkt unten-mitte): weißer Glanzpunkt im unteren Drittel
   - Basis-Dom: helles Grau im Zentrum, abdunkelnd zu den Rändern — subtile inset box-shadows für minimale Tiefe

Companion-Hintergrundfarbe (`keyState.bgColor`) tönst den Dom (Farb-Tint als overlay). Companion-Textfarbe (`keyState.textColor`) wird unverändert übernommen. Pressed-State: `scale(0.97)`, tiefere inset-shadows, schwächerer drop-shadow.

### Exakte CSS-Werte (aus v5-Preview)

**Outer frame background:**
```css
linear-gradient(145deg, #c0c4ce 0%, #eceef6 30%, #e4e8f0 50%, #c4c8d4 75%, #a0a4b0 100%)
```

**Outer frame box-shadow:**
```css
0 6px 20px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.9), inset 0 -1px 3px rgba(0,0,0,0.2)
```

**Dome background (kein Companion-Farb-Tint):**
```css
radial-gradient(ellipse 80% 50% at 50% 70%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.4) 35%, transparent 70%),
radial-gradient(circle at 50% 50%, #f4f6fa 0%, #e0e4ec 25%, #c8ccd8 48%, #a8acb8 65%, #888c98 80%, #6c7080 92%, #545868 100%)
```

**Dome background (mit Companion-Farb-Tint, bgColor = `#rrggbb`):**
```css
radial-gradient(ellipse 80% 50% at 50% 70%, rgba(R,G,B,0.75) 0%, rgba(R,G,B,0.3) 35%, transparent 70%),
radial-gradient(circle at 50% 50%, <helle Version von bgColor> 0%, bgColor 48%, <dunkle Version> 100%)
```
Die helle/dunkle Version wird durch Beimischung von Weiß/Schwarz erzeugt (Hilfsfunktion `lightenColor` / `darkenColor`).

**Dome box-shadow:**
```css
inset 0 2px 8px rgba(0,0,0,0.18), inset 0 4px 16px rgba(0,0,0,0.10), inset 2px 2px 6px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.25)
```

**Dome border:** `border-radius: 50%`
**Dome padding (Abstand zum Frame):** `10px` rundum

**Pressed-State Outer frame:**
```css
background: linear-gradient(145deg, #a8acb8 0%, #d4d8e0 30%, #ccd0d8 50%, #b0b4c0 75%, #909098 100%)
box-shadow: 0 2px 6px rgba(0,0,0,0.7), inset 0 2px 5px rgba(0,0,0,0.35), inset 0 -1px 2px rgba(255,255,255,0.3)
```

**Pressed-State Dome:**
```css
transform: scale(0.97)
background: (wie oben aber Spiegelglanz schwächer: rgba(240,243,248,0.6) statt 0.9)
box-shadow: inset 0 3px 12px rgba(0,0,0,0.25), inset 0 5px 20px rgba(0,0,0,0.15), inset 2px 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.3)
```

---

## Datenmodell

**`packages/shared/src/types.ts`**

Im Interface `CompanionButtonRender` (oder inline render-Objekt):
```typescript
/** Simuliert einen physischen Taster mit konkaver Wölbung */
physicalStyle?: boolean
```

Kein Settings-Version-Bump nötig — `render` ist ein freies Objekt, neue optionale Felder sind abwärtskompatibel.

---

## Implementierung

### `CompanionButtonElement.tsx`

- Neue Variable: `const physicalStyle = render?.physicalStyle === true`
- Wenn `physicalStyle === true`:
  - Container: `background` = Outer-Frame-Gradient, `box-shadow` = Frame-Shadow (kein normaler bgColor-Background)
  - `overflow: hidden` bleibt
  - Bevel-Overlay-Div (`hasData && <div aria-hidden...>`) wird **nicht gerendert**
  - Neues Dome-Div mit `border-radius: 50%`, position absolute, inset `10px`, Dome-Gradients
  - Wenn `bgColor` vorhanden: Farb-Tint-Variante der Dome-Gradients (Hilfsfunktion `hexToRgb` aus vorhandenen Utils oder inline)
  - Pressed-State: Container + Dome bekommen alternative Werte
  - `showBitmap` + `showText` funktionieren weiterhin normal (Text über dem Dome)
- Wenn `physicalStyle === false` (Default): exakt bisheriges Verhalten, kein Code-Pfad verändert

### Hilfsfunktion `lightenHex(hex, amount)` / `darkenHex(hex, amount)`

Kleine inline-Funktion in `CompanionButtonElement.tsx` (keine separate Util-Datei nötig):
```typescript
function lightenHex(hex: string, amount: number): string {
  // hex = '#rrggbb', amount = 0..1
  // Returns rgba(r + (255-r)*amount, g + (255-g)*amount, b + (255-b)*amount, 1)
}
function darkenHex(hex: string, amount: number): string {
  // Returns rgba(r*(1-amount), g*(1-amount), b*(1-amount), 1)
}
```

### `CompanionButtonProps.tsx`

Neue Checkbox-Zeile nach `Border-Radius` NumericInput:
```tsx
<div style={row}>
  <span style={lbl}>Physical Style</span>
  <input type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }}
    checked={r.physicalStyle === true}
    onChange={(e) => updateRender({ physicalStyle: e.target.checked || undefined })}
  />
</div>
```
`false` wird als `undefined` gespeichert (kein unnötiger Eintrag in Settings wenn deaktiviert).

---

## Abgrenzung

- `showBitmap`, `showText`, `textAlign`, `fontSize`, `borderRadius` bleiben wirksam auch im Physical Style
- `showBgColor` wird im Physical Style ignoriert (Farbe kommt immer aus Companion bgColor als Tint)
- Stale/Error-Overlay (orange outline, ⚠) läuft unverändert über dem Physical Style
- Kein Bitmap-Rendering wenn Physical Style aktiv und showBitmap true: Bitmap wird über dem Dome angezeigt (normales `<img>` bleibt)

---

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shared/src/types.ts` | `physicalStyle?: boolean` in render-Typ |
| `packages/frontend/src/components/Elements/CompanionButtonElement.tsx` | Physical-Style-Rendering-Branch + Hilfsfunktionen |
| `packages/frontend/src/components/PropertiesPanel/CompanionButtonProps.tsx` | Checkbox "Physical Style" |

---

## Out of Scope

- Andere Button-Styles (neon, flat, etc.)
- Physical Style für VirtualCompanionDeck
- Konfigurierbarer Frame-Farbe oder Dom-Farbe (immer silber/grau)

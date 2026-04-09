# ChannelStrip Element — Design Spec

**Datum:** 2026-04-09  
**Status:** Approved — bereit für Implementierungsplan  
**Nächste Session:** Implementierungsplan schreiben, dann implementieren

---

## Ziel

Ein neues Element `channelStrip` für das Companion Webpanel. Vereint Meter, Fader-Wheel, Mute und Solo in einem einzigen konfigurierbaren Block — analog zum Channel Strip eines Hardware-Mixers. Wird über einen Setup-Wizard beim Erstellen konfiguriert.

---

## Plugin-Analyse (Entscheidungsgrundlage)

Analysierte Plugins: vMix, Allen & Heath SQ, Behringer Wing.

**Kritische Erkenntnisse:**
- **Meter-Daten** (live dB, Peak): nur vMix liefert diese als Variablen. SQ und Wing haben keine Meter-Variablen.
- **Mute/Solo**: alle 3 Plugins über normale Companion-Buttons (bgColor-Feedback + Action).
- **Fader-Control**: alle 3 Plugins über Companion-Actions, erreichbar via `SUB-ROTATE`.
- **`SUB-ROTATE`** ist in der Satellite API v1.10 supported (`SUB-ROTATE SUBID=myid DIRECTION=1`). Gleicher SUBID wie `SUB-PRESS` → ein Button kann Rotate (Fader) + Press (Mute) + bgColor (Mute-State) + Text (Daten) vereinen.

---

## Architektur: Ein-Button-Modell

Ein einziger Companion-Button (`buttonRef`) übernimmt die Hauptfunktionen:

```
buttonRef (1 Companion-Button an page/row/col):
  ├─ bgColor       → Mute visueller State (rot = muted, default = unmuted)
  ├─ SUB-PRESS     → Mute-Action (Klick auf Mute-Button im Strip)
  ├─ SUB-ROTATE    → Fader CW (DIRECTION=1) / CCW (DIRECTION=-1)
  └─ TEXT          → Multi-Wert via Separator geparst
       Beispiel Companion-Text:
         "$(vmix:input_1_meterf1)|$(vmix:input_1_meterf2)|$(vmix:input_1_volume_db)|Guitar"
       Index 0 = Meter L (dB)
       Index 1 = Meter R (dB)  [optional, leer = mono]
       Index 2 = Fader Level (dB)  [für Fader-Bar + dB-Wert-Anzeige]
       Index 3 = Channel Name  [optional, fallback: style.name]

soloRef  (CompanionRef, optional):
  ├─ bgColor  → Solo visueller State
  └─ SUB-PRESS → Solo-Action

panRef (CompanionRef, optional):
  └─ TEXT → Pan-Wert (z.B. "L20", "-0.4", "C")
```

**Keine separaten faderUpRef/faderDownRef** — SUB-ROTATE ersetzt das vollständig.

---

## TypeScript Typ

```typescript
export interface ChannelStripElement extends BaseElement {
  type: 'channelStrip'

  style: {
    /** Accent-Farbe für den 20px Color Stripe oben (hex) */
    color: string
    /** Statischer Channel-Name (Fallback wenn kein nameIndex konfiguriert) */
    name?: string
    /** Mono-Modus: nur ein Meter-Bar, Pan-Indicator ausgegraut */
    mono?: boolean
    /** dBFS-Wert ab dem die Clip-LED zu blinken beginnt. Default: 0 */
    clipThreshold?: number
    /**
     * Wie viele SUB-ROTATE Events bei Shift+Scroll gesendet werden.
     * Normal-Scroll = 1× SUB-ROTATE. Shift+Scroll = coarseMultiplier× SUB-ROTATE.
     * Default: 10
     */
    coarseMultiplier?: number
  }

  refs: {
    /**
     * Haupt-Button: Mute (SUB-PRESS + bgColor) + Fader (SUB-ROTATE) + Daten (TEXT)
     */
    button: {
      ref: CompanionRef
      /**
       * Trennzeichen für Multi-Wert Text-Feld. Default: '|'
       * Wenn leer/undefined: gesamter Text wird als einzelner Wert behandelt
       */
      textSeparator?: string
      /** Text-Index für Meter L dB-Wert. Default: 0 */
      meterLIndex?: number
      /** Text-Index für Meter R dB-Wert. Wenn undefined + !style.mono: kein R-Kanal */
      meterRIndex?: number
      /** Text-Index für Fader Level (Anzeige: Fader-Bar + dB-Zahl). Optional */
      levelIndex?: number
      /** Text-Index für Channel Name. Optional — Fallback: style.name */
      nameIndex?: number
    }

    /** Solo-Button (optional). Ausgegraut im Strip wenn nicht konfiguriert. */
    solo?: CompanionRef

    /** Pan-Indicator Datenquelle (optional). TEXT = Pan-Wert. Ausgegraut wenn fehlt. */
    pan?: CompanionRef
  }
}
```

---

## Visuelles Design

### Gesamtlayout (von oben nach unten)

```
┌─────────────────────────────────┐  ← 20px Color Stripe (style.color)
│  GUITAR             [Clip LED]  │     Channel Name integriert, Clip LED rechts
├─────────────────────────────────┤
│  Pan: [══════●════════════════] │  ← Pan-Indicator (ausgegraut wenn mono/fehlt)
│       L20                       │
├─────────────────────────────────┤
│  [L-Bar][R-Bar]  [FaderTrack]   │  ← Meter L+R + Peak-Hold · Fader-Bar + dB-Wert
│         peak     │  -6.0        │
│                  │  dB          │
├─────────────────────────────────┤
│  [═══════ DRUM WHEEL ═══════]   │  ← Horizontales Scroll-Wheel (Drag + Mausrad)
├─────────────────────────────────┤
│  [  MUTE  ]  [  SOLO  ]        │  ← Mute (rot wenn aktiv) · Solo (ausgegraut wenn kein soloRef)
└─────────────────────────────────┘
```

### Color Stripe (20px)
- Höhe: **20px**, volle Breite
- Hintergrundfarbe: `style.color` (konfigurierbar, default `#4a9eff`)
- Channel-Name **im Stripe** integriert: `font-size: 9px, font-weight: 700, color: rgba(0,0,0,0.6), letter-spacing: 2px, text-transform: uppercase`
- Clip-LED: rechts im Stripe, 10px Kreis

### Clip LED
- **Normal**: dunkles Rot (`#2a0a0a`), keine Aktivität
- **Clipping**: blinkt mit CSS-Animation (`step-start, 0.5s`) zwischen leuchtendem Rot (`#ff5a5f` mit Glow) und dunklem Rot
- Auslöser: Meter-L-Wert **oder** Meter-R-Wert ≥ `style.clipThreshold` (Default: `0` dBFS)
- **Kein Reset** — blinkt solange der Wert überschritten ist

### Pan-Indicator
- Schmaler Track (4px Höhe), volle Breite
- Mittelmarkierung (1px), Dot-Indikator verschiebt sich L/R
- **Ausgegraut** (`opacity: 0.2`, non-interactive) wenn:
  - `style.mono === true`, ODER
  - `refs.pan` nicht konfiguriert
- Pan-Wert-Text darunter (7px, `#3a4a5e`)
- Pan-Parsing: versucht numerisch (`-1.0` bis `+1.0`), dann L/R-Offset-Strings (`"L20"` → `-0.2`, `"R10"` → `+0.1`, `"C"` → `0`)

### Meter Bars
- L-Kanal: immer sichtbar
- R-Kanal: sichtbar wenn `refs.button.meterRIndex` konfiguriert und `!style.mono`; sonst ausgegraut/ausgeblendet
- Höhe: 80px, Breite: 10px pro Bar, 3px Gap
- Farbgradient (bottom→top): `#21d07a` → `#21d07a` (55%) → `#ff8a3d` (78%) → `#ff5a5f` (92%)
- **Peak-Hold-Linie**: 2px horizontale Linie, `#ff5a5f` mit Glow; hält die Maximalposition für `peakHoldMs` (konfigurierbar, default: `2000ms`), fällt dann langsam ab
- Wert-Parsing: Versucht `parseFloat`. Falls `"-oo"` (Wing) oder `"-inf"`: → `-144`. Falls `NaN`: → kein Update.

### Fader-Track (neben Meter)
- Vertikale Track-Bar (6px Breite, 80px Höhe)
- Fader-Knob: 20px × 7px, positioniert entsprechend `levelIndex`-Wert
- dB-Wert-Anzeige darunter: `font-size: 12px, color: #4a9eff, JetBrains Mono`
- Level-Normalisierung: `(-60 bis +10 dB)` → `(0% bis 100%)` der Track-Höhe; `-∞` → `0%`
- Wenn kein `levelIndex`: Fader-Track ausgeblendet, nur dB-Wert aus Meter-L verwendet

### Drum Wheel
- Horizontales Scroll-Wheel, volle Breite, 28px Höhe
- Optik: geriffelte Trommel (repeating-gradient, ridges), Mittel-Highlight-Linie, 5 Grip-Dots
- **Interaktion:**
  - Mausrad ↑ / Touch-Drag rechts → `SUB-ROTATE SUBID=buttonRef DIRECTION=1`
  - Mausrad ↓ / Touch-Drag links → `SUB-ROTATE SUBID=buttonRef DIRECTION=-1`
  - Shift + Mausrad: sendet `coarseMultiplier` × SUB-ROTATE Events rapid hintereinander (Default: 10)
  - **Doppelklick / Doppeltap** auf Wheel → `SUB-PRESS PRESSED=true` + `SUB-PRESS PRESSED=false` auf buttonRef (Unity Reset / Dafault-Aktion in Companion konfigurieren)
  - Touch: `touch-action: none`, `setPointerCapture` für zuverlässiges Tracking
- Cursor: `ew-resize`

### Mute Button
- Volle Hälfte der Buttonzeile
- **Aktiv (muted)**: `background: linear-gradient(#ff6b6b, #d94848)`, Glow-Shadow
- **Inaktiv**: `background: #141b28`, Border `#253045`, Text `#3a4a5e`
- Klick → `SUB-PRESS PRESSED=true` + `SUB-PRESS PRESSED=false` auf `refs.button.ref`
- State aus `bgColor` von `refs.button.ref`: wenn `bgColor` ≠ default-Dunkelfarbe → als "aktiv" werten (exakte Logik: `bgColor`-Helligkeitsschwelle oder explizite Color-Comparison)

### Solo Button
- Volle andere Hälfte der Buttonzeile
- **Ausgegraut** (`opacity: 0.3`, non-interactive) wenn `refs.solo` nicht konfiguriert
- **Aktiv**: `background: #ff8a3d`, Glow
- **Inaktiv**: `background: #141b28`, Border
- Klick → `SUB-PRESS` auf `refs.solo`
- State aus `bgColor` von `refs.solo`

---

## Setup Wizard

Wird beim Hinzufügen von `channelStrip` aus dem `+`-Menü gestartet.

### Schritt 1: Haupt-Button
Auswahl des `buttonRef` via Companion Button Picker (bestehende UI).

Erklärungstext im Wizard:
> "Wähle den Button der Mute, Fader-Control und Messwerte enthält.  
> In Companion konfigurieren: **Press** = Mute-Action, **Rotate left/right** = Fader-Action, **Text-Feld** = Variablen (z.B. `$(vmix:input_1_meterf1)|$(vmix:input_1_volume_db)`)."

### Schritt 2: Text-Variablen konfigurieren
Formular mit:
- `textSeparator` (Eingabe, Default `|`)  
- Preview der geparsten Felder (live aus aktuellem Button-Text wenn verbunden)
- Dropdowns: "Meter L" → Index, "Meter R" → Index (oder "–"), "Fader Level" → Index (oder "–"), "Name" → Index (oder "–")

### Schritt 3: Optionale Refs
- `soloRef`: Button-Picker + Erklärung "Ohne Solo-Button: Solo-Taste ausgegraut"
- `panRef`: Button-Picker + Erklärung "Pan aus Text-Variable, z.B. `$(vmix:input_1_pan)`"
- Beide überspringbar

### Schritt 4: Style
- Color Picker für `style.color` (Stripe-Farbe)
- Checkbox `style.mono`
- `style.clipThreshold` (NumericInput, Default: 0)
- `style.coarseMultiplier` (NumericInput, Default: 10) + Erklärung:
  > "Shift + Scroll sendet 10× SUB-ROTATE = 10× Feinschritte = 1 grober Schritt. Passe an die Companion-Action-Schrittweite an."
- `style.name` (Texteingabe, Fallback-Name wenn kein nameIndex)

### Schritt 5: Zusammenfassung
Zeigt konfigurierten Strip als Mini-Preview. Fertig-Button erstellt das Element auf dem Canvas.

---

## Properties Panel (Edit-Mode)

Alle Wizard-Felder auch im PropertiesPanel editierbar. Sections:
- **Refs** (buttonRef, soloRef, panRef — je mit Button-Picker)
- **Text-Parsing** (separator, field-indices)
- **Style** (color, name, mono, clipThreshold, coarseMultiplier)
- **Geometry** (x, y, w, h — Standard)

---

## isContained Pattern

Wie alle anderen Elemente: `isContained`-Prop. Bei `true` → `position: relative, 100%×100%` statt absolute-Positionierung im EditableElement-Wrapper.

---

## Scope / Not in MVP

- GR Meter (Gain Reduction) — kein Plugin liefert dies zuverlässig
- Proportionales Multi-Select Resize
- Animierte Meter-Fallback-Simulation (kein Timer — nur echte Werte aus Companion)
- `faderRef` als separates Feld (entfällt — SUB-ROTATE auf buttonRef reicht)

---

## Offene Punkte für Implementierung

- **Mute-State-Erkennung aus bgColor**: Companion liefert die configured Feedback-Farbe als hex. Schwellenwert-Logik definieren (z.B. relative Helligkeit > 0.3 = aktiv). Alternativ: User konfiguriert "mute color" explizit. → Im Implementierungsplan entscheiden.
- **SUB-ROTATE in SatelliteClient.ts**: aktuell nur SUB-PRESS implementiert. SUB-ROTATE muss als neue Frontend→Backend→Companion Message hinzugefügt werden (neuer Message-Type `rotate` in `FrontendToBackend`).

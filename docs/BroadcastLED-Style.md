# Broadcast-LED-Style — Spezifikation (Variante 2b)

Ein **Panel-weiter Overlay-Style**, der sich über alle Buttons „stülpt": Er ersetzt nicht die Button-Daten, sondern re-interpretiert deren Farben als LED-Beleuchtung. Referenz: `Physische Buttons.dc.html`, Abschnitt 2b.

> Umsetzung: `packages/frontend/src/utils/physical.ts` (`buildLedCapStyle`, `buildLedTextShadow`, `LED_COLLAR_STYLE`, `isLit`) — global aktiviert via `Settings.buttonStyle: 'broadcast-led'` (v1.5.0).

---

## 1. Grundprinzip

Der Style ist eine **Render-Transformation**, kein Button-Property:

- Die von Companion gelieferte **Button-Farbe (`bgColor`) wird zur LED-Signalfarbe** — sie füllt nicht mehr die Fläche, sondern durchleuchtet die dunkle Kappe von innen (radialer Glow von unten-mittig) und färbt den Schrift-Glow.
- Die **Textfarbe (`color`) aus Companion wird zur Legenden-Farbe** mit LED-Glow in derselben Signalfarbe.
- Jeder Button bekommt einen festen **Metallkragen** (neutral, dunkelgrau) — der bewegt sich nie mit.
- Die Kappe selbst ist **dunkles Plastik** (`#1d1f23`) mit feiner Spritzguss-Narbung.

Damit funktioniert der Style mit *jedem* bestehenden Button ohne Datenmigration: Companion-Feedback (Farbwechsel bei aktiv) wird automatisch zu „LED blüht auf".

---

## 2. Struktur pro Button (3 Schichten)

```
┌─ Kragen (fest) ───────────────────────────┐
│  padding: 5px                             │
│  background: linear-gradient(180deg,      │
│    #383b41 0%, #24272c 55%, #1a1c20 100%) │
│  boxShadow: inset 0 1px 1px               │
│    rgba(255,255,255,0.18),                │
│    0 3px 7px rgba(0,0,0,0.6)              │
│  borderRadius: buttonRadius + 4px         │
│ ┌─ Kappe (beweglich) ───────────────────┐ │
│ │  translateY(-1.5px) im Ruhezustand    │ │
│ │  dunkles Plastik + LED-Glow           │ │
│ │  ┌─ Legende ─────────────────────┐    │ │
│ │  │  Text mit LED-Text-Glow       │    │ │
│ │  └───────────────────────────────┘    │ │
│ └───────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

---

## 3. Zustände der Kappe

`led = "R,G,B"` der Companion-Buttonfarbe. Alle Zustände nutzen dieselbe Layer-Reihenfolge:
`Noise, Gloss-Verlauf, LED-Radial, Grundfarbe`.

### 3.1 Idle (nicht aktiv, nicht gedrückt) — LED glimmt schwach

```css
transform: translateY(-1.5px);
background:
  <NOISE opacity 0.05>,
  linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 30%, rgba(0,0,0,0.18) 100%),
  radial-gradient(circle at 50% 62%, rgba(led,0.30) 0%, rgba(led,0.10) 50%, rgba(0,0,0,0) 78%),
  #1d1f23;
box-shadow:
  0 4px 7px rgba(0,0,0,0.7),
  inset 0 1px 1px rgba(255,255,255,0.16),
  inset 0 -1px 2px rgba(0,0,0,0.5);
```

### 3.2 Gedrückt (pressed) — Kappe fährt 3.5px runter, LED blüht auf

```css
transform: translateY(2px);
background:
  <NOISE opacity 0.05>,
  linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 30%, rgba(0,0,0,0.22) 100%),
  radial-gradient(circle at 50% 58%, rgba(led,0.65) 0%, rgba(led,0.28) 55%, rgba(0,0,0,0) 82%),
  #221518;  /* Grundton leicht in Richtung LED-Farbe getönt: rgb(r*0.13, g*0.08, b*0.09) */
box-shadow:
  0 1px 2px rgba(0,0,0,0.7),
  0 0 18px rgba(led,0.35),          /* Außen-Glow */
  inset 0 2px 3px rgba(0,0,0,0.45);
transition: none;                    /* Druck = sofort; Loslassen = 0.06s */
```

> **Umsetzung (POC-Abgleich 2026-07-14):** Der innere Radial-Stop nutzt bei Aktiv die
> **aufgehellte** LED-Farbe (`mix(led, 0.3)`, α 0.85) statt des Kerns, die Grundfarbe ist
> `led×0.35` (das POC-Beispiel `#10281a` ist deutlich heller als die Prosa-Formel
> ×0.16/0.10/0.10, die zu matt wirkte), Außen-Glow 22 px α 0.55. **Dome-Buttons** erhalten
> bei Aktiv im LED-Modus ein Leucht-Overlay über der Mulde (`buildDomeLedGlow`,
> `mix-blend-mode: screen`) + Außen-Glow (`ledGlowShadow`) — sonst wäre Aktiv auf Domes
> fast unsichtbar.

### 3.3 Aktiv (Companion-Feedback, z.B. „PV Backup Aximmetry") — voll durchleuchtet

```css
transform: translateY(-1.5px);
background:
  <NOISE opacity 0.05>,
  linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 30%, rgba(0,0,0,0.14) 100%),
  radial-gradient(circle at 50% 58%, rgba(led,0.75) 0%, rgba(led,0.45) 52%, rgba(0,0,0,0.2) 100%),
  rgb(r*0.16, g*0.10, b*0.10);      /* dunkel getönte Grundfarbe, z.B. Grün → #10281a */
box-shadow:
  0 3px 6px rgba(0,0,0,0.6),
  0 0 18px rgba(led,0.45),          /* permanenter Außen-Glow */
  inset 0 1px 1px rgba(255,255,255,0.16),
  inset 0 -1px 2px rgba(0,0,0,0.4);
```

### 3.4 Aktiv + gedrückt

Wie 3.2, aber Radial `rgba(led,0.90) → rgba(led,0.55)` und Außen-Glow `0 0 26px rgba(led,0.65)`.

---

## 4. Legende (Text-Glow)

Die Companion-Textfarbe bleibt erhalten und bekommt einen LED-Glow.

> **Umsetzung (Design-Review 2026-07-14, `buildLedLegend`):** Zwei Fälle:
>
> - **Unlit** (dunkle bgColor): Der Glow folgt der **Legendenfarbe** (Companion-
>   textColor) — reale Companion-Buttons tragen die Signal-Info oft in der Textfarbe
>   (dunkle bgColor + rote „CUT"-Schrift); mit bgColor-Glow bliebe die Legende dunkel.
> - **Lit** (aktives Feedback): Die Legende wirkt **durchleuchtet** — Textfarbe wird
>   auf ein fast-weißes Tint der LED-Farbe gehoben (`mix(led, 0.88)` → Grün #eafff1,
>   Rot #fff0f0) und der Glow ist zweischichtig in der LED-Farbe: innen aufgehellt
>   (`mix(led, 0.35)`, α 0.9), außen Kern-LED (α 0.5). Radien ≈ 0.65×/1.5× fontSize
>   (12 px → 8/18 px). Bestätigt durch den Design-Agenten (Mockup-Werte).
>
> Die Glow-Radien skalieren generell mit der Schriftgröße; der Text-Span braucht
> `overflow: visible`, sonst clippt CSS den Glow zum farbigen Rechteck.

```css
/* Unlit (glow = Legendenfarbe, Radien × fontSize: 0.35/0.8) */
text-shadow: 0 0 8px rgba(legend,0.8), 0 0 18px rgba(legend,0.4);
/* Lit (color = fast-weißes LED-Tint, glow = LED-Farbe, Radien × fontSize: 0.65/1.5) */
color: #fff0f0; /* mix(led, 0.88) */
text-shadow: 0 0 8px rgba(ledHell,0.9), 0 0 18px rgba(led,0.5);
```

---

## 5. Aktiv-Erkennung (`lit`)

Companion signalisiert „aktiv" nur über Farbwechsel. Heuristik:

```ts
function isLit(bgColor: string): boolean {
  const [r, g, b] = parseHex(bgColor)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.18
}
```

Helle/gesättigte Feedback-Farben (Grün, Rot, Gelb) → voll durchleuchtet.
Dunkle Default-Farben (Companion-Schwarz/Grau) → nur schwaches Glimmen.

---

## 6. Flag `forceBlackCap` (pro Button)

Optionales Button-Flag, nur wirksam wenn der Broadcast-LED-Style aktiv ist:

```ts
// Render-Settings pro Button:
forceBlackCap?: boolean   // default false
```

Verhalten bei `forceBlackCap: true`:

- Die Kappe wird **immer** auf das Referenz-Schwarz `#1d1f23` gesetzt — unabhängig von der Companion-Buttonfarbe, auch im Aktiv-Zustand.
- Die Companion-Farbe wirkt dann **nur noch als LED**: Radial-Glow, Außen-Glow und Text-Glow.
- Aktiv-Zustand: Außen-/Text-Glow wie 3.3, Grundfarbe bleibt schwarz; der Radial-Bloom liegt bei **0.55/0.28** (Agent-Referenzwert für die aktive Kappe) — klar sichtbar als Aktiv-Signal, aber unterhalb der vollen 0.75-Durchleuchtung, damit sich die Fläche nicht komplett einfärbt (Look der „CUT/MERGE"-Kappen im Referenzbild). Die Legende wird dabei durchleuchtet (fast-weißes LED-Tint + LED-Farb-Glow, siehe Abschnitt 4).
- Beim Drücken blüht die LED trotzdem auf (taktiles Feedback) — die Grundfarbe bleibt schwarz.
- **Gilt auch für Dome-Buttons** (`render.physicalStyle`): Die Dome-Geometrie bleibt, aber Rand/Kappe/Mulde werden vom Referenz-Schwarz `#1d1f23` abgeleitet statt von der Companion-Farbe — schwarze Domes mit glühender Legende (dunkler Hardware-Look wie die LED-Kappen).
- Die Checkbox ist im PropertiesPanel **immer sichtbar und setzbar**, zieht aber nur bei aktivem Broadcast-LED-Modus.

Zweck: einheitlich schwarze Hardware-Optik über das ganze Panel, Farben tragen nur noch Signal-Bedeutung.

```ts
const capBase = forceBlackCap ? '#1d1f23' : tintedBase(bgColor, lit)
```

---

## 7. Panel-Ebene

- Der Style wird **global** aktiviert (`Settings.buttonStyle: 'default' | 'broadcast-led'`, Select in den Canvas-Einstellungen) — nicht pro Button. Der physische **Dome-Taster** (`render.physicalStyle`) bleibt eine unabhängige Per-Button-Option und hat Vorrang.
- Empfohlene Canvas-Textur dazu: `matt` („Plastik matt genarbt", siehe `textures.ts`) auf dunklem Grund `#1a1c1f`.
- Gruppen-Shapes: dunkles Plastik-Finish (`style.finish: 'plastic'`), Titel in gedämpfter Tint-Farbe mit `letter-spacing: 0.06em`.
- Keine rote Pressed-Outline im View-Mode — der Hub + Glow ersetzt sie.

# UI Design System

Stil: **Professional Dark Control Surface** — orientiert an OBS, vMix, ATEM.

## Farb-Tokens

```js
surface: { base:'#0f141a', panel:'#121821', card:'#1a2030', overlay:'#1e2535', border:'#2a3344', hover:'#243040' }
accent:  { green:'#21d07a', orange:'#ff8a3d', red:'#ff5a5f', blue:'#4a9eff' }
text:    { primary:'#e9edf2', secondary:'#8896aa', muted:'#4a5568' }
```

## Layout-Maße

| Bereich | Wert |
|---|---|
| Toolbar | 56px Höhe |
| Properties Panel (Edit) | 320px Breite, rechts |
| Grid-Dot-Raster | 40px |
| Border-Radius Buttons | 8px |
| Border-Radius Dialoge | 12px |

## Typografie

- UI: **Inter** Variable (400/500/600/700)
- Monospace (IPs, Key-Indices, Werte): **JetBrains Mono**
- Skala: 11 / 12 / 13 / 14 / 15 / 18 / 24px

## CompanionButton — visuelle States

| State | Aussehen |
|---|---|
| `inactive` | `bg-surface-card`, Rand gestrichelt, opacity 0.6 |
| `active` | Companion `bgColor` als Hintergrund, `textColor` als Text |
| `pressed` | Border `accent-red` 2.5px, `scale(0.97)` — dauert solange Finger/Maus gehalten |
| `stale` | opacity 0.5, Ring `accent-orange`, ⚠ Overlay-Icon |

## CompanionButtonElement — Render-Optionen

| Option | Default | Beschreibung |
|---|---|---|
| `showBitmap` | `false` | Companion-Bitmap anzeigen. Default false — Text ist bereits in Bitmap eingebettet |
| `scaleBitmap` | `true` | Bitmap auf Container skalieren (`objectFit: contain`). `false` = feste 72px pixelscharf. Nur sichtbar wenn `showBitmap=true` |
| `showText` | `true` | Text-Overlay anzeigen |
| `showBgColor` | `true` | Companion `bgColor` als Button-Hintergrund anwenden |
| `textAlign` | `'bottom'` | Textposition: `top` / `center` / `bottom` — gilt immer (auch ohne Bitmap) |
| `bitmapSize` | `72` | Pixelgröße der angezeigten Bitmap |
| `borderRadius` | `6` | Border-Radius des Button-Containers |

## Keyboard Shortcuts

`V` = View · `E` = Edit · `G` = Grid · `S` = Snap · `Ctrl+S` = Speichern · `Ctrl+Z` = Undo · `Ctrl+Y` = Redo · `Del` = Löschen · `Ctrl+D` = Duplizieren · `Pfeiltasten` = 1px Nudge · `Shift+Pfeiltasten` = 10px Nudge · `Shift+Klick` = Selektion erweitern · `Escape` = Selektion aufheben

## Edit-Mode vs. View-Mode

| | View-Mode | Edit-Mode |
|---|---|---|
| Button-Klick | KEY-PRESS an Companion | Element-Auswahl / Properties |
| Drag | deaktiviert | Elemente verschiebbar |
| Resize | deaktiviert | aktiv, min. = bitmapSize |
| Grid-Overlay | aus (wenn grid.enabled=false) | einblendbar |
| Elemente hinzufügen | nein | ja, über `+`-Button |
| Live-Mirror | aktiv | aktiv (Vorschau) |

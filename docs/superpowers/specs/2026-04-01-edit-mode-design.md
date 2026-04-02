# Edit-Mode Design Spec
**Datum:** 2026-04-01  
**Projekt:** Companion Webpanel  
**Phase:** 3 — Frontend Canvas

---

## Überblick

Implementierung des Edit-Modes für das Companion Webpanel. Ermöglicht das freie Positionieren, Skalieren, Duplizieren und Konfigurieren von Canvas-Elementen (CompanionButton, Shape, Label).

Im View-Mode bleibt alles unverändert — Buttons lösen KEY-PRESS aus, kein Drag.

---

## 1. Komponenten-Struktur

```
packages/frontend/src/components/
├── Canvas/
│   ├── Canvas.tsx               DndContext, RubberBand-Overlay, Klick-auf-leer = deselektieren
│   └── RubberBand.tsx           SVG-Rect während Rubber-Band-Selektion
├── EditableElement.tsx          Wrapper für alle Element-Typen im Edit-Mode:
│                                useDraggable + ResizeHandles + Selektion-Ring
├── Elements/
│   ├── CompanionButtonElement.tsx   unverändert (nur render)
│   ├── ShapeElement.tsx             unverändert (nur render)
│   ├── LabelElement.tsx             unverändert (nur render)
│   └── ResizeHandles.tsx        8 orange Handles, custom onPointerDown/Move/Up
└── PropertiesPanel/
    └── PropertiesPanel.tsx      Overlay-Panel, 2 Buttons (⇄ flip + ‹/› collapse)
```

**Kernprinzip:** Die bestehenden Element-Komponenten bleiben unverändert — sie rendern nur.  
`EditableElement` ist ein reiner Wrapper der im Edit-Mode Drag, Resize und Selektion hinzufügt.

---

## 2. State Management (Zustand Store)

### Neue Store-Felder

```typescript
// Selektion
selectedIds: Set<string>
selectElement(id: string, addToSelection: boolean): void  // addToSelection für Shift+Klick
selectElements(ids: string[]): void                        // Rubber-Band Ergebnis
clearSelection(): void                                     // Klick auf leeren Canvas

// Geometrie
updateElementGeometry(panelId: string, elementId: string, patch: Partial<{x,y,w,h}>): void
// Schreibt direkt in settings.panels[].elements[] — wird nur auf dragEnd/resizeEnd aufgerufen

// Undo/Redo (je 1 Ebene)
_prevElementStates: Record<string, {x: number, y: number, w: number, h: number}> | null
_nextElementStates: Record<string, {x: number, y: number, w: number, h: number}> | null
undo(): void   // Ctrl+Z
redo(): void   // Ctrl+Y

// Duplizieren / Löschen
duplicateElements(ids: string[]): void
// - Kopiert alle selektierten Elemente
// - Neue ID pro Element (crypto.randomUUID())
// - Position +75px / +75px versetzt
// - Anhängen ans Ende von panel.elements[]
// - Selektion auf neue Kopien setzen

deleteElements(ids: string[]): void
```

### Was NICHT in den Store kommt

Properties-Panel-Zustand (reine UI-Präferenz, kein App-State):
```typescript
// localStorage Keys:
'cwp:propsPanelSide': 'left' | 'right'   // default: 'right'
'cwp:propsPanelOpen': 'true' | 'false'   // default: 'true'
```

### Drag-Delta während Drag

Ein `DragDeltaContext` (React Context, kein Zustand-Store) hält den aktuellen Drag-Delta.  
Kein Store-Update per Pointer-Move — bleibt flüssig.

```typescript
// DragDeltaContext Wert während Drag:
{ dx: number, dy: number } | null
```

Alle selektierten Elemente lesen diesen Context und wenden `translate(dx, dy)` als CSS-Transform an.  
Erst auf `onDragEnd` → `updateElementGeometry()` für alle selektierten Elemente.

---

## 3. Drag (Hybrid: @dnd-kit + DragDeltaContext)

### Einzelelement-Drag
- `useDraggable` pro Element (nur im Edit-Mode aktiv)
- `DndContext.onDragMove` → DragDeltaContext updaten
- `DndContext.onDragEnd` → `updateElementGeometry()` für alle selektierten Elemente

### Gruppen-Drag (Multi-Select)
Alle selektierten Elemente lesen denselben DragDeltaContext → bewegen sich synchron.  
Auf `onDragEnd` werden alle Positionen in einem einzigen Store-Update commited.

### Magnetischer Snap (Custom @dnd-kit Modifier)

Grid-Größe: `panel.grid.size` (default 40px). Threshold: 8px.

```
Für x und y separat:
  rest = position % gridSize
  if (rest < 8)                 → snap auf Grid-Linie (abrunden)
  if (rest > gridSize - 8)      → snap auf nächste Grid-Linie (aufrunden)
  sonst                         → freie Bewegung
```

Snap greift nur wenn `panel.grid.snap === true` (toggle via `S`-Shortcut).

---

## 4. Resize (Custom Pointer Events)

@dnd-kit ist beim Resize nicht beteiligt.

### Handle-Zuständigkeiten

```
tl → x, y, w, h    tc → y, h         tr → y, w, h
ml → x, w                             mr → w
bl → x, w, h       bc → h             br → w, h
```

### Ablauf

```
onPointerDown auf Handle
  → _prevElementStates Snapshot speichern (BEVOR die Änderung, damit Undo korrekt zurückspringt)
  → resizeState = { handleId, startX, startY, startGeometry: {x,y,w,h} }
  → handle.setPointerCapture(e.pointerId)
    ← Alle weiteren Pointer-Events gehen zum Handle-Element,
       auch wenn die Maus schnell über andere Elemente oder den Canvas-Rand zieht

onPointerMove (auf dem Handle — dank setPointerCapture)
  → dx = currentX - startX,  dy = currentY - startY
  → Neue Geometrie berechnen (je nach Handle-Position)
  → enforceMinSize anwenden
  → Visuelles Update via CSS direkt (kein Store-Update während Drag)

onPointerUp
  → updateElementGeometry() in Store → _nextElementStates für Redo speichern
  → resizeState = null
```

### Minimum-Größen pro Element-Typ

```typescript
const MIN_SIZE: Record<string, number> = {
  companionButton: 72,   // Companion Bitmap-Größe
  shape:           8,
  label:           8,
}
```

**Wichtig bei tl/tc/tr/ml/bl:** Wenn Minimum erreicht wird, darf x/y nicht weiter verschoben werden:
```
if (newW === MIN_W) newX = startGeometry.x + startGeometry.w - MIN_W
if (newH === MIN_H) newY = startGeometry.y + startGeometry.h - MIN_H
```

### Snap beim Resize
Gleiche Threshold-Logik (8px) wie beim Drag — gilt für die gezogene Kante.

### Multi-Select + Resize
Bei mehr als einem selektierten Element werden Resize-Handles ausgeblendet.  
Resize nur bei Einzel-Selektion.

---

## 5. Rubber-Band Selektion

`onPointerDown` auf Canvas-Hintergrund (kein Element getroffen) startet Rubber-Band:

```
pointerDown   → startPoint = {x, y}, rubberBandActive = true
pointerMove   → SVG <rect> von startPoint bis currentPoint
pointerUp     → Alle Elemente deren Bounding-Box die rect schneidet → selectElements(ids)
```

- SVG-Overlay: `position:absolute`, volle Canvas-Größe, `pointerEvents:none` auf Elementen während aktiv
- Rubber-Band-Rect Style: `fill: rgba(74,158,255,0.08)`, `stroke: #4a9eff`, `strokeWidth: 1`
- Shift+Rubber-Band: neue Elemente zur bestehenden Selektion hinzufügen

---

## 6. Properties Panel

### Positionierung
`position:absolute` Overlay auf dem Canvas — Canvas behält immer volle Breite.  
Breite: **280px** (CLAUDE.md Design-System).

### Header (2 Buttons)
```
Panel rechts offen:   [ ⇄ ]  [ › ]
Panel links offen:    [ ‹ ]  [ ⇄ ]
```
- **⇄** — Panel auf die andere Seite springen (Zustand in localStorage)
- **‹/›** — Panel ein-/ausklappen (Zustand in localStorage)

Eingeklappt: 20px schmaler Tab am jeweiligen Rand, klickbar zum Öffnen.

### Inhalte

**Geometrie-Block (alle Typen):**
```
Position   x [____]   y [____]
Größe      w [____]   h [____]
```

**CompanionButtonElement:**
```
Show Background Color  ☐
Show Bitmap            ☐
Show Text              ☐
Text-Align             [top / center / bottom]
Border-Radius          [____]
Opacity                [____]
```

**ShapeElement:**
```
Fill          [Colorpicker]
Stroke        [Colorpicker]
Stroke-Breite [____]
Border-Radius [____]
```

**LabelElement:**
```
Text          [Textarea]
Farbe         [Colorpicker]
Font-Size     [____]
Font-Weight   [normal / bold]
Ausrichtung   [left / center / right]
```

**Multi-Select:** Nur Geometrie-Block sichtbar. Unterschiedliche Werte → `—` anzeigen (editierbar: setzt alle auf denselben Wert).

**Kein Element selektiert:** Canvas-Einstellungen anzeigen:
```
Canvas-Größe:
  ○ Dynamisch (folgt Fenster)
  ○ 1920 × 1080
  ○ 1440 × 900
  ○ 1280 × 720
  ○ Benutzerdefiniert  [____] × [____]

Hintergrundfarbe  [Colorpicker]
```

### Input-Verhalten (alle Zahlenfelder)
- Mausrad: ±1
- Shift+Mausrad: ±10
- Pfeiltasten: ±1
- Shift+Pfeiltasten: ±10
- Live-Preview auf Canvas beim Eingeben
- Store-Update bei `blur` oder `Enter`
- Kein "Speichern"-Button im Panel — Ctrl+S speichert alles

---

## 7. Canvas-Größe

```
panel.canvas.width/height = undefined  →  dynamisch: 100% verfügbarer Platz
                                           ResizeObserver auf Container
panel.canvas.width/height gesetzt      →  feste Größe, Canvas scrollbar
```

Preset-Werte: 1920×1080, 1440×900, 1280×720, Benutzerdefiniert.  
Einstellbar im Properties Panel wenn kein Element selektiert.

---

## 8. Keyboard Shortcuts

| Shortcut | Aktion |
|---|---|
| `E` | Edit-Mode |
| `V` | View-Mode |
| `G` | Grid-Overlay togglen |
| `S` | Snap togglen |
| `Ctrl+S` | Speichern (POST /api/settings) |
| `Ctrl+Z` | Undo (1 Ebene) |
| `Ctrl+Y` | Redo (1 Ebene) |
| `Ctrl+D` | Selektierte Elemente duplizieren (+75px versetzt, Kopien selektiert) |
| `Del` | Selektierte Elemente löschen |
| `Pfeiltasten` | 1px Nudge |
| `Shift+Pfeiltasten` | 10px Nudge |
| `Shift+Klick` | Zur Selektion hinzufügen / entfernen |
| `Escape` | Selektion aufheben |

---

## 9. Implementierungsreihenfolge

1. Store-Erweiterungen (selectedIds, updateElementGeometry, undo/redo, duplicate, delete)
2. EditableElement Wrapper + DragDeltaContext
3. DndContext in Canvas + Drag für Einzel- und Gruppen
4. Snap-Modifier
5. ResizeHandles Komponente
6. Rubber-Band Selektion
7. Properties Panel (erst Geometrie-Block, dann element-spezifisch)
8. Canvas-Größen-Einstellung
9. Keyboard Shortcuts vervollständigen

---

## 10. Nicht im Scope (MVP)

- Proportionales Resize bei Multi-Select
- Voller Undo-Stack (mehr als 1 Ebene)
- Z-Index manuell ändern im Panel (kommt Phase 4)
- Element hinzufügen über `+`-Button (kommt Phase 4)
- MeterElement (kommt Phase 3.4, separater Schritt)

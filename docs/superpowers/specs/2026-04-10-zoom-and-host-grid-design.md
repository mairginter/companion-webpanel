# Design Spec: Panel Zoom + Host Grid-Größe

**Datum:** 2026-04-10  
**Status:** Approved  
**Features:** Panel Zoom (20%–200%) + Grid-Größe aus HostProfile

---

## Feature 1: Panel Zoom

### Ziel
User kann das Panel auf 20%–200% zoomen — zum Verkleinern für Gesamt-Überblick oder Vergrößern für Feinarbeit. Zoom wird pro Panel gespeichert.

### Bereich & Persistenz
- Zoom-Range: **0.2–2.0** (20%–200%), Step 0.05 (5%)
- Default: **1.0** (100%)
- Feld `panel.zoom` existiert bereits in `shared/src/types.ts` und in `createPanel()` (Wert 1) — kein Schema-Bump nötig
- Wird automatisch via `Ctrl+S` / Speichern-Button gespeichert (wie alle Panel-Properties)

### Store

Neue Action in `useAppStore`:
```typescript
setZoom: (panelId: string, zoom: number) => void
```
Klemmt Wert auf [0.2, 2.0], patcht `settings.panels[panelId].zoom`.

### Canvas — Rendering

In `Canvas.tsx` wird ein zweistufiges Layout eingeführt:

```
<div id="canvas-scroll-wrapper">       ← overflow: auto, füllt verfügbaren Raum
  <div id="canvas-scale-root"          ← transform: scale(zoom), transform-origin: top left
       style={{ width: canvasW * zoom, height: canvasH * zoom }}>
    <div id="canvas-inner"             ← position: relative, width: canvasW, height: canvasH
         ref={containerRef}>           ← hier liegen alle Elemente
      ...Elemente...
    </div>
  </div>
</div>
```

> `canvas-scroll-wrapper` bekommt keine feste Größe — der äußere Flex-Container (App-Layout) gibt ihm den verfügbaren Platz. Bei Zoom < 100% passt der Canvas ins Fenster; bei > 100% erscheinen Scrollbars.

### Koordinaten-Fix

`getCanvasPos(e)` in `Canvas.tsx` muss durch Zoom dividieren, damit Lasso, ContextMenu-Position und Drag-Startpunkt stimmen:

```typescript
const getCanvasPos = useCallback((e: React.PointerEvent): Point => {
  const container = containerRef.current
  if (!container) return { x: 0, y: 0 }
  const bounds = container.getBoundingClientRect()
  const zoom = panel?.zoom ?? 1
  return {
    x: (e.clientX - bounds.left) / zoom,
    y: (e.clientY - bounds.top) / zoom,
  }
}, [panel?.zoom])
```

> `containerRef` zeigt auf `canvas-inner` (den un-transformierten Container) — `getBoundingClientRect()` gibt bereits skalierte Koordinaten zurück. Division durch Zoom wandelt zurück in Canvas-Koordinaten.

### Toolbar — ZoomControl

Neue Komponente `ZoomControl.tsx` (neben den Mode-Buttons, sichtbar in View + Edit):

**Button:**
- Material Icon `search` (Lupe) + Prozenttext, z.B. `100%`
- Breite ca. 72px, gleiche Höhe wie Mode-Buttons (32px)
- Bei Zoom ≠ 100%: leichter blauer Tint (wie aktiver Mode-Button)

**Popover (bei Klick):**
- Absolut positioniert unter dem Button, `z-index: 500`
- Breite 220px, Hintergrund `#1a2030`, Border `#2a3344`, Border-Radius 8px
- Inhalt:
  - Horizontaler `<input type="range">` (min=20, max=200, step=5, value=zoom*100)
  - Rechts daneben: Prozentzahl als Text (z.B. `75%`)
  - Darunter: `Reset`-Button → setzt Zoom auf 1.0
- Schließt bei Klick außerhalb (mousedown handler auf document)

**Ctrl+Scroll:**
- Event-Listener auf dem `canvas-scroll-wrapper` (oder `window`)
- `wheel`-Event mit `ctrlKey === true` → Zoom ±5% (step 0.05), klemmen auf [0.2, 2.0]
- `e.preventDefault()` um Browser-Zoom zu verhindern
- Listener nur wenn Canvas gemountet ist

### Änderungen Zusammenfassung
| Datei | Änderung |
|---|---|
| `shared/src/types.ts` | — (zoom bereits vorhanden) |
| `store/useAppStore.ts` | `setZoom(panelId, zoom)` Action hinzufügen |
| `Canvas.tsx` | Zweistufiges Layout, `getCanvasPos` mit Zoom-Division, Ctrl+Scroll Handler |
| `Toolbar/ZoomControl.tsx` | Neue Komponente (Icon-Button + Popover-Slider) |
| `Toolbar/Toolbar.tsx` | `ZoomControl` einbinden (beide Modi) |

---

## Feature 2: Grid-Größe aus HostProfile

### Ziel
Companion-Layouts variieren (StreamDeck 8×4, StreamDeck+ 4×2, etc.). User konfiguriert Grid-Größe einmalig pro Host — Picker und Wizard lesen sie als Startwert.

### Types

```typescript
// shared/src/types.ts — HostProfile
export interface HostProfile {
  // ... bestehende Felder ...
  /** Buttons pro Zeile im Picker-Grid. Default: 8 */
  gridCols?: number
  /** Zeilen im Picker-Grid. Default: 4 */
  gridRows?: number
}
```

Kein Schema-Bump — fehlende Felder = Default (8/4). Bestehende Settings bleiben kompatibel.

### HostManagerModal

Im Add/Edit-Formular, nach den bestehenden Feldern (Name, IP, Port, Notes), neuer Abschnitt "Button-Grid":

- Label: `Buttons pro Zeile` — `NumericInput` (min=1, max=32, default=8)
- Label: `Zeilen` — `NumericInput` (min=1, max=16, default=4)
- 2-spaltig (wie GeometryBlock), kompakt
- Werte werden mit `addHost()`/`updateHost()` gespeichert

### CompanionButtonPickerDialog

- `Props` bekommt optional `initialGridCols?: number`, `initialGridRows?: number`
  - Alternativ: Picker liest den Host direkt aus dem Store anhand der initialen `hostId`
- `useState` für `keysPerRow` und `rows` initialisiert mit Host-Werten (statt hardcodierter 8/4):
  ```typescript
  const [keysPerRow, setKeysPerRow] = useState(initialHost?.gridCols ?? 8)
  const [rows, setRows]             = useState(initialHost?.gridRows ?? 4)
  ```
- Wenn User Host-Dropdown wechselt → `keysPerRow`/`rows` auf neuen Host-Default setzen (Resync)
- User kann Werte weiterhin manuell überschreiben (NumericInput bleibt editierbar)

### ChannelStripWizard (Step 1)

- Wizard liest beim Start `host.gridCols` / `host.gridRows` als Startwert für Grid-Größe-Eingabe
- Gleiche Logik: wenn User Host wechselt → Grid-Größe neu einlesen

### Änderungen Zusammenfassung
| Datei | Änderung |
|---|---|
| `shared/src/types.ts` | `gridCols?`, `gridRows?` zu `HostProfile` |
| `HostManager/HostManagerModal.tsx` | 2 NumericInput-Felder im Formular |
| `AddElement/CompanionButtonPickerDialog.tsx` | Host-Grid als useState-Default, Resync bei Host-Wechsel |
| `AddElement/ChannelStripWizard.tsx` | Gleiche Logik für Step 1 Grid-Größe |

---

## Nicht im Scope
- Proportionales Zoomen mit Maus-Anchor-Point (Zoom auf Cursor-Position)
- Zoom-Animation (CSS transition)
- Verschiedene Zoom-Level pro Element-Typ
- Page-Name im Picker (separates Feature)

# Lasso Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freihand-Lasso-Selektion im Edit-Mode, ersetzt den defekten rechteckigen Rubber-Band.

**Architecture:** Pointer-Events werden direkt am Canvas-Container-Div abgehört (`e.target === e.currentTarget` = leere Fläche). Punkte-Array wird als React-State gehalten. `LassoSelect.tsx` rendert nur SVG. Hit-Test-Logik liegt in `geometry.ts`.

**Tech Stack:** React, TypeScript, Vitest, SVG

---

## File Map

| Datei | Aktion |
|---|---|
| `packages/frontend/src/utils/geometry.ts` | Erweitern: `Point`, `pointInPolygon()`, `lassoHitsElement()` |
| `packages/frontend/src/utils/geometry.test.ts` | Erweitern: Tests für neue Funktionen |
| `packages/frontend/src/components/Canvas/LassoSelect.tsx` | Neu: SVG-Rendering des Lasso-Pfads |
| `packages/frontend/src/components/Canvas/Canvas.tsx` | Ändern: Pointer-Handler, LassoSelect importieren |
| `packages/frontend/src/components/Canvas/RubberBand.tsx` | Löschen |

---

### Task 1: Geometrie-Funktionen + Tests

**Files:**
- Modify: `packages/frontend/src/utils/geometry.ts`
- Modify: `packages/frontend/src/utils/geometry.test.ts`

- [ ] **Schritt 1: Tests schreiben (geometry.test.ts)**

Bestehende Imports-Zeile ersetzen:

```typescript
import { describe, it, expect } from 'vitest'
import { clampMin, applyResizeDelta, rectsOverlap, pointInPolygon, lassoHitsElement } from './geometry'
```

Neue Describe-Blöcke am Ende der Datei anhängen (nach dem `rectsOverlap`-Block):

```typescript
describe('pointInPolygon', () => {
  // Quadrat 0,0 → 100,100
  const square = [
    { x: 0, y: 0 }, { x: 100, y: 0 },
    { x: 100, y: 100 }, { x: 0, y: 100 },
  ]

  it('Punkt innerhalb → true', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true)
  })
  it('Punkt außerhalb → false', () => {
    expect(pointInPolygon({ x: 150, y: 50 }, square)).toBe(false)
  })
  it('Punkt auf Kante → konsistentes Ergebnis (kein Crash)', () => {
    // Ray-Casting kann auf Kante variieren — wichtig ist kein Crash
    expect(() => pointInPolygon({ x: 0, y: 50 }, square)).not.toThrow()
  })
  it('leeres Polygon → false', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, [])).toBe(false)
  })
})

describe('lassoHitsElement', () => {
  // Großes Quadrat 0,0 → 200,200
  const bigSquare = [
    { x: 0, y: 0 }, { x: 200, y: 0 },
    { x: 200, y: 200 }, { x: 0, y: 200 },
  ]

  it('Element vollständig innerhalb → true', () => {
    expect(lassoHitsElement(bigSquare, { x: 50, y: 50, w: 80, h: 80 })).toBe(true)
  })
  it('Element teilweise innerhalb (eine Ecke drin) → true', () => {
    // Element hat Ecke bei 190,190 — innerhalb des 200x200-Quadrats
    expect(lassoHitsElement(bigSquare, { x: 150, y: 150, w: 100, h: 100 })).toBe(true)
  })
  it('Element vollständig außerhalb → false', () => {
    expect(lassoHitsElement(bigSquare, { x: 300, y: 300, w: 80, h: 80 })).toBe(false)
  })
  it('Element umschließt Lasso (keine Ecke im Polygon) → false', () => {
    // Lasso klein, Element riesig drumherum — Ecken außerhalb
    const smallLasso = [
      { x: 40, y: 40 }, { x: 60, y: 40 },
      { x: 60, y: 60 }, { x: 40, y: 60 },
    ]
    expect(lassoHitsElement(smallLasso, { x: 0, y: 0, w: 200, h: 200 })).toBe(false)
  })
})
```

- [ ] **Schritt 2: Tests laufen lassen — müssen FEHLSCHLAGEN**

```bash
cd packages/frontend && npx vitest run src/utils/geometry.test.ts
```

Erwartet: `pointInPolygon is not a function` o.ä.

- [ ] **Schritt 3: Implementierung in geometry.ts**

`Point`-Interface und zwei Funktionen am Ende der Datei anhängen:

```typescript
export interface Point { x: number; y: number }

/**
 * Ray-Casting Algorithmus: prüft ob ein Punkt innerhalb eines Polygons liegt.
 * Gibt false zurück bei weniger als 3 Punkten.
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  const { x, y } = point
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Prüft ob ein Element vom Lasso-Polygon getroffen wird.
 * Hit wenn mindestens eine der 4 Bounding-Box-Ecken im Polygon liegt.
 */
export function lassoHitsElement(polygon: Point[], el: Rect): boolean {
  const corners: Point[] = [
    { x: el.x,          y: el.y          },
    { x: el.x + el.w,   y: el.y          },
    { x: el.x,          y: el.y + el.h   },
    { x: el.x + el.w,   y: el.y + el.h   },
  ]
  return corners.some((c) => pointInPolygon(c, polygon))
}
```

- [ ] **Schritt 4: Tests laufen lassen — müssen GRÜN sein**

```bash
cd packages/frontend && npx vitest run src/utils/geometry.test.ts
```

Erwartet: alle Tests grün (bisherige + neue).

- [ ] **Schritt 5: Commit**

```bash
git add packages/frontend/src/utils/geometry.ts packages/frontend/src/utils/geometry.test.ts
git commit -m "feat: pointInPolygon + lassoHitsElement in geometry.ts"
```

---

### Task 2: LassoSelect.tsx — SVG-Rendering

**Files:**
- Create: `packages/frontend/src/components/Canvas/LassoSelect.tsx`

- [ ] **Schritt 1: Datei erstellen**

```typescript
/**
 * LassoSelect.tsx
 *
 * Reine SVG-Darstellung des Freihand-Lasso im Edit-Mode.
 * Keine Pointer-Logik — bekommt Punkte als Prop von Canvas.tsx.
 */
import { Point } from '../../utils/geometry'

interface Props {
  points: Point[]
}

export function LassoSelect({ points }: Props) {
  if (points.length < 2) return null

  // M = moveTo erster Punkt, L = lineTo alle weiteren, Z = schließen
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ') + ' Z'

  return (
    <svg
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 500,
      }}
    >
      <path
        d={d}
        fill="rgba(74,158,255,0.06)"
        fillRule="evenodd"
        stroke="#4a9eff"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        strokeLinejoin="round"
      />
    </svg>
  )
}
```

- [ ] **Schritt 2: Commit**

```bash
git add packages/frontend/src/components/Canvas/LassoSelect.tsx
git commit -m "feat: LassoSelect SVG-Komponente"
```

---

### Task 3: Canvas.tsx — Lasso-Logik integrieren

**Files:**
- Modify: `packages/frontend/src/components/Canvas/Canvas.tsx`
- Delete: `packages/frontend/src/components/Canvas/RubberBand.tsx`

- [ ] **Schritt 1: RubberBand.tsx löschen**

```bash
rm packages/frontend/src/components/Canvas/RubberBand.tsx
```

- [ ] **Schritt 2: Imports in Canvas.tsx aktualisieren**

Alte Zeilen ersetzen:

```typescript
// ALT — entfernen:
import { RubberBand } from './RubberBand'

// NEU — hinzufügen (zu den bestehenden Imports):
import { LassoSelect } from './LassoSelect'
import { Point, lassoHitsElement } from '../../utils/geometry'
```

- [ ] **Schritt 3: State + Refs für Lasso in Canvas() hinzufügen**

Nach der Zeile `const [dragDelta, setDragDelta] = useState<...>(null)` einfügen:

```typescript
const [lassoPoints, setLassoPoints] = useState<Point[]>([])
const isLassoing = useRef(false)
const shiftLasso = useRef(false)
```

Außerdem `selectElements` aus dem Store holen — nach den bestehenden Store-Selektoren:

```typescript
const selectElements = useAppStore((s) => s.selectElements)
```

- [ ] **Schritt 4: `getCanvasPos` Helper in Canvas() hinzufügen**

Nach den Sensor-/SnapModifier-Definitionen einfügen:

```typescript
const getCanvasPos = useCallback((e: React.PointerEvent): Point => {
  const container = containerRef.current
  if (!container) return { x: 0, y: 0 }
  const bounds = container.getBoundingClientRect()
  return { x: e.clientX - bounds.left, y: e.clientY - bounds.top }
}, [])
```

- [ ] **Schritt 5: Lasso Pointer-Handler in Canvas() hinzufügen**

Nach `handleContextMenu` einfügen:

```typescript
const handleLassoPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
  if (mode !== 'edit') return
  if (e.target !== e.currentTarget) return  // nur auf leerem Canvas
  if (e.button !== 0) return
  e.currentTarget.setPointerCapture(e.pointerId)
  isLassoing.current = true
  shiftLasso.current = e.shiftKey
  setLassoPoints([getCanvasPos(e)])
}, [mode, getCanvasPos])

const handleLassoPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
  if (!isLassoing.current) return
  const pos = getCanvasPos(e)
  setLassoPoints((prev) => {
    if (prev.length === 0) return [pos]
    const last = prev[prev.length - 1]
    if (Math.hypot(pos.x - last.x, pos.y - last.y) < 4) return prev
    return [...prev, pos]
  })
}, [getCanvasPos])

const handleLassoPointerUp = useCallback((_e: React.PointerEvent<HTMLDivElement>) => {
  if (!isLassoing.current) return
  isLassoing.current = false
  setLassoPoints((points) => {
    if (points.length >= 3) {
      const currentPanel = useAppStore.getState().getActivePanel()
      if (currentPanel) {
        const hit = currentPanel.elements
          .filter((el) => lassoHitsElement(points, el))
          .map((el) => el.id)
        if (shiftLasso.current) {
          selectElements([...useAppStore.getState().selectedIds, ...hit])
        } else {
          selectElements(hit)
        }
      }
    }
    return []
  })
}, [selectElements])
```

- [ ] **Schritt 6: Canvas-Container-Div — Handler + LassoSelect einbauen**

Im JSX den `containerRef`-Div anpassen. Vorher:

```tsx
<div
  ref={containerRef}
  style={{ ... }}
  onClick={mode === 'edit' ? () => clearSelection() : undefined}
  onContextMenu={handleContextMenu}
>
```

Nachher:

```tsx
<div
  ref={containerRef}
  style={{ ... }}
  onClick={mode === 'edit' ? () => clearSelection() : undefined}
  onContextMenu={handleContextMenu}
  onPointerDown={handleLassoPointerDown}
  onPointerMove={handleLassoPointerMove}
  onPointerUp={handleLassoPointerUp}
>
```

- [ ] **Schritt 7: RubberBand durch LassoSelect ersetzen im JSX**

Alte Zeile ersetzen:

```tsx
// ALT:
{mode === 'edit' && panel && (
  <RubberBand elements={panel.elements} panelId={panel.id} containerRef={containerRef} />
)}

// NEU:
{mode === 'edit' && lassoPoints.length >= 2 && (
  <LassoSelect points={lassoPoints} />
)}
```

- [ ] **Schritt 8: TypeScript-Check**

```bash
cd packages/frontend && npx tsc --noEmit -p tsconfig.json
```

Erwartet: keine Fehler.

- [ ] **Schritt 9: Commit**

```bash
git add packages/frontend/src/components/Canvas/Canvas.tsx packages/frontend/src/components/Canvas/LassoSelect.tsx
git commit -m "feat: Lasso-Selektion in Canvas (ersetzt RubberBand)"
```

---

### Task 4: Vollständiger Build + manueller Test

- [ ] **Schritt 1: Alle Tests laufen lassen**

```bash
cd packages/frontend && npx vitest run
```

Erwartet: alle Tests grün.

- [ ] **Schritt 2: Electron Build**

```bash
cd ../.. && npm run build:electron
```

Erwartet: kein Fehler, "Electron build complete."

- [ ] **Schritt 3: Electron starten**

```bash
node scripts/launch-electron.mjs
```

- [ ] **Schritt 4: Manuell testen**

1. Edit-Mode aktivieren (`E`)
2. Auf leerem Canvas ziehen → Lasso-Pfad erscheint (blau gestrichelt)
3. Loslassen → Elemente innerhalb selektiert
4. Shift+Drag → zu bestehender Selektion hinzufügen
5. Klick auf leere Fläche ohne Drag → Selektion wird geleert

- [ ] **Schritt 5: CLAUDE.md aktualisieren**

In `CLAUDE.md` unter "Edit-Mode — offene Features" die Zeile entfernen:

```
- ⬜ Rubber-Band Selektion: Kreis-Geste um mehrere Elemente zu markieren
```

Und unter den getroffenen Entscheidungen ergänzen:

```
| Lasso-Selektion | Freihand-Polygon (LassoSelect.tsx), Ray-Casting Hit-Test, ersetzt RubberBand | Default: Ecken-Check (mindestens 1 Ecke im Polygon) |
```

- [ ] **Schritt 6: Final Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md — Lasso-Selektion abgehakt"
```

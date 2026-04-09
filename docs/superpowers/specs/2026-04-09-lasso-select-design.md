# Lasso Select — Design Spec

**Datum:** 2026-04-09  
**Status:** Approved  
**Ersetzt:** RubberBand (rechteckige Selektion) — wird gelöscht

---

## Ziel

Freihand-Lasso-Selektion im Edit-Mode als Ersatz für den bestehenden (defekten) Rubber-Band.  
Der User zieht eine freie Form um Elemente auf dem Canvas und selektiert damit alle Elemente, deren Bounding-Box-Ecken innerhalb des Lasso-Polygons liegen.

---

## Verhalten

### Aktivierung
- `pointerDown` auf leerem Canvas-Hintergrund (nicht auf einem Element)
- Shift+Drag: fügt zur bestehenden Selektion hinzu (identisch mit bisherigem Rubber-Band)
- Nur im Edit-Mode aktiv

### Zeichnen
- Beim Ziehen wird ein SVG-`<path>` gezeichnet (Freihand-Polygon)
- Der Pfad schliesst sich visuell immer von aktuellem Punkt zu Startpunkt (geschlossene Form)
- Minimum-Bewegung bevor ein Punkt hinzugefügt wird: 4px (verhindert Punkt-Spam bei langsamem Drag)

### Selektion bei PointerUp
- Polygon wird geschlossen
- Hit-Test: mindestens eine der 4 Ecken des Element-Bounding-Box liegt im Polygon → Element selektiert
- Shift: neue IDs werden zur bestehenden Selektion hinzugefügt
- Kein Shift: bestehende Selektion wird ersetzt
- Danach: Punkte-Array geleert, SVG verschwindet

---

## Hit-Test Algorithmus

```
lassoHitsElement(polygon: Point[], el: AnyElement): boolean
  corners = [
    {x: el.x,        y: el.y},
    {x: el.x + el.w, y: el.y},
    {x: el.x,        y: el.y + el.h},
    {x: el.x + el.w, y: el.y + el.h},
  ]
  return corners.some(corner => pointInPolygon(corner, polygon))
```

`pointInPolygon` via Ray-Casting (Standard-Algorithmus, O(n) pro Punkt).

---

## Visuals

| Eigenschaft | Wert |
|---|---|
| Stroke | `#4a9eff` 1.5px |
| Stroke-Dasharray | `4 3` |
| Fill | `rgba(74,158,255,0.06)` |
| Fill-Rule | `evenodd` |

Konsistent mit bestehendem Design-System (`accent.blue`).

---

## z-Index Lösung

**Problem des alten Rubber-Bands:** `zIndex: -1` wenn inaktiv → hinter Canvas-Hintergrund, empfängt keine Pointer-Events.

**Neue Lösung:** `LassoSelect` hat kein eigenes Overlay-Div.  
Stattdessen: `Canvas.tsx` lauscht `onPointerDown` direkt am Canvas-Container-Div und prüft `e.target === e.currentTarget` (= leere Canvas-Fläche). Lasso-State wird in Canvas.tsx gehalten und als Props an `LassoSelect` übergeben (nur für SVG-Rendering).

---

## Dateien

| Datei | Aktion |
|---|---|
| `packages/frontend/src/components/Canvas/LassoSelect.tsx` | Neu — SVG-Rendering des Lasso-Pfads |
| `packages/frontend/src/utils/geometry.ts` | Erweitern — `pointInPolygon()` + `lassoHitsElement()` |
| `packages/frontend/src/components/Canvas/Canvas.tsx` | Ändern — Pointer-Handler, Import tauschen |
| `packages/frontend/src/components/Canvas/RubberBand.tsx` | Löschen |

---

## Nicht in Scope

- Undo für Lasso-Selektion (Selektion ist nicht Undo-pflichtig)
- Lasso im View-Mode
- Touch-Geste (funktioniert automatisch da Pointer Events)

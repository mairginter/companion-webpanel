# Edit-Mode Grid Visual — Design Spec

**Date:** 2026-04-13  
**Scope:** Canvas.tsx only  
**Status:** Approved

---

## Problem

`DOT_GRID` ist ein statisches SVG mit hardcoded `40x40` und `opacity 0.06` — immer dezent, ignoriert `panel.grid.size`, bietet keine Ausrichtungshilfe im Edit-Mode.

## Solution

`makeGridBackground(gridSize: number, isEditMode: boolean): string`

- **View-Mode** → Dot-Grid (wie bisher), dynamische `gridSize`, Opacity `0.06`
- **Edit-Mode** → Linien-Grid, `stroke-width: 0.5`, `rgba(255,255,255,0.12)`, dynamische `gridSize`

SVG-Technik: linke + obere Kante zeichnen → beim Kacheln vollständiges Gitter.

## Changes

| File | Change |
|---|---|
| `packages/frontend/src/components/Canvas/Canvas.tsx` | `DOT_GRID` Konstante entfernen, `makeGridBackground()` Funktion hinzufügen, im `backgroundImageLayers`-Array aufrufen |

## No-changes

- Keine neuen Dateien
- Keine neuen Props / Store-Felder
- Keine Änderung an Snap-Logik
- Resize bleibt ohne Snap

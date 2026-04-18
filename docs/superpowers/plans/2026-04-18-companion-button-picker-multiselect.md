# Companion Button Picker — Multi-Select & Seite einfügen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Companion Button Picker with Ctrl+Click / Shift+Click multi-selection and a "Seite einfügen" button that adds all configured buttons from the current Companion page at once.

**Architecture:** Pure utility functions (range selection, compact layout, configured-button filter) are extracted to `pickerUtils.ts` and tested independently. The picker dialog replaces its single-selection state with a `Set<string>`-based multi-select. `AddElementMenu` calculates compact canvas positions and calls `addElement` per ref. `CompanionButtonProps` takes `refs[0]`.

**Tech Stack:** React (useState, useMemo), TypeScript, vitest (existing test runner)

---

## File Map

| Action | File | What changes |
|---|---|---|
| **Create** | `packages/frontend/src/utils/pickerUtils.ts` | `buildRangeSelection`, `compactLayout`, `isConfiguredButton` |
| **Create** | `packages/frontend/src/utils/pickerUtils.test.ts` | Unit tests for the 3 utilities |
| **Modify** | `packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx` | Multi-select state + UI + "Seite einfügen" button |
| **Modify** | `packages/frontend/src/components/AddElement/AddElementMenu.tsx` | `handlePickerConfirm(refs[])` + compact layout |
| **Modify** | `packages/frontend/src/components/PropertiesPanel/CompanionButtonProps.tsx` | `onConfirm` takes `refs[0]` |

---

## Task 1: Extract pure utility functions + write tests

**Files:**
- Create: `packages/frontend/src/utils/pickerUtils.ts`
- Create: `packages/frontend/src/utils/pickerUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/frontend/src/utils/pickerUtils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildRangeSelection, compactLayout, isConfiguredButton } from './pickerUtils'

describe('isConfiguredButton', () => {
  it('returns false for empty button', () => {
    expect(isConfiguredButton(undefined, undefined)).toBe(false)
  })
  it('returns false for black bg and no text', () => {
    expect(isConfiguredButton('#000000', '')).toBe(false)
  })
  it('returns true for non-black bg', () => {
    expect(isConfiguredButton('#ff0000', '')).toBe(true)
  })
  it('returns true for text only', () => {
    expect(isConfiguredButton(undefined, 'OBS')).toBe(true)
  })
  it('returns true for non-black bg with text', () => {
    expect(isConfiguredButton('#1a9fff', 'REC')).toBe(true)
  })
})

describe('buildRangeSelection', () => {
  it('selects single cell when from === to', () => {
    const result = buildRangeSelection({ row: 1, col: 2 }, { row: 1, col: 2 })
    expect(result).toEqual(new Set(['1:2']))
  })
  it('selects row range left-to-right', () => {
    const result = buildRangeSelection({ row: 0, col: 1 }, { row: 0, col: 3 })
    expect(result).toEqual(new Set(['0:1', '0:2', '0:3']))
  })
  it('selects row range right-to-left', () => {
    const result = buildRangeSelection({ row: 0, col: 3 }, { row: 0, col: 1 })
    expect(result).toEqual(new Set(['0:1', '0:2', '0:3']))
  })
  it('selects rectangular range across rows', () => {
    const result = buildRangeSelection({ row: 1, col: 1 }, { row: 2, col: 2 })
    expect(result).toEqual(new Set(['1:1', '1:2', '2:1', '2:2']))
  })
  it('works when from is bottom-right of to', () => {
    const result = buildRangeSelection({ row: 2, col: 3 }, { row: 1, col: 1 })
    expect(result).toEqual(new Set(['1:1', '1:2', '1:3', '2:1', '2:2', '2:3']))
  })
})

describe('compactLayout', () => {
  it('returns empty array for empty input', () => {
    expect(compactLayout([], { x: 0, y: 0 }, 120)).toEqual([])
  })
  it('places single button at canvasPos', () => {
    const result = compactLayout([{ row: 2, col: 3 }], { x: 100, y: 200 }, 120)
    expect(result).toEqual([{ x: 100, y: 200 }])
  })
  it('places two same-row buttons side by side, no gap', () => {
    const result = compactLayout(
      [{ row: 2, col: 1 }, { row: 2, col: 4 }],
      { x: 0, y: 0 },
      120,
    )
    expect(result).toEqual([{ x: 0, y: 0 }, { x: 120, y: 0 }])
  })
  it('places buttons from different rows on new canvas rows', () => {
    const result = compactLayout(
      [{ row: 2, col: 1 }, { row: 2, col: 4 }, { row: 3, col: 2 }],
      { x: 50, y: 50 },
      120,
    )
    expect(result).toEqual([
      { x: 50, y: 50 },
      { x: 170, y: 50 },
      { x: 50, y: 170 },
    ])
  })
  it('sorts input by row then col before laying out', () => {
    // unsorted input — same result as sorted
    const result = compactLayout(
      [{ row: 3, col: 2 }, { row: 2, col: 4 }, { row: 2, col: 1 }],
      { x: 0, y: 0 },
      120,
    )
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 0, y: 120 },
    ])
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd "c:/Users/mairg/OneDrive - Alex Mairginter/Documents/AppProjekts/Bitfocus_Companion/CompanionWebpannel"
npx vitest run packages/frontend/src/utils/pickerUtils.test.ts
```

Expected: FAIL with "Cannot find module './pickerUtils'"

- [ ] **Step 3: Implement `pickerUtils.ts`**

Create `packages/frontend/src/utils/pickerUtils.ts`:

```ts
import type { CompanionRef } from '@cwp/shared'

/**
 * Returns true if the button has visible content (non-black bg or non-empty text).
 */
export function isConfiguredButton(bgColor: string | undefined, text: string | undefined): boolean {
  const hasBg = bgColor !== undefined && bgColor !== '#000000'
  const hasText = text !== undefined && text !== ''
  return hasBg || hasText
}

/**
 * Builds a Set of "row:col" keys for all cells in the rectangle
 * defined by two corner cells (order-independent).
 */
export function buildRangeSelection(
  from: { row: number; col: number },
  to: { row: number; col: number },
): Set<string> {
  const minRow = Math.min(from.row, to.row)
  const maxRow = Math.max(from.row, to.row)
  const minCol = Math.min(from.col, to.col)
  const maxCol = Math.max(from.col, to.col)
  const result = new Set<string>()
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      result.add(`${r}:${c}`)
    }
  }
  return result
}

/**
 * Converts an array of Companion grid positions into compact canvas positions.
 * Input is sorted by row then col; buttons are placed row by row without gaps.
 * Returns one {x, y} per input cell (same index order after sorting).
 */
export function compactLayout(
  cells: { row: number; col: number }[],
  canvasPos: { x: number; y: number },
  buttonSize: number,
): { x: number; y: number }[] {
  if (cells.length === 0) return []

  const sorted = [...cells].sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col)

  // Group by companion row → each group = one canvas row
  const groups: { row: number; col: number }[][] = []
  let lastRow = -1
  for (const cell of sorted) {
    if (cell.row !== lastRow) {
      groups.push([])
      lastRow = cell.row
    }
    groups[groups.length - 1].push(cell)
  }

  // Build a lookup from "row:col" → canvas {x, y}
  const posMap = new Map<string, { x: number; y: number }>()
  groups.forEach((group, rowIndex) => {
    group.forEach((cell, colIndex) => {
      posMap.set(`${cell.row}:${cell.col}`, {
        x: canvasPos.x + colIndex * buttonSize,
        y: canvasPos.y + rowIndex * buttonSize,
      })
    })
  })

  // Return in same order as sorted input
  return sorted.map((cell) => posMap.get(`${cell.row}:${cell.col}`)!)
}

/**
 * Parses a "row:col" key back into {row, col} numbers.
 */
export function parseCellKey(key: string): { row: number; col: number } {
  const [r, c] = key.split(':').map(Number)
  return { row: r, col: c }
}

/**
 * Builds a sorted CompanionRef array from a Set of "row:col" keys.
 */
export function selectedCellsToRefs(
  selectedCells: Set<string>,
  hostId: string,
  page: number,
): CompanionRef[] {
  return [...selectedCells]
    .map(parseCellKey)
    .sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col)
    .map(({ row, col }) => ({ hostId, page, row, col }))
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run packages/frontend/src/utils/pickerUtils.test.ts
```

Expected: all 14 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/utils/pickerUtils.ts packages/frontend/src/utils/pickerUtils.test.ts
git commit -m "feat(picker): pickerUtils — buildRangeSelection, compactLayout, isConfiguredButton"
```

---

## Task 2: Update `CompanionButtonPickerDialog` — multi-select state & click handling

**Files:**
- Modify: `packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx`

- [ ] **Step 1: Update Props interface and imports**

At the top of `CompanionButtonPickerDialog.tsx`, replace:

```ts
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { pageKey } from '@cwp/shared'
import { NumericInput } from '../PropertiesPanel/NumericInput'
```

with:

```ts
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { pageKey } from '@cwp/shared'
import type { CompanionRef } from '@cwp/shared'
import { NumericInput } from '../PropertiesPanel/NumericInput'
import { buildRangeSelection, isConfiguredButton, selectedCellsToRefs } from '../../utils/pickerUtils'
```

Replace the `onConfirm` type in Props interface:

```ts
interface Props {
  onConfirm: (refs: CompanionRef[]) => void
  onClose: () => void
  confirmLabel?: string
  initialRef?: { hostId?: string; page?: number }
  alignSide?: 'left' | 'right'
  panelWidth?: number
  initialGridCols?: number
  initialGridRows?: number
}
```

- [ ] **Step 2: Replace selection state**

In `CompanionButtonPickerDialog` component body, replace lines 96–97:

```ts
const [selectedRow, setSelectedRow] = useState<number | null>(null)
const [selectedCol, setSelectedCol] = useState<number | null>(null)
```

with:

```ts
const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
const lastClickedCell = useRef<{ row: number; col: number } | null>(null)
```

- [ ] **Step 3: Clear selection on host/page/grid changes**

Replace the existing `handleHostChange` function:

```ts
const handleHostChange = (id: string) => {
  setHostId(id)
  setSelectedCells(new Set())
  lastClickedCell.current = null
  const host = settings?.hosts.find((h) => h.id === id)
  if (host?.gridCols !== undefined) setKeysPerRow(host.gridCols)
  if (host?.gridRows !== undefined) setRows(host.gridRows)
}
```

In the PageNum `NumericInput` onChange, replace:
```ts
onChange={(v) => { setPageNum(v); setSelectedRow(null); setSelectedCol(null) }}
```
with:
```ts
onChange={(v) => { setPageNum(v); setSelectedCells(new Set()); lastClickedCell.current = null }}
```

In the Spalten `NumericInput` onChange, replace:
```ts
onChange={(v) => { setKeysPerRow(v); setSelectedRow(null); setSelectedCol(null) }}
```
with:
```ts
onChange={(v) => { setKeysPerRow(v); setSelectedCells(new Set()); lastClickedCell.current = null }}
```

In the Zeilen `NumericInput` onChange, replace:
```ts
onChange={(v) => { setRows(v); setSelectedRow(null); setSelectedCol(null) }}
```
with:
```ts
onChange={(v) => { setRows(v); setSelectedCells(new Set()); lastClickedCell.current = null }}
```

- [ ] **Step 4: Add cell click handler with Ctrl/Shift logic**

Add this function after `handleHostChange`:

```ts
const handleCellClick = useCallback((row: number, col: number, e: React.MouseEvent) => {
  const key = `${row}:${col}`

  if (e.shiftKey && lastClickedCell.current) {
    // Rectangular range — add to existing selection, don't update lastClickedCell
    const range = buildRangeSelection(lastClickedCell.current, { row, col })
    setSelectedCells((prev) => {
      const next = new Set(prev)
      range.forEach((k) => next.add(k))
      return next
    })
    return
  }

  if (e.ctrlKey || e.metaKey) {
    // Toggle individual cell
    setSelectedCells((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    lastClickedCell.current = { row, col }
    return
  }

  // Plain click — select only this cell
  setSelectedCells(new Set([key]))
  lastClickedCell.current = { row, col }
}, [])
```

- [ ] **Step 5: Update `handleConfirm`**

Replace the existing `handleConfirm`:

```ts
const handleConfirm = () => {
  if (selectedCells.size === 0) return
  onConfirm(selectedCellsToRefs(selectedCells, hostId, pageNum))
}
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors in `CompanionButtonPickerDialog.tsx`

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx
git commit -m "feat(picker): multi-select state — Ctrl+Click toggle, Shift+Click range"
```

---

## Task 3: Update picker grid UI — multi-select visuals & status text

**Files:**
- Modify: `packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx`

- [ ] **Step 1: Update grid cell rendering**

In the `gridCells.map(...)` block, replace the entire `<div key={...}>` cell element:

```tsx
{gridCells.map(({ row, col, bgColor, text }) => {
  const key = `${row}:${col}`
  const isSelected = selectedCells.has(key)
  return (
    <div
      key={key}
      onClick={(e) => handleCellClick(row, col, e)}
      title={`Zeile ${row + 1}, Spalte ${col + 1}`}
      style={{
        width: cellSize, height: cellSize,
        background: bgColor ?? '#1a2030',
        border: isSelected ? '2px solid #4a9eff' : '1px solid #2a3344',
        borderRadius: 4,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, color: '#e9edf2',
        overflow: 'hidden',
        boxSizing: 'border-box',
        transition: 'border-color 0.1s',
      }}
    >
      {text && (
        <span style={{ fontSize: 8, lineHeight: 1.1, textAlign: 'center', padding: '0 2px', overflow: 'hidden' }}>
          {text.split('\n')[0]}
        </span>
      )}
    </div>
  )
})}
```

- [ ] **Step 2: Update status text below grid**

Replace the block that showed `"Zeile X, Spalte Y"`:

```tsx
{selectedCells.size > 0 && (
  <div style={{ fontSize: 11, color: '#8896aa', marginTop: 6 }}>
    {selectedCells.size === 1
      ? (() => {
          const [r, c] = [...selectedCells][0].split(':').map(Number)
          return `Zeile ${r + 1}, Spalte ${c + 1}`
        })()
      : `${selectedCells.size} Buttons ausgewählt`}
  </div>
)}
```

- [ ] **Step 3: Update "Hinzufügen" disabled logic**

In the "Hinzufügen" button, replace the two occurrences of `selectedRow !== null && selectedCol !== null` with `selectedCells.size > 0`:

```tsx
<button
  onClick={handleConfirm}
  disabled={selectedCells.size === 0}
  style={{
    padding: '7px 16px', borderRadius: 6, border: '1px solid #4a9eff',
    background: selectedCells.size > 0 ? 'rgba(74,158,255,0.15)' : '#1a2030',
    color: selectedCells.size > 0 ? '#4a9eff' : '#4a5568',
    fontSize: 13, cursor: selectedCells.size > 0 ? 'pointer' : 'not-allowed',
    fontWeight: 600,
  }}
>
  {confirmLabel}
</button>
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx
git commit -m "feat(picker): multi-select UI — blue border per cell, selection count status"
```

---

## Task 4: Add "Seite einfügen" button to picker dialog

**Files:**
- Modify: `packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx`

- [ ] **Step 1: Compute configured cells for current page**

Add this `useMemo` after the existing `gridCells` memo:

```ts
const configuredCells = useMemo(() => {
  return gridCells.filter(({ bgColor, text }) => isConfiguredButton(bgColor, text))
}, [gridCells])
```

- [ ] **Step 2: Add handler for page insert**

Add after `handleConfirm`:

```ts
const handleInsertPage = () => {
  if (configuredCells.length === 0) return
  const refs: CompanionRef[] = configuredCells
    .sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col)
    .map(({ row, col }) => ({ hostId, page: pageNum, row, col }))
  onConfirm(refs)
}
```

- [ ] **Step 3: Add the button in the dialog footer**

In the button row (the `<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>` block), add the new button between "Abbrechen" and "Hinzufügen":

```tsx
<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
  <button
    onClick={onClose}
    style={{
      padding: '7px 16px', borderRadius: 6, border: '1px solid #2a3344',
      background: '#121821', color: '#8896aa', fontSize: 13, cursor: 'pointer',
    }}
  >
    Abbrechen
  </button>
  <button
    onClick={handleInsertPage}
    disabled={configuredCells.length === 0}
    title={configuredCells.length === 0 ? 'Keine konfigurierten Buttons auf dieser Seite' : undefined}
    style={{
      padding: '7px 16px', borderRadius: 6, border: '1px solid #2a3344',
      background: configuredCells.length > 0 ? 'rgba(74,158,255,0.08)' : '#1a2030',
      color: configuredCells.length > 0 ? '#8896aa' : '#4a5568',
      fontSize: 13, cursor: configuredCells.length > 0 ? 'pointer' : 'not-allowed',
    }}
  >
    Seite einfügen
  </button>
  <button
    onClick={handleConfirm}
    disabled={selectedCells.size === 0}
    style={{
      padding: '7px 16px', borderRadius: 6, border: '1px solid #4a9eff',
      background: selectedCells.size > 0 ? 'rgba(74,158,255,0.15)' : '#1a2030',
      color: selectedCells.size > 0 ? '#4a9eff' : '#4a5568',
      fontSize: 13, cursor: selectedCells.size > 0 ? 'pointer' : 'not-allowed',
      fontWeight: 600,
    }}
  >
    {confirmLabel}
  </button>
</div>
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx
git commit -m "feat(picker): Seite einfügen — alle konfigurierten Buttons der aktuellen Page hinzufügen"
```

---

## Task 5: Update `AddElementMenu` — compact layout for multiple refs

**Files:**
- Modify: `packages/frontend/src/components/AddElement/AddElementMenu.tsx`

- [ ] **Step 1: Update imports**

Add `compactLayout` import at the top of `AddElementMenu.tsx`:

```ts
import type { AnyElement, CompanionRef } from '@cwp/shared'
import { compactLayout } from '../../utils/pickerUtils'
```

(Replace the existing `import type { AnyElement } from '@cwp/shared'`.)

- [ ] **Step 2: Update `handlePickerConfirm`**

Replace the existing `handlePickerConfirm`:

```ts
const handlePickerConfirm = (refs: CompanionRef[]) => {
  const positions = compactLayout(
    refs.map((r) => ({ row: r.row, col: r.col })),
    canvasPos,
    120,
  )
  refs.forEach((ref, i) => {
    const pos = positions[i] ?? canvasPos
    addElement(panelId, makeDefault('companionButton', pos, ref))
  })
  onClose()
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/AddElement/AddElementMenu.tsx
git commit -m "feat(picker): AddElementMenu — compact canvas layout for multi-button confirm"
```

---

## Task 6: Update `CompanionButtonProps` — adapt to new `onConfirm` signature

**Files:**
- Modify: `packages/frontend/src/components/PropertiesPanel/CompanionButtonProps.tsx`

- [ ] **Step 1: Update the `onConfirm` callback**

In `CompanionButtonProps.tsx`, find the `CompanionButtonPickerDialog` usage (around line 118) and update its `onConfirm` prop:

Replace:
```tsx
onConfirm={(ref) => { updateRef(ref); setPickerOpen(false) }}
```

with:
```tsx
onConfirm={(refs) => { updateRef(refs[0]); setPickerOpen(false) }}
```

- [ ] **Step 2: TypeScript check — full project**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: zero errors across all frontend files

- [ ] **Step 3: Run all tests**

```bash
npx vitest run packages/frontend/src/utils/pickerUtils.test.ts packages/frontend/src/utils/geometry.test.ts packages/frontend/src/utils/channelStrip.test.ts packages/frontend/src/store/useAppStore.test.ts
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/PropertiesPanel/CompanionButtonProps.tsx
git commit -m "fix(picker): CompanionButtonProps — adapt onConfirm to CompanionRef[] signature"
```

---

## Task 7: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
cd "c:/Users/mairg/OneDrive - Alex Mairginter/Documents/AppProjekts/Bitfocus_Companion/CompanionWebpannel"
npm run dev
```

Open `http://localhost:5173` in a browser.

- [ ] **Step 2: Test single-select (regression check)**
  - Edit-Mode aktivieren → Canvas-Rechtsklick → "Companion Button"
  - Einen Button anklicken → blauer Rahmen erscheint → "Hinzufügen" → Button landet auf Canvas. ✓

- [ ] **Step 3: Test Ctrl+Click multi-select**
  - Picker öffnen → ersten Button klicken → Ctrl+zweiten klicken
  - Beide haben blauen Rahmen, Status zeigt "2 Buttons ausgewählt"
  - "Hinzufügen" → beide Buttons erscheinen nebeneinander auf Canvas (kein Gap). ✓

- [ ] **Step 4: Test Shift+Click range**
  - Picker öffnen → Button (Row 1, Col 1) klicken → Shift+Klick auf (Row 2, Col 3)
  - 2×3 Rechteck markiert (6 Buttons), Status zeigt "6 Buttons ausgewählt"
  - "Hinzufügen" → 6 Buttons kompakt auf Canvas, 2 Zeilen à 3. ✓

- [ ] **Step 5: Test "Seite einfügen"**
  - Picker öffnen → Page mit mehreren konfigurierten Buttons wählen
  - "Seite einfügen" ist aktiv → klicken → alle konfigurierten Buttons landen kompakt auf Canvas. ✓
  - Page ohne konfigurierte Buttons wählen → "Seite einfügen" disabled. ✓

- [ ] **Step 6: Test CompanionButtonProps ref-change (regression)**
  - Bestehenden CompanionButton selektieren → PropertiesPanel → "Ändern…"
  - Einen Button wählen → "Übernehmen" → Ref des Elements ändert sich korrekt. ✓

- [ ] **Step 7: Final commit if any fixups needed, then tag**

```bash
git add -A
git commit -m "chore: v1.2.2 — Companion Picker Multi-Select + Seite einfügen"
```

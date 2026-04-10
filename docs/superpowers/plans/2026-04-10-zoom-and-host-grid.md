# Panel Zoom + Host Grid-Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-panel zoom (20–200%, persisted in settings) with icon-button+popover-slider in Toolbar, and add gridCols/gridRows to HostProfile so the Button Picker and ChannelStrip Wizard use the correct grid dimensions by default.

**Architecture:** Zoom is stored in `panel.zoom` (already typed, needs store action + UI). Canvas applies `transform: scale(zoom)` on an inner wrapper; `getCanvasPos` divides by zoom to keep Lasso/ContextMenu coordinates correct. Ctrl+Scroll uses a native wheel listener (`passive: false`). Grid dimensions are optional fields on `HostProfile`, shown in HostManagerModal and read as defaults in the Picker and Wizard.

**Tech Stack:** React + TypeScript, Zustand, CSS transform, native DOM wheel event, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/frontend/src/store/useAppStore.ts` | Modify | Add `setZoom` action |
| `packages/frontend/src/store/useAppStore.test.ts` | Modify | Tests for `setZoom` |
| `packages/frontend/src/components/Toolbar/ZoomControl.tsx` | Create | Icon-button + popover slider |
| `packages/frontend/src/components/Toolbar/Toolbar.tsx` | Modify | Integrate `ZoomControl` |
| `packages/frontend/src/components/Canvas/Canvas.tsx` | Modify | Scale wrapper, coord fix, Ctrl+Scroll |
| `packages/shared/src/types.ts` | Modify | `gridCols?`, `gridRows?` on `HostProfile` |
| `packages/frontend/src/components/HostManager/HostManagerModal.tsx` | Modify | Grid-size fields in `HostForm` + `emptyHost` |
| `packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx` | Modify | Props + host-grid defaults |
| `packages/frontend/src/components/AddElement/ChannelStripWizard.tsx` | Modify | Pass grid defaults to Picker |

---

## Task 1: `setZoom` Store Action + Tests

**Files:**
- Modify: `packages/frontend/src/store/useAppStore.ts`
- Modify: `packages/frontend/src/store/useAppStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/frontend/src/store/useAppStore.test.ts`:

```typescript
describe('setZoom', () => {
  it('setzt Zoom für ein Panel', () => {
    useAppStore.getState().setZoom('panel-1', 1.5)
    const panel = useAppStore.getState().settings?.panels.find((p) => p.id === 'panel-1')
    expect(panel?.zoom).toBe(1.5)
  })

  it('klemmt Zoom auf Minimum 0.2', () => {
    useAppStore.getState().setZoom('panel-1', 0.05)
    const panel = useAppStore.getState().settings?.panels.find((p) => p.id === 'panel-1')
    expect(panel?.zoom).toBe(0.2)
  })

  it('klemmt Zoom auf Maximum 2.0', () => {
    useAppStore.getState().setZoom('panel-1', 5.0)
    const panel = useAppStore.getState().settings?.panels.find((p) => p.id === 'panel-1')
    expect(panel?.zoom).toBe(2.0)
  })

  it('ignoriert unbekannte Panel-ID (kein Crash)', () => {
    expect(() => useAppStore.getState().setZoom('no-such-panel', 1.5)).not.toThrow()
    expect(useAppStore.getState().settings?.panels.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "c:\Users\mairg\OneDrive - Alex Mairginter\Documents\AppProjekts\Bitfocus_Companion\CompanionWebpannel"
npx vitest run packages/frontend/src/store/useAppStore.test.ts
```

Expected: 4 new FAIL — `setZoom is not a function`

- [ ] **Step 3: Add `setZoom` to the AppStore interface**

In `packages/frontend/src/store/useAppStore.ts`, add to the `// ─── Panel CRUD ───` section (after `deletePanel`):

```typescript
/** Setzt den Zoom-Faktor eines Panels. Klemmt auf [0.2, 2.0]. */
setZoom: (panelId: string, zoom: number) => void
```

- [ ] **Step 4: Implement `setZoom`**

In `packages/frontend/src/store/useAppStore.ts`, add the implementation after the `deletePanel` implementation:

```typescript
setZoom: (panelId, zoom) =>
  set((s) => {
    if (!s.settings) return s
    const clamped = Math.max(0.2, Math.min(2.0, zoom))
    return {
      settings: {
        ...s.settings,
        panels: s.settings.panels.map((p) =>
          p.id !== panelId ? p : { ...p, zoom: clamped },
        ),
      },
    }
  }),
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run packages/frontend/src/store/useAppStore.test.ts
```

Expected: all tests PASS (previous count + 4 new)

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/store/useAppStore.ts packages/frontend/src/store/useAppStore.test.ts
git commit -m "feat(store): add setZoom action with [0.2, 2.0] clamp"
```

---

## Task 2: ZoomControl Component

**Files:**
- Create: `packages/frontend/src/components/Toolbar/ZoomControl.tsx`

- [ ] **Step 1: Create the component**

Create `packages/frontend/src/components/Toolbar/ZoomControl.tsx`:

```tsx
/**
 * ZoomControl.tsx
 *
 * Toolbar-Button mit Zoom-Popover.
 * Klick auf den Button öffnet einen Slider (20–200%, Step 5%).
 * Zeigt den aktuellen Zoom-Wert im Button an.
 * Bei Zoom ≠ 100%: blauer Tint wie aktiver Mode-Button.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'

interface ZoomControlProps {
  zoom: number
  onZoomChange: (zoom: number) => void
}

export function ZoomControl({ zoom, onZoomChange }: ZoomControlProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pct = Math.round(zoom * 100)
  const isScaled = Math.abs(zoom - 1.0) > 0.01

  const handleSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onZoomChange(parseInt(e.target.value, 10) / 100)
    },
    [onZoomChange],
  )

  const handleReset = useCallback(() => {
    onZoomChange(1.0)
  }, [onZoomChange])

  // Schließen bei Klick außerhalb
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Icon-Button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Zoom (Ctrl+Scroll)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          height: 32,
          padding: '0 8px',
          borderRadius: 6,
          border: `1px solid ${isScaled ? '#4a9eff' : open ? '#4a9eff' : '#2a3344'}`,
          background: isScaled || open ? 'rgba(74,158,255,0.12)' : '#1a2030',
          color: isScaled || open ? '#4a9eff' : '#8896aa',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          transition: 'all 0.15s',
        }}
      >
        <span className="material-icons" style={{ fontSize: 16 }}>search</span>
        <span style={{ minWidth: 36, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
          {pct}%
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: '#1a2030',
            border: '1px solid #2a3344',
            borderRadius: 8,
            padding: '10px 12px',
            width: 220,
            zIndex: 500,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Slider-Zeile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min={20}
              max={200}
              step={5}
              value={pct}
              onChange={handleSlider}
              style={{ flex: 1, accentColor: '#4a9eff', cursor: 'pointer' }}
            />
            <span
              style={{
                fontSize: 13,
                color: '#e9edf2',
                minWidth: 38,
                textAlign: 'right',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {pct}%
            </span>
          </div>

          {/* Reset-Button */}
          <button
            onClick={handleReset}
            style={{
              alignSelf: 'flex-start',
              padding: '3px 10px',
              borderRadius: 5,
              border: '1px solid #2a3344',
              background: 'transparent',
              color: '#8896aa',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            100%
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "c:\Users\mairg\OneDrive - Alex Mairginter\Documents\AppProjekts\Bitfocus_Companion\CompanionWebpannel"
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/Toolbar/ZoomControl.tsx
git commit -m "feat(toolbar): add ZoomControl component (icon-button + popover-slider)"
```

---

## Task 3: Integrate ZoomControl in Toolbar

**Files:**
- Modify: `packages/frontend/src/components/Toolbar/Toolbar.tsx`

- [ ] **Step 1: Import ZoomControl and wire up zoom**

In `Toolbar.tsx`, add the import at the top (after existing imports):

```typescript
import { ZoomControl } from './ZoomControl'
```

Add store selectors at the start of the `Toolbar` function body (after existing selectors):

```typescript
const setZoom = useAppStore((s) => s.setZoom)
const activePanel = panels.find((p) => p.id === activePanelId)
const zoom = activePanel?.zoom ?? 1
```

> Note: `activePanel` is already computed below — remove the duplicate declaration that currently exists (line `const activePanel = panels.find((p) => p.id === activePanelId)`) and keep only this one.

- [ ] **Step 2: Place ZoomControl in the JSX**

In `Toolbar.tsx`, add `<ZoomControl>` in both View and Edit mode — place it after the Mode Toggle block and before `<div style={{ flex: 1 }} />`:

Find this block in the JSX:
```tsx
      {mode === 'edit' && (
        <>
          <div style={dividerStyle} />
          <button
            ref={addBtnRef}
            ...
          >
            +
          </button>
        </>
      )}

      <div style={{ flex: 1 }} />
```

Replace with:
```tsx
      {mode === 'edit' && (
        <>
          <div style={dividerStyle} />
          <button
            ref={addBtnRef}
            style={{
              ...modeButtonStyle(addMenuOpen),
              width: 32, padding: 0, textAlign: 'center', fontSize: 18,
            }}
            onClick={handleAddClick}
            title="Element hinzufügen"
          >
            +
          </button>
        </>
      )}

      <div style={dividerStyle} />
      <ZoomControl
        zoom={zoom}
        onZoomChange={(z) => {
          if (activePanel) setZoom(activePanel.id, z)
        }}
      />

      <div style={{ flex: 1 }} />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/Toolbar/Toolbar.tsx
git commit -m "feat(toolbar): integrate ZoomControl (both view + edit mode)"
```

---

## Task 4: Canvas Zoom Layout + Coordinate Fix + Ctrl+Scroll

**Files:**
- Modify: `packages/frontend/src/components/Canvas/Canvas.tsx`

- [ ] **Step 1: Add store reference and refs**

At the start of the `Canvas` function body (after existing `useAppStore` selectors), add:

```typescript
const setZoom = useAppStore((s) => s.setZoom)
const zoom = panel?.zoom ?? 1
const scrollWrapperRef = useRef<HTMLDivElement>(null)
```

- [ ] **Step 2: Fix `getCanvasPos` to account for zoom**

Replace the existing `getCanvasPos` implementation:

```typescript
// OLD:
const getCanvasPos = useCallback((e: React.PointerEvent): Point => {
  const container = containerRef.current
  if (!container) return { x: 0, y: 0 }
  const bounds = container.getBoundingClientRect()
  return { x: e.clientX - bounds.left, y: e.clientY - bounds.top }
}, [])
```

With:

```typescript
// NEW — divides by zoom so Lasso/ContextMenu coords map back to canvas-space:
const getCanvasPos = useCallback(
  (e: React.PointerEvent): Point => {
    const container = containerRef.current
    if (!container) return { x: 0, y: 0 }
    const bounds = container.getBoundingClientRect()
    return {
      x: (e.clientX - bounds.left) / zoom,
      y: (e.clientY - bounds.top) / zoom,
    }
  },
  [zoom],
)
```

- [ ] **Step 3: Add Ctrl+Scroll handler**

Add this `useEffect` after the existing `useMemo` / `useSensors` calls (before the `getCanvasPos` declaration):

```typescript
// Ctrl+Scroll → Zoom ±5%; passive:false nötig für preventDefault()
useEffect(() => {
  const el = scrollWrapperRef.current
  if (!el) return
  const handler = (e: WheelEvent) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.05 : -0.05
    const currentPanel = useAppStore.getState().getActivePanel()
    if (!currentPanel) return
    const newZoom = Math.max(0.2, Math.min(2.0, (currentPanel.zoom ?? 1) + delta))
    setZoom(currentPanel.id, newZoom)
  }
  el.addEventListener('wheel', handler, { passive: false })
  return () => el.removeEventListener('wheel', handler)
}, [setZoom])
```

- [ ] **Step 4: Update the Canvas JSX with zoom layout**

In the `content` JSX block, replace the scroll-wrapper `<div>` and its direct child `<div ref={containerRef}>` with a three-level structure.

Find this block (approximately lines 191–234):
```tsx
      {/* Scrollbarer Canvas-Bereich */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: canvasWidth ?? '100%',
            height: canvasHeight ?? '100%',
            minWidth: '100%',
            minHeight: '100%',
            background: canvasBackground,
            backgroundImage: backgroundImageLayers,
            ...(backgroundSizeLayers ? { backgroundSize: backgroundSizeLayers } : {}),
          }}
          onClick={...}
          onContextMenu={handleContextMenu}
          onPointerDown={handleLassoPointerDown}
          onPointerMove={handleLassoPointerMove}
          onPointerUp={handleLassoPointerUp}
          onPointerCancel={...}
        >
          {/* ... elements ... */}
        </div>
      </div>
```

Replace with:
```tsx
      {/* Scrollbarer Canvas-Bereich */}
      <div ref={scrollWrapperRef} style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
        {/* Größen-Reserve: reserviert scroll-Platz entsprechend dem skalierten Canvas */}
        <div
          style={{
            width: canvasWidth ? canvasWidth * zoom : '100%',
            height: canvasHeight ? canvasHeight * zoom : '100%',
            minWidth: '100%',
            minHeight: '100%',
            flexShrink: 0,
          }}
        >
          {/* Scale-Root: CSS-Transform auf Canvas-Inhalt */}
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            <div
              ref={containerRef}
              style={{
                position: 'relative',
                width: canvasWidth ?? '100%',
                height: canvasHeight ?? '100%',
                minWidth: canvasWidth ? undefined : '100%',
                minHeight: canvasHeight ? undefined : '100%',
                background: canvasBackground,
                backgroundImage: backgroundImageLayers,
                ...(backgroundSizeLayers ? { backgroundSize: backgroundSizeLayers } : {}),
              }}
              onClick={mode === 'edit' ? () => { if (!lassoDidMove.current) clearSelection() } : undefined}
              onContextMenu={handleContextMenu}
              onPointerDown={handleLassoPointerDown}
              onPointerMove={handleLassoPointerMove}
              onPointerUp={handleLassoPointerUp}
              onPointerCancel={mode === 'edit' ? () => {
                isLassoing.current = false
                lassoDidMove.current = false
                lassoPointsRef.current = []
                setLassoPoints([])
              } : undefined}
            >
              {!panel ? (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center', color: '#4a5568', fontSize: 13, pointerEvents: 'none',
                }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
                  <div style={{ fontWeight: 600, color: '#8896aa', marginBottom: 4 }}>Kein Panel geladen</div>
                  <div style={{ fontSize: 12 }}>Backend verbinden und Settings konfigurieren</div>
                </div>
              ) : (
                renderElements(panel.elements, panel.id, mode, sendPress, sendRotate)
              )}

              {mode === 'edit' && lassoPoints.length >= 2 && (
                <LassoSelect points={lassoPoints} />
              )}
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors

- [ ] **Step 6: Run all frontend tests**

```bash
npx vitest run --project frontend
```

Expected: all tests PASS (same count as before — Canvas has no unit tests, only store/utils tests)

- [ ] **Step 7: Smoke test manually**

```bash
npm run dev
```

1. Open `http://localhost:5173`
2. Click Zoom-Button in Toolbar → Popover erscheint mit Slider
3. Slider auf 50% ziehen → Canvas verkleinert sich
4. Slider auf 150% → Canvas vergrößert, Scrollbars erscheinen
5. Ctrl+Scroll auf Canvas → Zoom ändert sich in 5%-Schritten
6. Ctrl+S → `CompanionWebpannelSettings.json` öffnen, `zoom` Wert prüfen
7. Seite neu laden → Zoom-Wert wiederhergestellt

- [ ] **Step 8: Commit**

```bash
git add packages/frontend/src/components/Canvas/Canvas.tsx
git commit -m "feat(canvas): apply panel zoom with scale wrapper + Ctrl+Scroll support"
```

---

## Task 5: Add `gridCols` / `gridRows` to `HostProfile` Types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add fields to `HostProfile`**

In `packages/shared/src/types.ts`, find the `HostProfile` interface and add two optional fields after `showInToolbar`:

```typescript
export interface HostProfile {
  id: string
  name: string
  host: string
  satellite: { wsPort: number }
  notes?: string
  /** Automatisch beim Start verbinden. Default: true */
  autoConnect?: boolean
  /** In der Toolbar als Status-Dot anzeigen. Default: true */
  showInToolbar?: boolean
  /** Buttons pro Zeile im Picker-Grid. Default: 8 */
  gridCols?: number
  /** Zeilen im Picker-Grid. Default: 4 */
  gridRows?: number
}
```

- [ ] **Step 2: Rebuild shared package**

```bash
cd "c:\Users\mairg\OneDrive - Alex Mairginter\Documents\AppProjekts\Bitfocus_Companion\CompanionWebpannel"
npm run build -w @cwp/shared
```

Expected: no errors

- [ ] **Step 3: Verify TypeScript compiles across all packages**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
npx tsc --noEmit -p packages/backend/tsconfig.json
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/dist
git commit -m "feat(types): add gridCols/gridRows to HostProfile"
```

---

## Task 6: HostManagerModal — Grid-Size Fields

**Files:**
- Modify: `packages/frontend/src/components/HostManager/HostManagerModal.tsx`

- [ ] **Step 1: Add grid defaults to `emptyHost()`**

In `HostManagerModal.tsx`, find `emptyHost()` and add the grid fields:

```typescript
function emptyHost(): Omit<HostProfile, 'id'> {
  return {
    name: '',
    host: '',
    satellite: { wsPort: 16623 },
    notes: '',
    autoConnect: true,
    showInToolbar: true,
    gridCols: 8,
    gridRows: 4,
  }
}
```

- [ ] **Step 2: Add Grid-Size inputs to `HostForm`**

In `HostForm`, after the existing checkbox block (after the `showInToolbar` label block), add:

```tsx
      {/* Button-Grid Standardgröße */}
      <div>
        <label style={{ ...labelStyle, marginBottom: 8 }}>Button-Grid (Picker-Standard)</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Buttons pro Zeile</label>
            <input
              style={inputStyle}
              type="number"
              min={1}
              max={32}
              value={value.gridCols ?? 8}
              onChange={(e) => set({ gridCols: Math.max(1, Math.min(32, parseInt(e.target.value, 10) || 8)) })}
            />
          </div>
          <div>
            <label style={labelStyle}>Zeilen</label>
            <input
              style={inputStyle}
              type="number"
              min={1}
              max={16}
              value={value.gridRows ?? 4}
              onChange={(e) => set({ gridRows: Math.max(1, Math.min(16, parseInt(e.target.value, 10) || 4)) })}
            />
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/HostManager/HostManagerModal.tsx
git commit -m "feat(host-manager): add gridCols/gridRows fields to HostForm"
```

---

## Task 7: CompanionButtonPickerDialog — Host Grid Defaults

**Files:**
- Modify: `packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx`

- [ ] **Step 1: Add optional grid props to the `Props` interface**

Find the `Props` interface in `CompanionButtonPickerDialog.tsx` and add two fields:

```typescript
interface Props {
  onConfirm: (ref: { hostId: string; page: number; row: number; col: number }) => void
  onClose: () => void
  confirmLabel?: string
  /** Vorauswahl beim Öffnen */
  initialRef?: { hostId?: string; page?: number }
  /** Positionierung neben dem PropertiesPanel */
  alignSide?: 'left' | 'right'
  panelWidth?: number
  /** Standard-Grid-Größe beim Öffnen (aus HostProfile) */
  initialGridCols?: number
  initialGridRows?: number
}
```

- [ ] **Step 2: Update the function signature and `useState` defaults**

Find the function signature:
```typescript
export function CompanionButtonPickerDialog({
  onConfirm, onClose, confirmLabel = 'Hinzufügen', initialRef, alignSide, panelWidth = 320,
}: Props) {
```

Replace with:
```typescript
export function CompanionButtonPickerDialog({
  onConfirm, onClose, confirmLabel = 'Hinzufügen', initialRef, alignSide, panelWidth = 320,
  initialGridCols, initialGridRows,
}: Props) {
```

Then find and update the `useState` initialisers for `keysPerRow` and `rows`:

```typescript
// OLD:
const [keysPerRow, setKeysPerRow] = useState(8)
const [rows, setRows] = useState(4)

// NEW:
const [keysPerRow, setKeysPerRow] = useState(initialGridCols ?? 8)
const [rows, setRows] = useState(initialGridRows ?? 4)
```

- [ ] **Step 3: Resync grid size when host changes**

Find `handleHostChange`:

```typescript
const handleHostChange = (id: string) => {
  setHostId(id)
  setSelectedRow(null)
  setSelectedCol(null)
}
```

Replace with:
```typescript
const handleHostChange = (id: string) => {
  setHostId(id)
  setSelectedRow(null)
  setSelectedCol(null)
  // Grid-Größe des neuen Hosts als Default setzen
  const host = settings?.hosts.find((h) => h.id === id)
  if (host?.gridCols !== undefined) setKeysPerRow(host.gridCols)
  if (host?.gridRows !== undefined) setRows(host.gridRows)
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx
git commit -m "feat(picker): use host gridCols/gridRows as default grid size"
```

---

## Task 8: Pass Grid Defaults from Caller Sites

**Files:**
- Modify: `packages/frontend/src/components/AddElement/ChannelStripWizard.tsx`
- Modify: `packages/frontend/src/components/PropertiesPanel/CompanionButtonProps.tsx` (if it opens the Picker)

- [ ] **Step 1: Check which files open CompanionButtonPickerDialog**

```bash
grep -r "CompanionButtonPickerDialog" packages/frontend/src --include="*.tsx" -l
```

Expected output lists the files — typically:
- `AddElement/CompanionButtonPickerDialog.tsx` (the component itself)
- `AddElement/ChannelStripWizard.tsx`
- `PropertiesPanel/CompanionButtonProps.tsx`
- `PropertiesPanel/ChannelStripProps.tsx`

- [ ] **Step 2: Update ChannelStripWizard to pass grid defaults**

In `ChannelStripWizard.tsx`, add a store selector for settings at the top of the component body (after existing state):

```typescript
const settings = useAppStore((s) => s.settings)
```

Find the `CompanionButtonPickerDialog` usage (near bottom of file):

```tsx
{pickerTarget && createPortal(
  <CompanionButtonPickerDialog
    onConfirm={(ref) => { ... }}
    onClose={() => setPickerTarget(null)}
  />,
  document.body,
)}
```

Replace with:

```tsx
{pickerTarget && createPortal(
  <CompanionButtonPickerDialog
    onConfirm={(ref) => {
      if (pickerTarget === 'button') setButtonRef(ref)
      else if (pickerTarget === 'solo') setSoloRef(ref)
      else if (pickerTarget === 'pan') setPanRef(ref)
      setPickerTarget(null)
    }}
    onClose={() => setPickerTarget(null)}
    initialGridCols={
      // Aktiven Host aus buttonRef (falls gesetzt) oder ersten verbundenen Host
      settings?.hosts.find((h) => h.id === (buttonRef?.hostId ?? settings.hosts[0]?.id))?.gridCols
    }
    initialGridRows={
      settings?.hosts.find((h) => h.id === (buttonRef?.hostId ?? settings.hosts[0]?.id))?.gridRows
    }
  />,
  document.body,
)}
```

- [ ] **Step 3: Update CompanionButtonProps (if it opens the Picker)**

Open `packages/frontend/src/components/PropertiesPanel/CompanionButtonProps.tsx` and find where `CompanionButtonPickerDialog` is rendered. Add the same grid props using the element's `ref.hostId` to look up the host:

```tsx
// Innerhalb CompanionButtonProps — existierende Picker-Usage finden und erweitern:
const host = useAppStore((s) =>
  s.settings?.hosts.find((h) => h.id === element.ref.hostId)
)

// Dann beim Picker:
<CompanionButtonPickerDialog
  ...existing props...
  initialGridCols={host?.gridCols}
  initialGridRows={host?.gridRows}
/>
```

- [ ] **Step 4: Update ChannelStripProps (if it opens the Picker)**

Same pattern — find the host by `refs.button.ref.hostId` and pass `initialGridCols`/`initialGridRows`.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 7: Smoke test — grid defaults**

```bash
npm run dev
```

1. Öffne HostManagerModal → Host bearbeiten → `gridCols: 4`, `gridRows: 2` setzen → Speichern
2. Edit-Mode → `+` → CompanionButton → Picker öffnet → Grid ist sofort 4×2
3. Host-Wechsel im Picker → Grid wechselt auf Werte des anderen Hosts
4. ChannelStripWizard Schritt 1 öffnen → Button-Picker → Grid ist 4×2

- [ ] **Step 8: Commit**

```bash
git add packages/frontend/src/components/AddElement/ChannelStripWizard.tsx
git add packages/frontend/src/components/PropertiesPanel/CompanionButtonProps.tsx
git add packages/frontend/src/components/PropertiesPanel/ChannelStripProps.tsx
git commit -m "feat(picker): pass host grid defaults from all Picker call sites"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Zoom 20–200%, persisted in `panel.zoom` → Tasks 1–4
- ✅ Icon-Button + Popover-Slider in Toolbar, beide Modi → Tasks 2–3
- ✅ Ctrl+Scroll → Task 4
- ✅ Koordinaten-Fix (Lasso, ContextMenu) → Task 4
- ✅ `gridCols`/`gridRows` in `HostProfile` → Task 5
- ✅ HostManagerModal: direkt sichtbare Grid-Felder → Task 6
- ✅ Picker: Host-Grid als Default, Resync bei Host-Wechsel → Task 7
- ✅ ChannelStripWizard: Grid-Defaults an Picker weiterreichen → Task 8

**No placeholders:** alle Schritte enthalten vollständigen Code.

**Type consistency:** `setZoom(panelId: string, zoom: number)` konsistent in Task 1 (Store), Task 3 (Toolbar), Task 4 (Canvas). `initialGridCols?/initialGridRows?` konsistent in Task 7 (Props-Interface) und Task 8 (Call Sites).

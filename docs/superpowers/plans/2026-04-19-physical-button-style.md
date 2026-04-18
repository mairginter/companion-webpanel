# Physical Button Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `physicalStyle` render flag to CompanionButtonElement that replaces the flat background with a concave metallic dome CSS effect.

**Architecture:** New `physicalStyle?: boolean` field in shared types. `CompanionButtonElement.tsx` gets three exported pure helpers (`lightenHex`, `darkenHex`, `buildDomeBackground`) plus a conditional rendering branch — physical style replaces the frame background + bevel overlay, all other render options (text, bitmap, status indicators) work unchanged. One new checkbox in `CompanionButtonProps.tsx`.

**Tech Stack:** React, TypeScript, CSS radial/linear gradients, vitest

---

## File Map

| File | Change |
|---|---|
| `packages/shared/src/types.ts` | Add `physicalStyle?: boolean` to `CompanionButtonElement.render` |
| `packages/frontend/src/components/Elements/CompanionButtonElement.tsx` | Export helpers + physical rendering branch |
| `packages/frontend/src/components/Elements/CompanionButtonElement.test.ts` | Unit tests for the three pure helpers |
| `packages/frontend/src/components/PropertiesPanel/CompanionButtonProps.tsx` | Checkbox "Physical Style" |

---

## Task 1: Add `physicalStyle` to shared types

**Files:**
- Modify: `packages/shared/src/types.ts:55-72`

**Context:** `CompanionButtonElement.render` is an inline object type starting at line 55. Add the new field after `fontSize?: number` at line 70. No Settings-version-bump needed — `render` is stored as-is, new optional fields are backwards compatible.

- [ ] **Step 1: Open `packages/shared/src/types.ts` and add field**

Change lines 55–72 from:
```typescript
  render?: {
    centerBitmap?: boolean
    bitmapSize?: number
    enforceMinSize?: boolean
    /** Bitmap anzeigen (Companion-Grafik). Default: false — Text ist bereits in Bitmap eingebettet */
    showBitmap?: boolean
    /** Bitmap auf Container skalieren (objectFit: contain). Default: true */
    scaleBitmap?: boolean
    /** Text-Overlay anzeigen. Default: true */
    showText?: boolean
    /** Companion bgColor als Hintergrund anwenden. Default: true */
    showBgColor?: boolean
    textAlign?: 'center' | 'top' | 'bottom'
    borderRadius?: number
    opacity?: number
    /** Schriftgröße des Text-Overlays in px. Default: 11 */
    fontSize?: number
  }
```
to:
```typescript
  render?: {
    centerBitmap?: boolean
    bitmapSize?: number
    enforceMinSize?: boolean
    /** Bitmap anzeigen (Companion-Grafik). Default: false — Text ist bereits in Bitmap eingebettet */
    showBitmap?: boolean
    /** Bitmap auf Container skalieren (objectFit: contain). Default: true */
    scaleBitmap?: boolean
    /** Text-Overlay anzeigen. Default: true */
    showText?: boolean
    /** Companion bgColor als Hintergrund anwenden. Default: true */
    showBgColor?: boolean
    textAlign?: 'center' | 'top' | 'bottom'
    borderRadius?: number
    opacity?: number
    /** Schriftgröße des Text-Overlays in px. Default: 11 */
    fontSize?: number
    /** Simuliert einen physischen Taster mit konkaver Wölbung. Default: false */
    physicalStyle?: boolean
  }
```

- [ ] **Step 2: Rebuild shared package**

```bash
npm run build -w @cwp/shared
```
Expected: output with no errors, `packages/shared/dist/` updated.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(types): add physicalStyle to CompanionButtonElement render"
```

---

## Task 2: Color helpers + tests (TDD)

**Files:**
- Modify: `packages/frontend/src/components/Elements/CompanionButtonElement.tsx` (add exports before component)
- Create: `packages/frontend/src/components/Elements/CompanionButtonElement.test.ts`

**Context:** Three pure functions are added as named exports at the top of the component file (before the `React.memo` call). This keeps them co-located and testable via direct import. The test file uses vitest (same pattern as `packages/frontend/src/utils/channelStrip.test.ts`).

- [ ] **Step 1: Write the failing tests first**

Create `packages/frontend/src/components/Elements/CompanionButtonElement.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { lightenHex, darkenHex, buildDomeBackground } from './CompanionButtonElement'

describe('lightenHex', () => {
  it('returns white for amount=1', () => {
    expect(lightenHex('#000000', 1)).toBe('rgb(255,255,255)')
  })
  it('returns unchanged for amount=0', () => {
    expect(lightenHex('#ff0000', 0)).toBe('rgb(255,0,0)')
  })
  it('blends midway toward white', () => {
    expect(lightenHex('#000000', 0.5)).toBe('rgb(128,128,128)')
  })
})

describe('darkenHex', () => {
  it('returns black for amount=1', () => {
    expect(darkenHex('#ffffff', 1)).toBe('rgb(0,0,0)')
  })
  it('returns unchanged for amount=0', () => {
    expect(darkenHex('#ff0000', 0)).toBe('rgb(255,0,0)')
  })
  it('halves all channels for amount=0.5', () => {
    expect(darkenHex('#ffffff', 0.5)).toBe('rgb(128,128,128)')
  })
})

describe('buildDomeBackground', () => {
  it('returns grey gradient when bgColor is undefined', () => {
    const bg = buildDomeBackground(undefined, false)
    expect(bg).toContain('rgba(255,255,255,0.9)')
    expect(bg).toContain('#f4f6fa')
  })
  it('uses bgColor rgba tint for valid #rrggbb hex', () => {
    const bg = buildDomeBackground('#ff0000', false)
    expect(bg).toContain('rgba(255,0,0,')
    expect(bg).not.toContain('#f4f6fa')
  })
  it('uses lower specular opacity when pressed', () => {
    const idle = buildDomeBackground(undefined, false)
    const pressed = buildDomeBackground(undefined, true)
    expect(idle).toContain('rgba(255,255,255,0.9)')
    expect(pressed).toContain('rgba(255,255,255,0.6)')
    expect(pressed).not.toContain('rgba(255,255,255,0.9)')
  })
  it('falls back to grey gradient for non-#rrggbb value', () => {
    const bg = buildDomeBackground('red', false)
    expect(bg).toContain('#f4f6fa')
  })
  it('falls back to grey gradient for 3-char hex', () => {
    const bg = buildDomeBackground('#f00', false)
    expect(bg).toContain('#f4f6fa')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run packages/frontend/src/components/Elements/CompanionButtonElement.test.ts
```
Expected: FAIL — `lightenHex` / `darkenHex` / `buildDomeBackground` not exported.

- [ ] **Step 3: Add the three exported helpers to `CompanionButtonElement.tsx`**

Add these three functions **before** the `export const CompanionButtonElement = React.memo(...)` line (around line 14, after the imports):

```typescript
/** Blends hex color channels toward white. amount: 0=unchanged, 1=white */
export function lightenHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r + (255 - r) * amount)},${Math.round(g + (255 - g) * amount)},${Math.round(b + (255 - b) * amount)})`
}

/** Multiplies hex color channels toward black. amount: 0=unchanged, 1=black */
export function darkenHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * (1 - amount))},${Math.round(g * (1 - amount))},${Math.round(b * (1 - amount))})`
}

/** CSS background value for the physical-style dome circle.
 *  bgColor must be #rrggbb — anything else falls back to the default grey dome. */
export function buildDomeBackground(bgColor: string | undefined, pressed: boolean): string {
  const s1 = pressed ? 0.6 : 0.9
  const s2 = pressed ? 0.3 : 0.4
  if (bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor)) {
    const r = parseInt(bgColor.slice(1, 3), 16)
    const g = parseInt(bgColor.slice(3, 5), 16)
    const b = parseInt(bgColor.slice(5, 7), 16)
    return [
      `radial-gradient(ellipse 80% 50% at 50% 70%, rgba(${r},${g},${b},${s1}) 0%, rgba(${r},${g},${b},${s2}) 35%, transparent 70%)`,
      `radial-gradient(circle at 50% 50%, ${lightenHex(bgColor, 0.5)} 0%, ${bgColor} 48%, ${darkenHex(bgColor, 0.6)} 100%)`,
    ].join(', ')
  }
  return [
    `radial-gradient(ellipse 80% 50% at 50% 70%, rgba(255,255,255,${s1}) 0%, rgba(255,255,255,${s2}) 35%, transparent 70%)`,
    `radial-gradient(circle at 50% 50%, #f4f6fa 0%, #e0e4ec 25%, #c8ccd8 48%, #a8acb8 65%, #888c98 80%, #6c7080 92%, #545868 100%)`,
  ].join(', ')
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run packages/frontend/src/components/Elements/CompanionButtonElement.test.ts
```
Expected: 12/12 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/components/Elements/CompanionButtonElement.tsx
git add packages/frontend/src/components/Elements/CompanionButtonElement.test.ts
git commit -m "feat(button): add lightenHex, darkenHex, buildDomeBackground helpers"
```

---

## Task 3: Physical style rendering in CompanionButtonElement

**Files:**
- Modify: `packages/frontend/src/components/Elements/CompanionButtonElement.tsx`

**Context:** Two changes in the component body: (1) read `physicalStyle` from render and define a second `containerStyle` branch, (2) replace the bevel-overlay div with a ternary that renders the dome when `physicalStyle` is active.

The existing component is at `packages/frontend/src/components/Elements/CompanionButtonElement.tsx`. Key line ranges to modify:
- Lines 21–28: read render props — add `physicalStyle`
- Lines 71–97: `containerStyle` — split into physical/normal branch
- Lines 143–159: bevel overlay div — replace with physical/normal ternary

- [ ] **Step 1: Read `physicalStyle` from render (line ~28)**

After line `const fontSize = render?.fontSize ?? 11` add:
```typescript
  const physicalStyle = render?.physicalStyle === true
```

- [ ] **Step 2: Replace `containerStyle` with a physical/normal branch**

Replace the entire `containerStyle` block (lines 71–97) with:

```typescript
  // ─── Container ────────────────────────────────────────────────────────────
  const positionBase: React.CSSProperties = isContained
    ? { position: 'relative' as const, width: '100%', height: '100%' }
    : { position: 'absolute' as const, left: element.x, top: element.y,
        width: element.w, height: element.h, zIndex: element.z }

  const containerStyle: React.CSSProperties = physicalStyle
    ? {
        ...positionBase,
        borderRadius,
        overflow: 'hidden',
        cursor: mode === 'view' ? 'pointer' : 'default',
        userSelect: 'none',
        touchAction: 'none',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: pressed
          ? 'linear-gradient(145deg, #a8acb8 0%, #d4d8e0 30%, #ccd0d8 50%, #b0b4c0 75%, #909098 100%)'
          : 'linear-gradient(145deg, #c0c4ce 0%, #eceef6 30%, #e4e8f0 50%, #c4c8d4 75%, #a0a4b0 100%)',
        boxShadow: pressed
          ? '0 2px 6px rgba(0,0,0,0.7), inset 0 2px 5px rgba(0,0,0,0.35), inset 0 -1px 2px rgba(255,255,255,0.3)'
          : '0 6px 20px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.9), inset 0 -1px 3px rgba(0,0,0,0.2)',
        transition: pressed ? 'none' : 'transform 0.08s, box-shadow 0.08s',
        ...(!hasData && { opacity: 0.6 }),
        ...(isStale && { opacity: 0.5, outline: '2px solid #ff8a3d', outlineOffset: '-2px' }),
        ...(pressed && { outline: '2.5px solid #ff5a5f', outlineOffset: '-2px' }),
      }
    : {
        ...positionBase,
        borderRadius,
        overflow: 'hidden',
        cursor: mode === 'view' ? 'pointer' : 'default',
        userSelect: 'none',
        touchAction: 'none',
        boxSizing: 'border-box',
        background: showBgColor && bgColor ? bgColor : (hasData ? '#1a2030' : 'transparent'),
        ...(!hasData && !isStale && { border: '1.5px dashed #2a3344', opacity: 0.6 }),
        ...(isStale && { opacity: 0.5, outline: '2px solid #ff8a3d', outlineOffset: '-2px' }),
        ...(pressed && { transform: 'scale(0.97)', outline: '2.5px solid #ff5a5f', outlineOffset: '-2px' }),
        transition: pressed ? 'none' : 'transform 0.08s, box-shadow 0.08s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...(hasData && {
          boxShadow: pressed
            ? '0 1px 2px rgba(0,0,0,0.4)'
            : '0 3px 8px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.3)',
        }),
      }
```

- [ ] **Step 3: Replace bevel-overlay div with physical/normal ternary**

Replace the block:
```tsx
      {/* 3D-Bevel-Overlay: Inset-Shadow am Randbereich, Text/Bitmap bleiben frei */}
      {hasData && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius,
            pointerEvents: 'none',
            // Lichtquelle oben-links → Highlight oben/links, Schatten unten/rechts
            // Pressed: invertiert → "eingedrückt"-Gefühl
            boxShadow: pressed
              ? 'inset 0 2px 5px rgba(0,0,0,0.65), inset 2px 0 4px rgba(0,0,0,0.45), inset 0 -1px 2px rgba(255,255,255,0.07), inset -1px 0 2px rgba(255,255,255,0.05)'
              : 'inset 0 1.5px 2px rgba(255,255,255,0.22), inset 1.5px 0 2px rgba(255,255,255,0.11), inset 0 -2.5px 5px rgba(0,0,0,0.60), inset -2.5px 0 4px rgba(0,0,0,0.42)',
            transition: pressed ? 'none' : 'box-shadow 0.08s',
          }}
        />
      )}
```

with:
```tsx
      {/* Physical dome OR normal 3D bevel overlay */}
      {physicalStyle ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '10px',
            borderRadius: '50%',
            pointerEvents: 'none',
            background: buildDomeBackground(bgColor, pressed),
            boxShadow: pressed
              ? 'inset 0 3px 12px rgba(0,0,0,0.25), inset 0 5px 20px rgba(0,0,0,0.15), inset 2px 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.3)'
              : 'inset 0 2px 8px rgba(0,0,0,0.18), inset 0 4px 16px rgba(0,0,0,0.10), inset 2px 2px 6px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.25)',
            transform: pressed ? 'scale(0.97)' : undefined,
            transition: pressed ? 'none' : 'transform 0.08s',
          }}
        />
      ) : hasData ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius,
            pointerEvents: 'none',
            boxShadow: pressed
              ? 'inset 0 2px 5px rgba(0,0,0,0.65), inset 2px 0 4px rgba(0,0,0,0.45), inset 0 -1px 2px rgba(255,255,255,0.07), inset -1px 0 2px rgba(255,255,255,0.05)'
              : 'inset 0 1.5px 2px rgba(255,255,255,0.22), inset 1.5px 0 2px rgba(255,255,255,0.11), inset 0 -2.5px 5px rgba(0,0,0,0.60), inset -2.5px 0 4px rgba(0,0,0,0.42)',
            transition: pressed ? 'none' : 'box-shadow 0.08s',
          }}
        />
      ) : null}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```
Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run packages/frontend
```
Expected: all tests pass (104+ passing).

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/components/Elements/CompanionButtonElement.tsx
git commit -m "feat(button): physical style rendering branch — concave dome CSS"
```

---

## Task 4: PropertiesPanel checkbox

**Files:**
- Modify: `packages/frontend/src/components/PropertiesPanel/CompanionButtonProps.tsx`

**Context:** The PropertiesPanel for CompanionButton is in `CompanionButtonProps.tsx`. The `updateRender` function handles patching `render` in the store. Add the checkbox after the `Border-Radius` NumericInput (around line 110). Setting the checkbox to false stores `undefined` (not `false`) to keep Settings clean.

- [ ] **Step 1: Add Physical Style checkbox after Border-Radius NumericInput**

After the line:
```tsx
      <NumericInput label="Border-Radius" value={r.borderRadius ?? 6} min={0}
        onChange={(v) => updateRender({ borderRadius: v })} />
```

Add:
```tsx
      <div style={row}>
        <span style={lbl}>Physical Style</span>
        <input
          type="checkbox"
          style={{ width: 20, height: 20, cursor: 'pointer' }}
          checked={r.physicalStyle === true}
          onChange={(e) => updateRender({ physicalStyle: e.target.checked || undefined })}
        />
      </div>
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```
Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run packages/frontend
```
Expected: all tests pass.

- [ ] **Step 4: Manual smoke test**

Start the dev server:
```bash
npm run dev
```
1. Open `http://localhost:5173`
2. Add a CompanionButton to a panel
3. Select it → open PropertiesPanel
4. Check "Physical Style" checkbox
5. Verify: button switches to silver/metallic frame + circular dome
6. Hover and click: verify pressed state (dome scales down, frame darkens)
7. If Companion is connected: verify button with actual bgColor shows correct color tint on dome
8. Uncheck "Physical Style": verify button reverts to normal appearance

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/components/PropertiesPanel/CompanionButtonProps.tsx
git commit -m "feat(propertiesPanel): add Physical Style toggle for CompanionButton"
```

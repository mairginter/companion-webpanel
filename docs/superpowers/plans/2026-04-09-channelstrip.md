# ChannelStrip Element — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `channelStrip` element that combines Meter, Fader-Wheel, Mute, Solo, and Pan into one Companion-connected block — like a hardware mixer channel strip.

**Architecture:** A single Companion button (`refs.button.ref`) provides all data (bgColor=mute-state, SUB-PRESS=mute-action, SUB-ROTATE=fader, TEXT=multi-value pipe-separated). Optional `refs.solo` and `refs.pan` buttons add Solo state and Pan value. Parser utilities live in `packages/frontend/src/utils/channelStrip.ts` and are fully unit-tested. The backend gets a new `rotate()` method in `SatelliteClient` and a `handleRotate()` in `HostManager`.

**Tech Stack:** React + TypeScript, Zustand, existing WS protocol, Vitest

**Design Spec:** `docs/superpowers/specs/2026-04-09-channelstrip-design.md`

---

## File Map

| File | Create / Modify | Responsibility |
|---|---|---|
| `packages/shared/src/types.ts` | Modify | Add `ChannelStripElement`, `RotateMessage`, update `AnyElement` + `FrontendToBackend` |
| `packages/backend/src/satellite/SatelliteClient.ts` | Modify | Add `rotate()` method for `SUB-ROTATE` |
| `packages/backend/src/HostManager.ts` | Modify | `handleRotate()` + `buildDesiredSubs` includes channelStrip refs |
| `packages/backend/src/server/ClientServer.ts` | Modify | Handle `msg.t === 'rotate'` in WS message handler |
| `packages/frontend/src/ws/useWebSocket.ts` | Modify | Expose `sendRotate` |
| `packages/frontend/src/App.tsx` | Modify | Pass `sendRotate` to `Canvas` |
| `packages/frontend/src/components/Canvas/Canvas.tsx` | Modify | Accept + pass `sendRotate`, add `channelStrip` case in `renderInner` |
| `packages/frontend/src/utils/channelStrip.ts` | Create | `parseChannelStripText`, `parsePanValue`, `isMuted` |
| `packages/frontend/src/utils/channelStrip.test.ts` | Create | Unit tests for all 3 parser utilities |
| `packages/frontend/src/components/Elements/ChannelStripElement.tsx` | Create | Full visual component |
| `packages/frontend/src/components/PropertiesPanel/ChannelStripProps.tsx` | Create | Properties panel section |
| `packages/frontend/src/components/PropertiesPanel/PropertiesPanel.tsx` | Modify | Add `channelStrip` case |
| `packages/frontend/src/components/AddElement/AddElementMenu.tsx` | Modify | Add channelStrip entry + wizard trigger |
| `packages/frontend/src/components/AddElement/ChannelStripWizard.tsx` | Create | 5-step setup wizard |

---

## Task 1: Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add `ChannelStripElement` and `RotateMessage` to types.ts**

Replace (after `MeterElement` interface, before `AnyElement`):

```typescript
export interface ChannelStripElement extends BaseElement {
  type: 'channelStrip'

  style: {
    /** Accent-Farbe für 20px Color Stripe (hex). Default: '#4a9eff' */
    color: string
    /** Statischer Channel-Name (Fallback wenn kein nameIndex konfiguriert) */
    name?: string
    /** Mono-Modus: nur ein Meter-Bar, Pan-Indicator ausgegraut */
    mono?: boolean
    /** dBFS ab dem Clip-LED blinkt. Default: 0 */
    clipThreshold?: number
    /** Anzahl SUB-ROTATE-Events bei Shift+Scroll. Default: 10 */
    coarseMultiplier?: number
  }

  refs: {
    /**
     * Haupt-Button: Mute (SUB-PRESS + bgColor) + Fader (SUB-ROTATE) + Daten (TEXT)
     */
    button: {
      ref: CompanionRef
      /** Trennzeichen für Multi-Wert TEXT-Feld. Default: '|' */
      textSeparator?: string
      /** TEXT-Index für Meter L dB-Wert. Default: 0 */
      meterLIndex?: number
      /** TEXT-Index für Meter R dB-Wert. Optional */
      meterRIndex?: number
      /** TEXT-Index für Fader Level (Fader-Bar + dB-Anzeige). Optional */
      levelIndex?: number
      /** TEXT-Index für Channel Name. Optional — Fallback: style.name */
      nameIndex?: number
    }
    /** Solo-Button (optional). Ausgegraut wenn nicht konfiguriert. */
    solo?: CompanionRef
    /** Pan-Indicator Datenquelle (optional). TEXT = Pan-Wert. */
    pan?: CompanionRef
  }
}
```

Update `AnyElement`:
```typescript
export type AnyElement =
  | CompanionButtonElement
  | ShapeElement
  | LabelElement
  | MeterElement
  | ChannelStripElement
```

Add `RotateMessage` after `PressMessage`:
```typescript
/** Frontend → Backend: fader rotate via drum wheel */
export interface RotateMessage {
  t: 'rotate'
  hostId: string
  page: number
  row: number
  col: number
  direction: 1 | -1
}
```

Update `FrontendToBackend`:
```typescript
export type FrontendToBackend = PressMessage | RotateMessage
```

- [ ] **Step 2: Build shared**

```bash
npm run build -w @cwp/shared
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(types): add ChannelStripElement + RotateMessage"
```

---

## Task 2: Backend — SUB-ROTATE + ChannelStrip Subscriptions

**Files:**
- Modify: `packages/backend/src/satellite/SatelliteClient.ts`
- Modify: `packages/backend/src/HostManager.ts`
- Modify: `packages/backend/src/server/ClientServer.ts`

- [ ] **Step 1: Add `rotate()` to SatelliteClient**

In `SatelliteClient.ts`, after the `press()` method (line ~133), add:

```typescript
/**
 * Sendet einen SUB-ROTATE an Companion.
 * direction: 1 = CW (up/right), -1 = CCW (down/left)
 */
rotate(page: number, row: number, col: number, direction: 1 | -1): void {
  if (this.status !== 'connected') return
  const subId = `cwp/${page}/${row}/${col}`
  this.sendLine(`SUB-ROTATE SUBID=${subId} DIRECTION=${direction}`)
}
```

Also add to `handleLine()`, after the `SUB-PRESS OK` branch:
```typescript
} else if (line.startsWith('SUB-ROTATE OK')) {
  // Bestätigung ignorieren
}
```

- [ ] **Step 2: Add `handleRotate()` to HostManager**

In `HostManager.ts`, after `handlePress()` (line ~169), add:

```typescript
/**
 * Leitet einen Fader-Rotate ans richtige SatelliteClient weiter.
 */
handleRotate(hostId: string, page: number, row: number, col: number, direction: 1 | -1): void {
  const client = this.clients.get(hostId)
  if (!client) {
    console.warn(`[HostManager] Kein Client für Host "${hostId}" (rotate)`)
    return
  }
  client.rotate(page, row, col, direction)
}
```

- [ ] **Step 3: Update `buildDesiredSubs` in HostManager to include channelStrip refs**

In `HostManager.ts`, replace the `buildDesiredSubs` method:

```typescript
private buildDesiredSubs(settings: Settings): Map<string, Set<string>> {
  const desired = new Map<string, Set<string>>()

  const addRef = (ref: import('@cwp/shared').CompanionRef | undefined) => {
    if (!ref) return
    const { hostId, page, row, col } = ref
    if (!desired.has(hostId)) desired.set(hostId, new Set())
    desired.get(hostId)!.add(`${page}/${row}/${col}`)
  }

  for (const panel of settings.panels) {
    for (const el of panel.elements) {
      if (el.type === 'companionButton') {
        addRef(el.ref)
      } else if (el.type === 'channelStrip') {
        addRef(el.refs.button.ref)
        addRef(el.refs.solo)
        addRef(el.refs.pan)
      }
    }
  }

  return desired
}
```

Also update the import at top of HostManager.ts — `AnyElement` is still correct (union now includes `ChannelStripElement`). Remove the old `isCompanionButton` helper at the bottom of the file (it's no longer used):

```typescript
// DELETE this function — no longer used:
// function isCompanionButton(el: AnyElement): el is import('@cwp/shared').CompanionButtonElement {
//   return el.type === 'companionButton'
// }
```

- [ ] **Step 4: Handle `rotate` message in ClientServer**

In `ClientServer.ts`, inside the WS `ws.on('message', ...)` handler (around line 184), add after the `press` case:

```typescript
if (msg.t === 'press') {
  const key = pressKey(msg.hostId, msg.page, msg.row, msg.col)
  const presses = this.clientPresses.get(ws)
  if (presses) {
    if (msg.pressed) presses.add(key)
    else presses.delete(key)
  }
  this.onPress(msg.hostId, msg.page, msg.row, msg.col, msg.pressed)
} else if (msg.t === 'rotate') {
  this.onRotate?.(msg.hostId, msg.page, msg.row, msg.col, msg.direction)
}
```

Add `onRotate` handler to the class. At the top of the class, add a field:
```typescript
private onRotate?: (hostId: string, page: number, row: number, col: number, direction: 1 | -1) => void
```

Add `onRotateHandler` parameter to the constructor (after `onPreviewPageRemove`, before `staticDir`):
```typescript
constructor(
  port: number,
  settings: Settings,
  settingsPath: string,
  onPress: PressHandler,
  onSettingsUpdate?: (s: Settings) => void,
  onPreviewPageAdd?: PreviewPageHandler,
  onPreviewPageRemove?: PreviewPageRemoveHandler,
  onRotate?: (hostId: string, page: number, row: number, col: number, direction: 1 | -1) => void,
  staticDir?: string,
) {
  // ...
  this.onRotate = onRotate
  // ...
}
```

Add the type alias near top of `ClientServer.ts`:
```typescript
export type RotateHandler = (hostId: string, page: number, row: number, col: number, direction: 1 | -1) => void
```

- [ ] **Step 5: Wire rotate in standalone.ts and backend index**

In `packages/backend/src/standalone.ts`, find where `ClientServer` is instantiated. Add the rotate handler as 8th argument (before `staticDir`):

```typescript
const server = new ClientServer(
  serverPort,
  settings,
  settingsPath,
  (hostId, page, row, col, pressed) => hostManager.handlePress(hostId, page, row, col, pressed),
  (s) => hostManager.syncSubscriptions(s),
  (hostId, page, keysPerRow, rows) => hostManager.addPickerSubscriptions(hostId, page, keysPerRow, rows),
  (hostId, page) => hostManager.removePickerSubscriptions(hostId, page),
  (hostId, page, row, col, direction) => hostManager.handleRotate(hostId, page, row, col, direction),
)
```

In `packages/backend/src/index.ts`, check if `ClientServer` is also instantiated there — if so, add the same rotate handler argument.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit -p packages/backend/tsconfig.json
```

Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/satellite/SatelliteClient.ts packages/backend/src/HostManager.ts packages/backend/src/server/ClientServer.ts packages/backend/src/standalone.ts packages/backend/src/index.ts
git commit -m "feat(backend): SUB-ROTATE support + channelStrip subscriptions"
```

---

## Task 3: Frontend — sendRotate WS Hook + Prop Drilling

**Files:**
- Modify: `packages/frontend/src/ws/useWebSocket.ts`
- Modify: `packages/frontend/src/App.tsx`
- Modify: `packages/frontend/src/components/Canvas/Canvas.tsx`

- [ ] **Step 1: Add `sendRotate` to useWebSocket**

In `useWebSocket.ts`, update the return type and add the function:

```typescript
export function useWebSocket(): {
  sendPress: (hostId: string, page: number, row: number, col: number, pressed: boolean) => void
  sendRotate: (hostId: string, page: number, row: number, col: number, direction: 1 | -1) => void
} {
  // ... existing code ...

  const sendRotate = useCallback(
    (hostId: string, page: number, row: number, col: number, direction: 1 | -1) => {
      if (ws.current?.readyState !== WebSocket.OPEN) return
      const msg: FrontendToBackend = { t: 'rotate', hostId, page, row, col, direction }
      ws.current.send(JSON.stringify(msg))
    },
    [],
  )

  return { sendPress, sendRotate }
}
```

- [ ] **Step 2: Pass `sendRotate` through App.tsx → Canvas**

In `App.tsx`, destructure `sendRotate` from `useWebSocket()`:
```typescript
const { sendPress, sendRotate } = useWebSocket()
```

Pass to Canvas:
```tsx
<Canvas sendPress={sendPress} sendRotate={sendRotate} />
```

In `Canvas.tsx`, update `CanvasProps`:
```typescript
interface CanvasProps {
  sendPress: (hostId: string, page: number, row: number, col: number, pressed: boolean) => void
  sendRotate: (hostId: string, page: number, row: number, col: number, direction: 1 | -1) => void
}
```

Update function signature:
```typescript
export function Canvas({ sendPress, sendRotate }: CanvasProps) {
```

Pass both to `renderElements`:
```typescript
renderElements(panel.elements, panel.id, mode, sendPress, sendRotate)
```

Update `renderElements` and `renderInner` signatures:
```typescript
function renderElements(
  elements: AnyElement[],
  panelId: string,
  mode: 'view' | 'edit',
  sendPress: CanvasProps['sendPress'],
  sendRotate: CanvasProps['sendRotate'],
) {
  // ...
  return sorted.map((el) => {
    const inner = renderInner(el, mode, sendPress, sendRotate)
    // ...
  })
}

function renderInner(
  el: AnyElement,
  mode: 'view' | 'edit',
  sendPress: CanvasProps['sendPress'],
  sendRotate: CanvasProps['sendRotate'],
) {
  const isContained = mode === 'edit'
  switch (el.type) {
    case 'companionButton':
      return <CompanionButtonElement element={el} mode={mode} sendPress={sendPress} isContained={isContained} />
    case 'shape':
      return <ShapeElement element={el} isContained={isContained} />
    case 'label':
      return <LabelElement element={el} isContained={isContained} />
    case 'channelStrip':
      return <ChannelStripElement element={el} mode={mode} sendPress={sendPress} sendRotate={sendRotate} isContained={isContained} />
    case 'meter':
      return null // TODO Phase 3.4
    default:
      return null
  }
}
```

Add import at top of Canvas.tsx (after LabelElement import):
```typescript
import { ChannelStripElement } from '../Elements/ChannelStripElement'
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors (ChannelStripElement.tsx doesn't exist yet, so comment out or stub the import/case temporarily).

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/ws/useWebSocket.ts packages/frontend/src/App.tsx packages/frontend/src/components/Canvas/Canvas.tsx
git commit -m "feat(frontend): sendRotate WS hook + Canvas prop drilling"
```

---

## Task 4: Frontend — Parser Utilities + Tests

**Files:**
- Create: `packages/frontend/src/utils/channelStrip.ts`
- Create: `packages/frontend/src/utils/channelStrip.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `packages/frontend/src/utils/channelStrip.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseChannelStripText, parsePanValue, isMuted } from './channelStrip'

describe('parseChannelStripText', () => {
  it('parses pipe-separated values by index', () => {
    const result = parseChannelStripText('-18.5|-12.0|-6.0|Guitar', '|', { meterLIndex: 0, meterRIndex: 1, levelIndex: 2, nameIndex: 3 })
    expect(result.meterL).toBeCloseTo(-18.5)
    expect(result.meterR).toBeCloseTo(-12.0)
    expect(result.level).toBeCloseTo(-6.0)
    expect(result.name).toBe('Guitar')
  })

  it('returns undefined for unset indices', () => {
    const result = parseChannelStripText('-18.5', '|', { meterLIndex: 0 })
    expect(result.meterL).toBeCloseTo(-18.5)
    expect(result.meterR).toBeUndefined()
    expect(result.level).toBeUndefined()
    expect(result.name).toBeUndefined()
  })

  it('treats "-oo" (Wing) as -144', () => {
    const result = parseChannelStripText('-oo|-inf', '|', { meterLIndex: 0, meterRIndex: 1 })
    expect(result.meterL).toBe(-144)
    expect(result.meterR).toBe(-144)
  })

  it('ignores NaN values', () => {
    const result = parseChannelStripText('bad', '|', { meterLIndex: 0 })
    expect(result.meterL).toBeUndefined()
  })

  it('uses entire text as meterL when no separator configured', () => {
    const result = parseChannelStripText('-12.0', '', { meterLIndex: 0 })
    expect(result.meterL).toBeCloseTo(-12.0)
  })

  it('handles custom separator', () => {
    const result = parseChannelStripText('-10.0;Guitar', ';', { meterLIndex: 0, nameIndex: 1 })
    expect(result.meterL).toBeCloseTo(-10.0)
    expect(result.name).toBe('Guitar')
  })
})

describe('parsePanValue', () => {
  it('returns 0 for center strings', () => {
    expect(parsePanValue('C')).toBe(0)
    expect(parsePanValue('CTR')).toBe(0)
  })

  it('parses L/R offset strings', () => {
    expect(parsePanValue('L20')).toBeCloseTo(-0.2)
    expect(parsePanValue('R10')).toBeCloseTo(0.1)
    expect(parsePanValue('L100')).toBeCloseTo(-1.0)
    expect(parsePanValue('R100')).toBeCloseTo(1.0)
  })

  it('parses numeric -1.0..+1.0', () => {
    expect(parsePanValue('-0.5')).toBeCloseTo(-0.5)
    expect(parsePanValue('0.75')).toBeCloseTo(0.75)
    expect(parsePanValue('0')).toBe(0)
  })

  it('returns 0 for unrecognized strings', () => {
    expect(parsePanValue('???')).toBe(0)
    expect(parsePanValue('')).toBe(0)
  })
})

describe('isMuted', () => {
  it('returns false for undefined or empty bgColor', () => {
    expect(isMuted(undefined)).toBe(false)
    expect(isMuted('')).toBe(false)
  })

  it('returns false for near-black colors (default companion background)', () => {
    expect(isMuted('#000000')).toBe(false)
    expect(isMuted('#0a0e14')).toBe(false)
    expect(isMuted('#121821')).toBe(false)
  })

  it('returns true for bright/saturated colors (active feedback)', () => {
    expect(isMuted('#ff0000')).toBe(true)  // red = muted
    expect(isMuted('#ff5a5f')).toBe(true)
    expect(isMuted('#ff8a3d')).toBe(true)  // orange
    expect(isMuted('#21d07a')).toBe(true)  // green
    expect(isMuted('#4a9eff')).toBe(true)  // blue
    expect(isMuted('#ffffff')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run packages/frontend/src/utils/channelStrip.test.ts
```

Expected: FAIL with "Cannot find module './channelStrip'"

- [ ] **Step 3: Implement `packages/frontend/src/utils/channelStrip.ts`**

```typescript
/**
 * channelStrip.ts
 *
 * Hilfs-Funktionen für das ChannelStrip-Element:
 *  - parseChannelStripText: Parst den Multi-Wert TEXT-String eines Companion-Buttons
 *  - parsePanValue: Konvertiert Pan-Strings (L20, R10, C, numerisch) → -1.0..+1.0
 *  - isMuted: Bestimmt Mute-State anhand der bgColor des Companion-Buttons
 */

export interface ParsedChannelText {
  meterL?: number
  meterR?: number
  level?: number
  name?: string
}

interface TextIndices {
  meterLIndex?: number
  meterRIndex?: number
  levelIndex?: number
  nameIndex?: number
}

/**
 * Parst einen Multi-Wert TEXT-String aus einem Companion-Button.
 *
 * Beispiel: "-18.5|-12.0|-6.0|Guitar" mit separator="|"
 * → { meterL: -18.5, meterR: -12.0, level: -6.0, name: "Guitar" }
 */
export function parseChannelStripText(
  text: string,
  separator: string,
  indices: TextIndices,
): ParsedChannelText {
  const parts = separator ? text.split(separator) : [text]

  const getNum = (index: number | undefined): number | undefined => {
    if (index === undefined) return undefined
    const raw = parts[index]?.trim()
    if (!raw) return undefined
    // Wing sendet "-oo", andere "-inf" für -∞
    if (raw === '-oo' || raw === '-inf' || raw.toLowerCase() === '-infinity') return -144
    const n = parseFloat(raw)
    return isNaN(n) ? undefined : n
  }

  const getStr = (index: number | undefined): string | undefined => {
    if (index === undefined) return undefined
    const raw = parts[index]?.trim()
    return raw || undefined
  }

  return {
    meterL: getNum(indices.meterLIndex),
    meterR: getNum(indices.meterRIndex),
    level: getNum(indices.levelIndex),
    name: getStr(indices.nameIndex),
  }
}

/**
 * Konvertiert Pan-Strings in einen Wert von -1.0 (full left) bis +1.0 (full right).
 *
 * Unterstützte Formate:
 *  - "C" / "CTR" → 0
 *  - "L20" → -0.2, "R10" → +0.1 (L/R-Offset 0–100 → ±0..1)
 *  - "-0.5" / "0.75" → direkt als Zahl
 */
export function parsePanValue(raw: string): number {
  if (!raw) return 0
  const s = raw.trim().toUpperCase()

  // Center variants
  if (s === 'C' || s === 'CTR' || s === 'CENTER') return 0

  // L/R offset format: "L20" = -0.2, "R10" = +0.1
  const lrMatch = s.match(/^([LR])(\d+)$/)
  if (lrMatch) {
    const offset = parseInt(lrMatch[2], 10) / 100
    return lrMatch[1] === 'L' ? -Math.min(offset, 1) : Math.min(offset, 1)
  }

  // Numeric -1.0..+1.0
  const n = parseFloat(s)
  if (!isNaN(n)) return Math.max(-1, Math.min(1, n))

  return 0
}

/**
 * Bestimmt ob ein Companion-Button im "muted/active"-Zustand ist,
 * anhand seiner bgColor. Dunkle Farben (< 5% Helligkeit) = inaktiv.
 * Jede helle/gesättigte Farbe = aktiv.
 */
export function isMuted(bgColor: string | undefined): boolean {
  if (!bgColor) return false
  const hex = bgColor.replace('#', '')
  if (hex.length !== 6) return false
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  // Relative Luminanz (WCAG-Formel, vereinfacht ohne Gamma-Korrektur)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.05
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
npx vitest run packages/frontend/src/utils/channelStrip.test.ts
```

Expected: 16 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/utils/channelStrip.ts packages/frontend/src/utils/channelStrip.test.ts
git commit -m "feat(frontend): channelStrip parser utils + tests"
```

---

## Task 5: ChannelStripElement.tsx — Hauptkomponente

**Files:**
- Create: `packages/frontend/src/components/Elements/ChannelStripElement.tsx`

- [ ] **Step 1: Create the component**

Create `packages/frontend/src/components/Elements/ChannelStripElement.tsx`:

```tsx
/**
 * ChannelStripElement.tsx
 *
 * Kombiniertes Mixer-Channel-Strip Element.
 * Zeigt Meter L/R, Fader-Track, Pan-Indicator, Mute- und Solo-Button.
 * Ein Companion-Button liefert alle Daten via Multi-Wert TEXT-Feld.
 *
 * Interaktion:
 *  - Drum Wheel: Mausrad + Pointer-Drag → SUB-ROTATE (Fader)
 *  - Shift+Wheel: coarseMultiplier× SUB-ROTATE
 *  - Doppelklick auf Wheel: SUB-PRESS (Unity Reset)
 *  - Mute-Button: SUB-PRESS auf buttonRef
 *  - Solo-Button: SUB-PRESS auf soloRef
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ChannelStripElement as ChannelStripElementType } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { parseChannelStripText, parsePanValue, isMuted } from '../../utils/channelStrip'

// Inject CSS keyframe animation once (for clip LED blink)
;(() => {
  if (typeof document === 'undefined') return
  if (document.getElementById('cwp-channelstrip-styles')) return
  const style = document.createElement('style')
  style.id = 'cwp-channelstrip-styles'
  style.textContent = `
    @keyframes cwp-clip-blink {
      0%,100% { background:#2a0a0a; box-shadow:none; }
      50% { background:#ff5a5f; box-shadow:0 0 6px 2px rgba(255,90,95,0.6); }
    }
  `
  document.head.appendChild(style)
})()

const DB_MIN = -60
const DB_MAX = 10
const PEAK_HOLD_MS = 2000
const DRAG_PX_PER_TICK = 8

function dbToPercent(db: number): number {
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, db))
  return ((clamped - DB_MIN) / (DB_MAX - DB_MIN)) * 100
}

interface Props {
  element: ChannelStripElementType
  mode: 'view' | 'edit'
  sendPress: (hostId: string, page: number, row: number, col: number, pressed: boolean) => void
  sendRotate: (hostId: string, page: number, row: number, col: number, direction: 1 | -1) => void
  isContained?: boolean
}

export const ChannelStripElement = React.memo(function ChannelStripElement({
  element,
  mode,
  sendPress,
  sendRotate,
  isContained,
}: Props) {
  const { style, refs } = element
  const buttonRef = refs.button.ref
  const separator = refs.button.textSeparator ?? '|'
  const textIndices = {
    meterLIndex: refs.button.meterLIndex ?? 0,
    meterRIndex: refs.button.meterRIndex,
    levelIndex: refs.button.levelIndex,
    nameIndex: refs.button.nameIndex,
  }

  const clipThreshold = style.clipThreshold ?? 0
  const coarseMultiplier = style.coarseMultiplier ?? 10
  const isMono = style.mono === true

  // State from store
  const buttonState = useAppStore((s) => s.getButtonState(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col))
  const soloState = useAppStore((s) =>
    refs.solo ? s.getButtonState(refs.solo.hostId, refs.solo.page, refs.solo.row, refs.solo.col) : undefined
  )
  const panState = useAppStore((s) =>
    refs.pan ? s.getButtonState(refs.pan.hostId, refs.pan.page, refs.pan.row, refs.pan.col) : undefined
  )
  const hostMissing = useAppStore((s) => !s.hostExists(buttonRef.hostId))

  // Parse TEXT field
  const parsed = parseChannelStripText(buttonState?.text ?? '', separator, textIndices)
  const meterLDb = parsed.meterL ?? -144
  const meterRDb = parsed.meterR ?? -144
  const levelDb = parsed.level
  const channelName = parsed.name ?? style.name ?? ''

  // Mute / Solo state
  const muted = isMuted(buttonState?.bgColor)
  const soloed = isMuted(soloState?.bgColor)

  // Pan value
  const panValue = refs.pan ? parsePanValue(panState?.text ?? '') : 0
  const panDisabled = isMono || !refs.pan

  // Clip LED
  const isClipping = meterLDb >= clipThreshold || (!isMono && meterRDb >= clipThreshold)

  // Peak hold
  const peakLRef = useRef(-144)
  const peakRRef = useRef(-144)
  const [peakLDisplay, setPeakLDisplay] = useState(-144)
  const [peakRDisplay, setPeakRDisplay] = useState(-144)
  const peakLTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peakRTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (meterLDb > peakLRef.current) {
      peakLRef.current = meterLDb
      setPeakLDisplay(meterLDb)
      if (peakLTimer.current) clearTimeout(peakLTimer.current)
      peakLTimer.current = setTimeout(() => { peakLRef.current = -144; setPeakLDisplay(-144) }, PEAK_HOLD_MS)
    }
  }, [meterLDb])

  useEffect(() => {
    if (meterRDb > peakRRef.current) {
      peakRRef.current = meterRDb
      setPeakRDisplay(meterRDb)
      if (peakRTimer.current) clearTimeout(peakRTimer.current)
      peakRTimer.current = setTimeout(() => { peakRRef.current = -144; setPeakRDisplay(-144) }, PEAK_HOLD_MS)
    }
  }, [meterRDb])

  // Drum wheel interaction
  const dragStartX = useRef<number | null>(null)
  const dragAccum = useRef(0)

  const doRotate = useCallback((direction: 1 | -1, times = 1) => {
    if (mode !== 'view') return
    for (let i = 0; i < times; i++) {
      sendRotate(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col, direction)
    }
  }, [mode, sendRotate, buttonRef])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (mode !== 'view') return
    e.preventDefault()
    e.stopPropagation()
    const direction: 1 | -1 = e.deltaY < 0 ? 1 : -1
    const times = e.shiftKey ? coarseMultiplier : 1
    doRotate(direction, times)
  }, [mode, doRotate, coarseMultiplier])

  const handleWheelPointerDown = useCallback((e: React.PointerEvent) => {
    if (mode !== 'view') return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartX.current = e.clientX
    dragAccum.current = 0
  }, [mode])

  const handleWheelPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartX.current === null) return
    const delta = e.clientX - dragStartX.current
    dragAccum.current += delta
    dragStartX.current = e.clientX
    while (dragAccum.current >= DRAG_PX_PER_TICK) {
      doRotate(1)
      dragAccum.current -= DRAG_PX_PER_TICK
    }
    while (dragAccum.current <= -DRAG_PX_PER_TICK) {
      doRotate(-1)
      dragAccum.current += DRAG_PX_PER_TICK
    }
  }, [doRotate])

  const handleWheelPointerUp = useCallback(() => {
    dragStartX.current = null
    dragAccum.current = 0
  }, [])

  const handleWheelDoubleClick = useCallback(() => {
    if (mode !== 'view') return
    // Unity Reset: SUB-PRESS true + false
    sendPress(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col, true)
    setTimeout(() => sendPress(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col, false), 50)
  }, [mode, sendPress, buttonRef])

  const handleMuteClick = useCallback(() => {
    if (mode !== 'view') return
    sendPress(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col, true)
    setTimeout(() => sendPress(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col, false), 50)
  }, [mode, sendPress, buttonRef])

  const handleSoloClick = useCallback(() => {
    if (mode !== 'view' || !refs.solo) return
    const s = refs.solo
    sendPress(s.hostId, s.page, s.row, s.col, true)
    setTimeout(() => sendPress(s.hostId, s.page, s.row, s.col, false), 50)
  }, [mode, sendPress, refs.solo])

  // Layout
  const containerStyle: React.CSSProperties = isContained
    ? { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 6, background: '#0f141a', border: '1px solid #1e2535' }
    : { position: 'absolute', left: element.x, top: element.y, width: element.w, height: element.h, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 6, background: '#0f141a', border: '1px solid #1e2535' }

  const meterHeight = 80
  const showRChannel = !isMono && refs.button.meterRIndex !== undefined

  return (
    <div style={containerStyle}>
      {/* ── Color Stripe ─────────────────────────────────────── */}
      <div style={{
        height: 20, flexShrink: 0,
        background: style.color,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 6px',
      }}>
        <span style={{
          fontSize: 9, fontWeight: 700, color: 'rgba(0,0,0,0.6)',
          letterSpacing: 2, textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {channelName}
        </span>
        {/* Clip LED */}
        <div style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          ...(isClipping
            ? { animation: 'cwp-clip-blink 0.5s step-start infinite' }
            : { background: '#2a0a0a' }
          ),
        }} />
      </div>

      {/* ── Pan Indicator ────────────────────────────────────── */}
      <div style={{
        padding: '4px 6px 2px',
        opacity: panDisabled ? 0.2 : 1,
        flexShrink: 0,
      }}>
        <div style={{ position: 'relative', height: 4, background: '#1a2030', borderRadius: 2 }}>
          {/* Center mark */}
          <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: '#2a3344' }} />
          {/* Pan dot */}
          <div style={{
            position: 'absolute',
            left: `calc(${50 + panValue * 50}% - 4px)`,
            top: -2, width: 8, height: 8,
            borderRadius: '50%',
            background: panDisabled ? '#2a3344' : '#4a9eff',
            transition: 'left 0.1s ease',
          }} />
        </div>
        <div style={{ fontSize: 7, color: '#3a4a5e', marginTop: 1, textAlign: 'center' }}>
          {panDisabled ? 'PAN' : (panValue === 0 ? 'C' : panValue < 0 ? `L${Math.round(-panValue * 100)}` : `R${Math.round(panValue * 100)}`)}
        </div>
      </div>

      {/* ── Meter + Fader Section ────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, padding: '0 6px', flexShrink: 0, height: meterHeight }}>
        {/* Meter bars */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', flex: 1 }}>
          <MeterBar db={meterLDb} peak={peakLDisplay} height={meterHeight} />
          {showRChannel && <MeterBar db={meterRDb} peak={peakRDisplay} height={meterHeight} />}
        </div>

        {/* Fader track */}
        {levelDb !== undefined && (
          <div style={{ width: 20, height: meterHeight, position: 'relative', flexShrink: 0 }}>
            {/* Track */}
            <div style={{
              position: 'absolute', left: 7, top: 0, width: 6, height: '100%',
              background: '#1a2030', borderRadius: 3,
            }} />
            {/* Fader knob */}
            <div style={{
              position: 'absolute',
              left: 2,
              top: `${100 - dbToPercent(levelDb)}%`,
              width: 16, height: 7,
              background: 'linear-gradient(#5a6a8a, #3a4a6a)',
              borderRadius: 2,
              transform: 'translateY(-50%)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }} />
          </div>
        )}

        {/* dB level value */}
        {levelDb !== undefined && (
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
            <span style={{
              fontSize: 10, color: '#4a9eff',
              fontFamily: "'JetBrains Mono', monospace",
              whiteSpace: 'nowrap',
            }}>
              {levelDb === -144 ? '-∞' : `${levelDb.toFixed(1)}`}
            </span>
          </div>
        )}
      </div>

      {/* ── Drum Wheel ───────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          height: 28,
          margin: '4px 6px',
          borderRadius: 4,
          cursor: mode === 'view' ? 'ew-resize' : 'default',
          userSelect: 'none',
          touchAction: 'none',
          background: 'repeating-linear-gradient(90deg, #1a2030 0px, #1a2030 6px, #243040 6px, #243040 8px)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5), inset 0 -1px 3px rgba(0,0,0,0.5)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onWheel={handleWheel}
        onPointerDown={handleWheelPointerDown}
        onPointerMove={handleWheelPointerMove}
        onPointerUp={handleWheelPointerUp}
        onPointerCancel={handleWheelPointerUp}
        onDoubleClick={handleWheelDoubleClick}
      >
        {/* Center highlight line */}
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.1)', transform: 'translateY(-50%)' }} />
        {/* Grip dots */}
        {[25, 37.5, 50, 62.5, 75].map((pos) => (
          <div key={pos} style={{
            position: 'absolute', left: `${pos}%`,
            width: 4, height: 4, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            transform: 'translateX(-50%)',
          }} />
        ))}
      </div>

      {/* ── Mute / Solo Buttons ──────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, padding: '0 6px 6px', flexShrink: 0, flex: 1, alignItems: 'flex-end' }}>
        <button
          onClick={handleMuteClick}
          style={{
            flex: 1, height: 28, border: 'none', borderRadius: 4, cursor: mode === 'view' ? 'pointer' : 'default',
            fontSize: 10, fontWeight: 700, letterSpacing: 1,
            transition: 'all 0.1s',
            ...(muted
              ? { background: 'linear-gradient(#ff6b6b, #d94848)', color: '#fff', boxShadow: '0 0 8px rgba(255,90,95,0.4)' }
              : { background: '#141b28', border: '1px solid #253045', color: '#3a4a5e' }
            ),
          }}
        >
          MUTE
        </button>
        <button
          onClick={handleSoloClick}
          disabled={!refs.solo || mode !== 'view'}
          style={{
            flex: 1, height: 28, border: 'none', borderRadius: 4,
            cursor: refs.solo && mode === 'view' ? 'pointer' : 'default',
            fontSize: 10, fontWeight: 700, letterSpacing: 1,
            transition: 'all 0.1s',
            opacity: refs.solo ? 1 : 0.3,
            ...(soloed
              ? { background: '#ff8a3d', color: '#fff', boxShadow: '0 0 8px rgba(255,138,61,0.4)' }
              : { background: '#141b28', border: '1px solid #253045', color: '#3a4a5e' }
            ),
          }}
        >
          SOLO
        </button>
      </div>

      {/* ── hostMissing overlay ──────────────────────────────── */}
      {hostMissing && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,14,20,0.7)', fontSize: 16, color: '#ff8a3d',
        }}>
          ⛔
        </div>
      )}
    </div>
  )
})

// ─── MeterBar sub-component ──────────────────────────────────────────────────

interface MeterBarProps {
  db: number
  peak: number
  height: number
}

function MeterBar({ db, peak, height }: MeterBarProps) {
  const fillPct = dbToPercent(db)
  const peakPct = dbToPercent(peak)

  return (
    <div style={{ width: 10, height, position: 'relative', background: '#0a0e14', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
      {/* Meter fill */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: `${fillPct}%`,
        background: 'linear-gradient(to top, #21d07a 0%, #21d07a 55%, #ff8a3d 78%, #ff5a5f 92%, #ff5a5f 100%)',
        borderRadius: '0 0 2px 2px',
        transition: 'height 0.05s linear',
      }} />
      {/* Peak hold line */}
      {peak > -144 && (
        <div style={{
          position: 'absolute',
          left: 0, right: 0, height: 2,
          bottom: `${peakPct}%`,
          background: '#ff5a5f',
          boxShadow: '0 0 3px rgba(255,90,95,0.8)',
        }} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/Elements/ChannelStripElement.tsx
git commit -m "feat(frontend): ChannelStripElement visual component"
```

---

## Task 6: Canvas + PropertiesPanel Integration (Stub)

**Files:**
- Modify: `packages/frontend/src/components/Canvas/Canvas.tsx`
- Modify: `packages/frontend/src/components/PropertiesPanel/PropertiesPanel.tsx`

- [ ] **Step 1: Add channelStrip to renderInner in Canvas.tsx**

Add import at the top of Canvas.tsx:
```typescript
import { ChannelStripElement } from '../Elements/ChannelStripElement'
```

The `renderInner` switch case was already added in Task 3. Verify it's there:
```typescript
case 'channelStrip':
  return <ChannelStripElement element={el} mode={mode} sendPress={sendPress} sendRotate={sendRotate} isContained={isContained} />
```

- [ ] **Step 2: Add channelStrip case to PropertiesPanel.tsx**

Add import:
```typescript
import { ChannelStripProps } from './ChannelStripProps'
```

In `PropertiesPanel.tsx`, find where `singleEl` is rendered (the section that renders element-specific props). It currently has:
```tsx
{singleEl?.type === 'companionButton' && <CompanionButtonProps ... />}
{singleEl?.type === 'shape' && <ShapeProps ... />}
{singleEl?.type === 'label' && <LabelProps ... />}
```

Add after `label`:
```tsx
{singleEl?.type === 'channelStrip' && (
  <ChannelStripProps element={singleEl} panelId={panel!.id} />
)}
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/Canvas/Canvas.tsx packages/frontend/src/components/PropertiesPanel/PropertiesPanel.tsx
git commit -m "feat(frontend): wire channelStrip into Canvas + PropertiesPanel"
```

---

## Task 7: ChannelStripProps.tsx — Properties Panel

**Files:**
- Create: `packages/frontend/src/components/PropertiesPanel/ChannelStripProps.tsx`

- [ ] **Step 1: Create ChannelStripProps**

Create `packages/frontend/src/components/PropertiesPanel/ChannelStripProps.tsx`:

```tsx
/**
 * ChannelStripProps.tsx
 *
 * Properties Panel Section für das ChannelStrip-Element.
 * Sections: Refs, Text-Parsing, Style
 * Alle Wizard-Felder sind hier auch im Edit-Mode zugänglich.
 */
import { ChannelStripElement, CompanionRef } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { NumericInput } from './NumericInput'
import { ColorPicker } from './ColorPicker'

interface Props {
  element: ChannelStripElement
  panelId: string
}

const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#8896aa', letterSpacing: 1,
  textTransform: 'uppercase', padding: '10px 14px 4px', borderTop: '1px solid #1e2535',
}
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', padding: '4px 14px', gap: 8 }
const lbl: React.CSSProperties = { fontSize: 12, color: '#8896aa', flex: 1, minWidth: 0 }
const inputStyle: React.CSSProperties = { flex: 1, background: '#121821', border: '1px solid #2a3344', borderRadius: 4, color: '#e9edf2', fontSize: 13, padding: '4px 8px', minWidth: 0 }

function refLabel(ref: CompanionRef | undefined): string {
  if (!ref) return '—'
  return `${ref.page}/${ref.row}/${ref.col} @ ${ref.hostId.slice(0, 8)}`
}

export function ChannelStripProps({ element, panelId }: Props) {
  const updateElement = useAppStore((s) => s.updateElement)

  function patch(partial: Partial<ChannelStripElement>) {
    updateElement(panelId, element.id, partial)
  }

  function patchStyle(partial: Partial<ChannelStripElement['style']>) {
    patch({ style: { ...element.style, ...partial } })
  }

  function patchButton(partial: Partial<ChannelStripElement['refs']['button']>) {
    patch({ refs: { ...element.refs, button: { ...element.refs.button, ...partial } } })
  }

  const { style, refs } = element

  return (
    <>
      {/* ── Refs ───────────────────────────────────────────── */}
      <div style={sectionTitle}>Refs</div>

      <div style={row}>
        <span style={lbl}>Button (Main)</span>
        <span style={{ fontSize: 11, color: '#4a9eff', fontFamily: "'JetBrains Mono', monospace" }}>
          {refLabel(refs.button.ref)}
        </span>
      </div>

      <div style={row}>
        <span style={lbl}>Solo (optional)</span>
        <span style={{ fontSize: 11, color: refs.solo ? '#4a9eff' : '#4a5568', fontFamily: "'JetBrains Mono', monospace" }}>
          {refLabel(refs.solo)}
        </span>
      </div>

      <div style={row}>
        <span style={lbl}>Pan (optional)</span>
        <span style={{ fontSize: 11, color: refs.pan ? '#4a9eff' : '#4a5568', fontFamily: "'JetBrains Mono', monospace" }}>
          {refLabel(refs.pan)}
        </span>
      </div>

      {/* ── Text-Parsing ────────────────────────────────────── */}
      <div style={sectionTitle}>Text-Parsing</div>

      <div style={row}>
        <span style={lbl}>Separator</span>
        <input
          style={{ ...inputStyle, maxWidth: 50 }}
          value={refs.button.textSeparator ?? '|'}
          onChange={(e) => patchButton({ textSeparator: e.target.value })}
        />
      </div>

      <NumericInput label="Meter L Index" value={refs.button.meterLIndex ?? 0} min={0}
        onChange={(v) => patchButton({ meterLIndex: v })} />

      <div style={row}>
        <span style={lbl}>Meter R Index</span>
        <input
          type="number" min={0}
          style={{ ...inputStyle, maxWidth: 60 }}
          value={refs.button.meterRIndex ?? ''}
          placeholder="—"
          onChange={(e) => {
            const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10)
            patchButton({ meterRIndex: v })
          }}
        />
      </div>

      <div style={row}>
        <span style={lbl}>Level Index</span>
        <input
          type="number" min={0}
          style={{ ...inputStyle, maxWidth: 60 }}
          value={refs.button.levelIndex ?? ''}
          placeholder="—"
          onChange={(e) => {
            const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10)
            patchButton({ levelIndex: v })
          }}
        />
      </div>

      <div style={row}>
        <span style={lbl}>Name Index</span>
        <input
          type="number" min={0}
          style={{ ...inputStyle, maxWidth: 60 }}
          value={refs.button.nameIndex ?? ''}
          placeholder="—"
          onChange={(e) => {
            const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10)
            patchButton({ nameIndex: v })
          }}
        />
      </div>

      {/* ── Style ───────────────────────────────────────────── */}
      <div style={sectionTitle}>Style</div>

      <div style={row}>
        <span style={lbl}>Stripe Color</span>
        <ColorPicker value={style.color} onChange={(c) => patchStyle({ color: c })} />
      </div>

      <div style={row}>
        <span style={lbl}>Name (Fallback)</span>
        <input
          style={inputStyle}
          value={style.name ?? ''}
          placeholder="Channel"
          onChange={(e) => patchStyle({ name: e.target.value || undefined })}
        />
      </div>

      <div style={row}>
        <span style={lbl}>Mono</span>
        <input
          type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }}
          checked={style.mono === true}
          onChange={(e) => patchStyle({ mono: e.target.checked || undefined })}
        />
      </div>

      <NumericInput label="Clip Threshold (dBFS)" value={style.clipThreshold ?? 0} min={-60} max={0}
        onChange={(v) => patchStyle({ clipThreshold: v })} />

      <NumericInput label="Coarse Multiplier" value={style.coarseMultiplier ?? 10} min={1} max={100}
        onChange={(v) => patchStyle({ coarseMultiplier: v })} />
    </>
  )
}
```

- [ ] **Step 2: Add `updateElement` to the store (if not already present)**

Check `useAppStore.ts` for `updateElement`. If missing, add it:

```typescript
// In AppStore interface:
updateElement: (panelId: string, elementId: string, patch: Partial<AnyElement>) => void

// In create():
updateElement: (panelId, elementId, patch) =>
  set((s) => {
    if (!s.settings) return s
    return {
      settings: {
        ...s.settings,
        panels: s.settings.panels.map((p) =>
          p.id !== panelId ? p : {
            ...p,
            elements: p.elements.map((el) =>
              el.id !== elementId ? el : { ...el, ...patch } as AnyElement
            ),
          }
        ),
      },
    }
  }),
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/PropertiesPanel/ChannelStripProps.tsx packages/frontend/src/store/useAppStore.ts
git commit -m "feat(frontend): ChannelStripProps properties panel section"
```

---

## Task 8: ChannelStripWizard + AddElementMenu Integration

**Files:**
- Create: `packages/frontend/src/components/AddElement/ChannelStripWizard.tsx`
- Modify: `packages/frontend/src/components/AddElement/AddElementMenu.tsx`

- [ ] **Step 1: Create ChannelStripWizard.tsx**

Create `packages/frontend/src/components/AddElement/ChannelStripWizard.tsx`:

```tsx
/**
 * ChannelStripWizard.tsx
 *
 * 5-Schritt-Setup-Wizard für das ChannelStrip-Element.
 * Schritt 1: Haupt-Button wählen (Button Picker)
 * Schritt 2: Text-Variablen konfigurieren (Separator + Index-Mapping)
 * Schritt 3: Optionale Refs (Solo, Pan)
 * Schritt 4: Style (Farbe, Mono, Schwellenwerte)
 * Schritt 5: Zusammenfassung + Fertig
 *
 * Bei Fertig: onConfirm wird mit dem fertigen ChannelStripElement-Draft aufgerufen.
 */
import { useState } from 'react'
import { ChannelStripElement, CompanionRef } from '@cwp/shared'
import { CompanionButtonPickerDialog } from './CompanionButtonPickerDialog'
import { NumericInput } from '../PropertiesPanel/NumericInput'
import { ColorPicker } from '../PropertiesPanel/ColorPicker'
import { parseChannelStripText } from '../../utils/channelStrip'
import { useAppStore } from '../../store/useAppStore'

type Draft = Omit<ChannelStripElement, 'id' | 'x' | 'y' | 'w' | 'h' | 'z'>

interface Props {
  canvasPos: { x: number; y: number }
  onConfirm: (element: Omit<ChannelStripElement, 'id'>) => void
  onClose: () => void
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const modal: React.CSSProperties = {
  background: '#121821', border: '1px solid #2a3344', borderRadius: 12,
  width: 420, maxWidth: '90vw', padding: '0 0 20px',
  boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
  display: 'flex', flexDirection: 'column', gap: 0,
}
const header: React.CSSProperties = {
  padding: '16px 20px 12px',
  borderBottom: '1px solid #1e2535',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}
const stepIndicator = (active: boolean): React.CSSProperties => ({
  width: 8, height: 8, borderRadius: '50%',
  background: active ? '#4a9eff' : '#2a3344',
  transition: 'background 0.2s',
})
const body: React.CSSProperties = { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }
const footer: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '0 20px' }
const btnPrimary: React.CSSProperties = {
  background: '#4a9eff', border: 'none', borderRadius: 6, color: '#fff',
  fontSize: 13, fontWeight: 600, padding: '8px 20px', cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = {
  background: 'transparent', border: '1px solid #2a3344', borderRadius: 6, color: '#8896aa',
  fontSize: 13, padding: '8px 20px', cursor: 'pointer',
}
const infoBox: React.CSSProperties = {
  background: '#0f141a', border: '1px solid #1e2535', borderRadius: 6,
  padding: '10px 12px', fontSize: 12, color: '#8896aa', lineHeight: 1.6,
}

export function ChannelStripWizard({ canvasPos, onConfirm, onClose }: Props) {
  const [step, setStep] = useState(1)
  const [pickerTarget, setPickerTarget] = useState<'button' | 'solo' | 'pan' | null>(null)

  // Draft state
  const [buttonRef, setButtonRef] = useState<CompanionRef | null>(null)
  const [separator, setSeparator] = useState('|')
  const [meterLIndex, setMeterLIndex] = useState(0)
  const [meterRIndex, setMeterRIndex] = useState<number | undefined>(undefined)
  const [levelIndex, setLevelIndex] = useState<number | undefined>(undefined)
  const [nameIndex, setNameIndex] = useState<number | undefined>(undefined)
  const [soloRef, setSoloRef] = useState<CompanionRef | undefined>(undefined)
  const [panRef, setPanRef] = useState<CompanionRef | undefined>(undefined)
  const [color, setColor] = useState('#4a9eff')
  const [name, setName] = useState('')
  const [mono, setMono] = useState(false)
  const [clipThreshold, setClipThreshold] = useState(0)
  const [coarseMultiplier, setCoarseMultiplier] = useState(10)

  // Live preview of parsed text (Step 2)
  const buttonState = useAppStore((s) =>
    buttonRef ? s.getButtonState(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col) : undefined
  )
  const parsedPreview = buttonRef
    ? parseChannelStripText(buttonState?.text ?? '', separator, { meterLIndex, meterRIndex, levelIndex, nameIndex })
    : null

  const handleConfirm = () => {
    if (!buttonRef) return
    const draft: Omit<ChannelStripElement, 'id'> = {
      type: 'channelStrip',
      x: canvasPos.x, y: canvasPos.y, w: 80, h: 240, z: 0,
      style: { color, name: name || undefined, mono: mono || undefined, clipThreshold, coarseMultiplier },
      refs: {
        button: { ref: buttonRef, textSeparator: separator, meterLIndex, meterRIndex, levelIndex, nameIndex },
        solo: soloRef,
        pan: panRef,
      },
    }
    onConfirm(draft)
  }

  const TITLES = ['', 'Haupt-Button', 'Text-Variablen', 'Optionale Refs', 'Style', 'Zusammenfassung']

  return (
    <>
      <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div style={modal}>
          {/* Header */}
          <div style={header}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#e9edf2' }}>
                Channel Strip einrichten
              </div>
              <div style={{ fontSize: 12, color: '#8896aa', marginTop: 2 }}>
                Schritt {step} von 5 — {TITLES[step]}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[1,2,3,4,5].map((s) => <div key={s} style={stepIndicator(s === step)} />)}
              <button onClick={onClose} style={{ ...btnSecondary, padding: '4px 8px', marginLeft: 8 }}>✕</button>
            </div>
          </div>

          {/* Step 1: Button Picker */}
          {step === 1 && (
            <div style={body}>
              <div style={infoBox}>
                Wähle den Button der Mute, Fader-Control und Messwerte enthält.<br />
                In Companion konfigurieren: <strong>Press</strong> = Mute-Action,{' '}
                <strong>Rotate</strong> = Fader-Action,{' '}
                <strong>Text-Feld</strong> = Variablen (z.B. <code>$(vmix:input_1_meterf1)|$(vmix:input_1_volume_db)</code>).
              </div>
              <button
                style={{ ...btnPrimary, alignSelf: 'flex-start' }}
                onClick={() => setPickerTarget('button')}
              >
                {buttonRef ? `Button: ${buttonRef.page}/${buttonRef.row}/${buttonRef.col}` : 'Button wählen...'}
              </button>
              {buttonRef && (
                <div style={{ fontSize: 12, color: '#21d07a' }}>✓ Host: {buttonRef.hostId}</div>
              )}
            </div>
          )}

          {/* Step 2: Text Variables */}
          {step === 2 && (
            <div style={body}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#8896aa', minWidth: 80 }}>Separator</span>
                <input
                  style={{ background: '#0f141a', border: '1px solid #2a3344', borderRadius: 4, color: '#e9edf2', fontSize: 13, padding: '4px 8px', width: 60 }}
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                />
              </div>
              {parsedPreview && (
                <div style={{ ...infoBox, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                  <strong style={{ color: '#e9edf2' }}>Live-Vorschau:</strong><br />
                  Meter L: {parsedPreview.meterL ?? '—'}{' '}
                  Meter R: {parsedPreview.meterR ?? '—'}{' '}
                  Level: {parsedPreview.level ?? '—'}{' '}
                  Name: {parsedPreview.name ?? '—'}
                </div>
              )}
              <NumericInput label="Meter L Index" value={meterLIndex} min={0} onChange={setMeterLIndex} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#8896aa', flex: 1 }}>Meter R Index (optional)</span>
                <input type="number" min={0} placeholder="—" value={meterRIndex ?? ''}
                  style={{ background: '#0f141a', border: '1px solid #2a3344', borderRadius: 4, color: '#e9edf2', fontSize: 13, padding: '4px 8px', width: 60 }}
                  onChange={(e) => setMeterRIndex(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#8896aa', flex: 1 }}>Fader Level Index (optional)</span>
                <input type="number" min={0} placeholder="—" value={levelIndex ?? ''}
                  style={{ background: '#0f141a', border: '1px solid #2a3344', borderRadius: 4, color: '#e9edf2', fontSize: 13, padding: '4px 8px', width: 60 }}
                  onChange={(e) => setLevelIndex(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#8896aa', flex: 1 }}>Name Index (optional)</span>
                <input type="number" min={0} placeholder="—" value={nameIndex ?? ''}
                  style={{ background: '#0f141a', border: '1px solid #2a3344', borderRadius: 4, color: '#e9edf2', fontSize: 13, padding: '4px 8px', width: 60 }}
                  onChange={(e) => setNameIndex(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                />
              </div>
            </div>
          )}

          {/* Step 3: Optional Refs */}
          {step === 3 && (
            <div style={body}>
              <div>
                <div style={{ fontSize: 12, color: '#8896aa', marginBottom: 6 }}>Solo-Button (optional)</div>
                <button style={{ ...btnSecondary, fontSize: 12 }} onClick={() => setPickerTarget('solo')}>
                  {soloRef ? `Solo: ${soloRef.page}/${soloRef.row}/${soloRef.col}` : 'Solo-Button wählen...'}
                </button>
                {soloRef && (
                  <button style={{ ...btnSecondary, fontSize: 11, marginLeft: 8 }} onClick={() => setSoloRef(undefined)}>
                    entfernen
                  </button>
                )}
                <div style={{ ...infoBox, marginTop: 8 }}>Ohne Solo-Button: Solo-Taste ausgegraut</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#8896aa', marginBottom: 6 }}>Pan-Button (optional)</div>
                <button style={{ ...btnSecondary, fontSize: 12 }} onClick={() => setPickerTarget('pan')}>
                  {panRef ? `Pan: ${panRef.page}/${panRef.row}/${panRef.col}` : 'Pan-Button wählen...'}
                </button>
                {panRef && (
                  <button style={{ ...btnSecondary, fontSize: 11, marginLeft: 8 }} onClick={() => setPanRef(undefined)}>
                    entfernen
                  </button>
                )}
                <div style={{ ...infoBox, marginTop: 8 }}>
                  Pan aus Text-Variable, z.B. <code>$(vmix:input_1_pan)</code>. Unterstützte Formate: L20, R10, C, -0.5
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Style */}
          {step === 4 && (
            <div style={body}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#8896aa', flex: 1 }}>Stripe-Farbe</span>
                <ColorPicker value={color} onChange={setColor} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#8896aa', flex: 1 }}>Channel-Name (Fallback)</span>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="z.B. Guitar"
                  style={{ background: '#0f141a', border: '1px solid #2a3344', borderRadius: 4, color: '#e9edf2', fontSize: 13, padding: '4px 8px', flex: 1 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#8896aa', flex: 1 }}>Mono-Modus</span>
                <input type="checkbox" style={{ width: 20, height: 20 }} checked={mono} onChange={(e) => setMono(e.target.checked)} />
              </div>
              <NumericInput label="Clip-Schwellenwert (dBFS)" value={clipThreshold} min={-60} max={0} onChange={setClipThreshold} />
              <NumericInput label="Coarse-Multiplier (Shift+Scroll)" value={coarseMultiplier} min={1} max={100} onChange={setCoarseMultiplier} />
              <div style={infoBox}>
                Shift+Scroll sendet {coarseMultiplier}× SUB-ROTATE = {coarseMultiplier} Feinschritte = 1 grober Schritt.{' '}
                Passe an die Companion-Action-Schrittweite an.
              </div>
            </div>
          )}

          {/* Step 5: Summary */}
          {step === 5 && (
            <div style={body}>
              <div style={{ ...infoBox, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div><strong style={{ color: '#e9edf2' }}>Button:</strong> {buttonRef ? `${buttonRef.page}/${buttonRef.row}/${buttonRef.col}` : '—'}</div>
                <div><strong style={{ color: '#e9edf2' }}>Separator:</strong> "{separator}"</div>
                <div><strong style={{ color: '#e9edf2' }}>Meter L/R:</strong> Index {meterLIndex} / {meterRIndex ?? '—'}</div>
                <div><strong style={{ color: '#e9edf2' }}>Level:</strong> Index {levelIndex ?? '—'}</div>
                <div><strong style={{ color: '#e9edf2' }}>Name:</strong> Index {nameIndex ?? '—'} (Fallback: "{name || '—'}")</div>
                <div><strong style={{ color: '#e9edf2' }}>Solo:</strong> {soloRef ? `${soloRef.page}/${soloRef.row}/${soloRef.col}` : '—'}</div>
                <div><strong style={{ color: '#e9edf2' }}>Pan:</strong> {panRef ? `${panRef.page}/${panRef.row}/${panRef.col}` : '—'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ color: '#e9edf2' }}>Stripe-Farbe:</strong>
                  <div style={{ width: 16, height: 16, borderRadius: 3, background: color, border: '1px solid #2a3344' }} />
                  {color}
                </div>
                <div><strong style={{ color: '#e9edf2' }}>Mono:</strong> {mono ? 'Ja' : 'Nein'} · <strong style={{ color: '#e9edf2' }}>Clip:</strong> {clipThreshold} dBFS · <strong style={{ color: '#e9edf2' }}>Coarse:</strong> {coarseMultiplier}×</div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={footer}>
            <button style={btnSecondary} onClick={() => step > 1 ? setStep(step - 1) : onClose()}>
              {step === 1 ? 'Abbrechen' : '← Zurück'}
            </button>
            {step < 5 ? (
              <button
                style={{ ...btnPrimary, opacity: step === 1 && !buttonRef ? 0.5 : 1 }}
                disabled={step === 1 && !buttonRef}
                onClick={() => setStep(step + 1)}
              >
                Weiter →
              </button>
            ) : (
              <button style={btnPrimary} onClick={handleConfirm}>
                Fertig — Element erstellen
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Button Picker (Schritt 1, 3) */}
      {pickerTarget && (
        <CompanionButtonPickerDialog
          onConfirm={(ref) => {
            if (pickerTarget === 'button') setButtonRef(ref)
            else if (pickerTarget === 'solo') setSoloRef(ref)
            else if (pickerTarget === 'pan') setPanRef(ref)
            setPickerTarget(null)
          }}
          onClose={() => setPickerTarget(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Add channelStrip to AddElementMenu**

In `AddElementMenu.tsx`, update `MENU_ITEMS`:

```typescript
const MENU_ITEMS = [
  { type: 'companionButton', label: 'Companion Button', icon: '⊞' },
  { type: 'channelStrip',    label: 'Channel Strip',    icon: '🎚' },
  { type: 'label',           label: 'Label',            icon: 'T' },
  { type: 'shape',           label: 'Shape',            icon: '▭' },
] as const
```

Add wizard state:
```typescript
const [wizardOpen, setWizardOpen] = useState(false)
```

Update `handleSelect` to handle `channelStrip`:
```typescript
const handleSelect = (type: 'companionButton' | 'channelStrip' | 'label' | 'shape') => {
  if (type === 'companionButton') {
    setPickerOpen(true)
    return
  }
  if (type === 'channelStrip') {
    setWizardOpen(true)
    return
  }
  addElement(panelId, makeDefault(type, canvasPos))
  onClose()
}
```

Add wizard confirm handler:
```typescript
const handleWizardConfirm = (draft: Omit<import('@cwp/shared').ChannelStripElement, 'id'>) => {
  const id = crypto.randomUUID()
  addElement(panelId, { id, ...draft } as import('@cwp/shared').AnyElement)
  onClose()
}
```

Add wizard in return JSX (after the picker):
```tsx
{wizardOpen && (
  <ChannelStripWizard
    canvasPos={canvasPos}
    onConfirm={handleWizardConfirm}
    onClose={() => { setWizardOpen(false); onClose() }}
  />
)}
```

Add import at top:
```typescript
import { ChannelStripWizard } from './ChannelStripWizard'
```

- [ ] **Step 3: TypeScript check + full test run**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
npx vitest run
```

Expected: TS no errors, all tests green.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/AddElement/ChannelStripWizard.tsx packages/frontend/src/components/AddElement/AddElementMenu.tsx
git commit -m "feat(frontend): ChannelStripWizard + AddElementMenu integration"
```

---

## Post-Implementation: Manual Smoke-Test

Before calling Phase 7 complete, verify in the running app:

- [ ] `npm run dev` starts without errors
- [ ] Edit-Mode: `+` menu shows "Channel Strip" entry
- [ ] Wizard opens, Button Picker works in Step 1
- [ ] Fertig creates element on Canvas at correct position
- [ ] View-Mode: Drum Wheel responds to scroll (check Network/WS tab: `{t:"rotate",...}`)
- [ ] Mute button click sends press to Companion (`{t:"press",...}`)
- [ ] PropertiesPanel shows ChannelStrip section when element selected in Edit-Mode
- [ ] Backend handles `rotate` message without errors (check terminal output)

---

## Self-Review

**Spec coverage check:**
- ✅ `ChannelStripElement` type — Task 1
- ✅ `SUB-ROTATE` protocol — Task 2
- ✅ `buildDesiredSubs` for all 3 refs — Task 2
- ✅ `sendRotate` WS hook — Task 3
- ✅ `parseChannelStripText`, `parsePanValue`, `isMuted` + tests — Task 4
- ✅ Color Stripe + Clip LED + CSS blink — Task 5
- ✅ Pan Indicator (ausgegraut wenn mono/fehlend) — Task 5
- ✅ Meter Bars L+R + Peak Hold — Task 5
- ✅ Fader Track + dB-Anzeige — Task 5
- ✅ Drum Wheel (Drag + Scroll + Shift coarse + Doppelklick Unity) — Task 5
- ✅ Mute Button (aktiv/inaktiv via isMuted) — Task 5
- ✅ Solo Button (ausgegraut wenn kein soloRef) — Task 5
- ✅ `isContained` Pattern — Task 5
- ✅ `hostMissing` overlay — Task 5
- ✅ Canvas renderInner case — Task 6
- ✅ PropertiesPanel switch — Task 6
- ✅ ChannelStripProps (alle Felder editierbar) — Task 7
- ✅ Setup-Wizard 5 Schritte — Task 8
- ✅ AddElementMenu Integration — Task 8

**Offen (CLAUDE.md "Not in MVP"):**
- GR Meter — kein Plugin liefert dies
- Proportionales Multi-Select Resize
- Animierter Meter-Fallback ohne Companion

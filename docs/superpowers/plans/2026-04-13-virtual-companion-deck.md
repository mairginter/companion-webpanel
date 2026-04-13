# Virtual Companion Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `virtualCompanionDeck` canvas element that registers as a real Companion Surface (ADD-DEVICE), renders a scalable button grid with Companion button states, and sends KEY-PRESS on click.

**Architecture:** A new `VirtualSurfaceSession` class (one per element) opens its own WebSocket to Companion and speaks ADD-DEVICE / KEY-STATE / KEY-PRESS. A `VirtualSurfaceManager` orchestrates sessions. New `vDelta`/`vSnapshot`/`vPress` WS messages connect backend to frontend store. The React element renders a CSS-Grid that scales with the element's `w`/`h`, each cell using the same rendering logic as `CompanionButtonElement`.

**Tech Stack:** TypeScript, Node.js `ws`, React 18, Zustand, Vitest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `packages/shared/src/types.ts` | Modify | `VirtualCompanionDeckElement` type + new WS messages |
| `CompanionWebpannelSettings.schema.json` | Modify | Add `virtualCompanionDeck` element + version 1.4.0 |
| `CompanionWebpannelSettings.json` | Modify | Version bump to 1.4.0 |
| `packages/backend/package.json` | Modify | Add vitest devDependency |
| `packages/backend/src/satellite/VirtualSurfaceSession.ts` | Create | ADD-DEVICE / KEY-STATE / KEY-PRESS session |
| `packages/backend/src/satellite/VirtualSurfaceSession.test.ts` | Create | Unit tests |
| `packages/backend/src/state/StateStore.ts` | Modify | Virtual keys store + setVirtualKey/getVirtualSnapshot/clearVirtualKeys |
| `packages/backend/src/state/StateStore.test.ts` | Create | StateStore virtual key tests |
| `packages/backend/src/VirtualSurfaceManager.ts` | Create | Manages session instances, diffs on settings change |
| `packages/backend/src/VirtualSurfaceManager.test.ts` | Create | Manager tests |
| `packages/backend/src/server/ClientServer.ts` | Modify | `vPress` WS handler, schema version 1.4.0, `onVPress` callback |
| `packages/backend/src/HostManager.ts` | Modify | Instantiate + call `virtualSurfaceManager.sync()` |
| `packages/backend/src/standalone.ts` | Modify | Version string 1.4.0 |
| `packages/frontend/src/store/useAppStore.ts` | Modify | `virtualKeys` + `virtualSessionStatus` state + actions |
| `packages/frontend/src/store/useAppStore.test.ts` | Modify | Virtual store action tests |
| `packages/frontend/src/ws/useWebSocket.ts` | Modify | Handle `vDelta`/`vSnapshot`/`vSessionStatus`, `sendVPress` |
| `packages/frontend/src/components/Elements/VirtualCompanionDeckElement.tsx` | Create | Grid renderer |
| `packages/frontend/src/components/PropertiesPanel/VirtualCompanionDeckProps.tsx` | Create | Properties block |
| `packages/frontend/src/components/AddElement/VirtualCompanionDeckWizard.tsx` | Create | 3-step wizard |
| `packages/frontend/src/components/AddElement/AddElementMenu.tsx` | Modify | Add virtualCompanionDeck entry |
| `packages/frontend/src/components/Canvas/Canvas.tsx` | Modify | Render VirtualCompanionDeckElement |
| `packages/frontend/src/components/PropertiesPanel/PropertiesPanel.tsx` | Modify | VirtualCompanionDeckProps block |

---

### Task 1: Shared Types + Schema Version 1.4.0

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `CompanionWebpannelSettings.schema.json`
- Modify: `CompanionWebpannelSettings.json`

- [ ] **Step 1: Add VirtualCompanionDeckElement to types.ts**

In `packages/shared/src/types.ts`, add after `ChannelStripElement`:

```typescript
export interface VirtualCompanionDeckElement extends BaseElement {
  type: 'virtualCompanionDeck'
  /** Host-ID aus settings.hosts — gegen diesen Host wird ADD-DEVICE gesendet */
  hostId: string
  /** Stabile Device-ID (Format: "cwp-<8hex>"), einmalig generiert, persistent */
  deviceId: string
  /** Surface-Name wie er in Companions Surface-Configuration-UI erscheint */
  surfaceName: string
  /** Grid-Konfiguration: cols = KEYS_PER_ROW, rows × cols = KEYS_TOTAL */
  grid: { cols: number; rows: number }
  /** Hintergrund-Shape des Decks */
  style: {
    fill: string         // Hintergrundfarbe hex, Default '#1e3a5f'
    opacity: number      // 0–1, Default 0.85
    borderRadius: number // px, Default 8
    padding: number      // px rundum (innen), Default 8
    gap: number          // px zwischen Buttons, Default 5
  }
  /** Button-Darstellung (deck-weit, identisch zu CompanionButtonElement.render) */
  render?: {
    showBitmap?: boolean    // Default false
    scaleBitmap?: boolean   // Default true
    showText?: boolean      // Default true
    showBgColor?: boolean   // Default true
    borderRadius?: number   // Button-Eckenradius px, Default 4
    fontSize?: number       // Text-Overlay px, Default 11
    textAlign?: 'center' | 'top' | 'bottom'
  }
}
```

- [ ] **Step 2: Extend AnyElement union**

In `packages/shared/src/types.ts`, update `AnyElement`:

```typescript
export type AnyElement =
  | CompanionButtonElement
  | ShapeElement
  | LabelElement
  | MeterElement
  | ChannelStripElement
  | VirtualCompanionDeckElement
```

- [ ] **Step 3: Add WS message types**

In `packages/shared/src/types.ts`, add after `RotateMessage`:

```typescript
/** Backend → Frontend: ein Virtual-Deck-Button hat sich geändert */
export interface VDeltaMessage {
  t: 'vDelta'
  deviceId: string
  keyIndex: number
  bgColor?: string
  textColor?: string
  text?: string
  bitmap?: string
}

/** Backend → Frontend: kompletter Snapshot aller Keys eines Virtual Decks — bei Connect */
export interface VSnapshotMessage {
  t: 'vSnapshot'
  deviceId: string
  /** keyIndex (Zahl als String-Key) → KeyState */
  keys: Record<number, KeyState>
}

/** Backend → Frontend: Verbindungsstatus einer VirtualSurfaceSession */
export interface VSessionStatusMessage {
  t: 'vSessionStatus'
  deviceId: string
  status: 'connecting' | 'connected' | 'stale' | 'error'
}

/** Frontend → Backend: User klickt Button im Virtual Deck */
export interface VPressMessage {
  t: 'vPress'
  deviceId: string
  keyIndex: number
  pressed: boolean
}
```

- [ ] **Step 4: Extend message union types**

In `packages/shared/src/types.ts`, update the union types:

```typescript
export type BackendToFrontend =
  | DeltaMessage
  | SnapshotMessage
  | SessionStatusMessage
  | HostInfoMessage
  | VDeltaMessage
  | VSnapshotMessage
  | VSessionStatusMessage

export type FrontendToBackend = PressMessage | RotateMessage | VPressMessage
```

- [ ] **Step 5: Bump schema version in schema.json**

In `CompanionWebpannelSettings.schema.json`, change `"1.3.0"` to `"1.4.0"` in the version field, and add `"virtualCompanionDeck"` to the element type definitions. Find the section where `"channelStrip"` is defined and add after it:

```json
{
  "if": { "properties": { "type": { "const": "virtualCompanionDeck" } } },
  "then": {
    "required": ["type", "hostId", "deviceId", "surfaceName", "grid", "style"],
    "properties": {
      "type": { "const": "virtualCompanionDeck" },
      "hostId": { "type": "string" },
      "deviceId": { "type": "string", "pattern": "^cwp-[0-9a-f]{8}$" },
      "surfaceName": { "type": "string" },
      "grid": {
        "type": "object",
        "required": ["cols", "rows"],
        "properties": {
          "cols": { "type": "integer", "minimum": 1, "maximum": 32 },
          "rows": { "type": "integer", "minimum": 1, "maximum": 32 }
        }
      },
      "style": {
        "type": "object",
        "required": ["fill", "opacity", "borderRadius", "padding", "gap"],
        "properties": {
          "fill": { "type": "string" },
          "opacity": { "type": "number", "minimum": 0, "maximum": 1 },
          "borderRadius": { "type": "integer", "minimum": 0 },
          "padding": { "type": "integer", "minimum": 0 },
          "gap": { "type": "integer", "minimum": 0 }
        }
      },
      "render": { "type": "object" }
    }
  }
}
```

- [ ] **Step 6: Bump version in settings.json**

In `CompanionWebpannelSettings.json`, change `"version": "1.3.0"` to `"version": "1.4.0"`.

- [ ] **Step 7: Build shared**

```bash
npm run build -w @cwp/shared
```

Expected: no errors, `dist/` updated.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/types.ts CompanionWebpannelSettings.schema.json CompanionWebpannelSettings.json
git commit -m "feat(types): VirtualCompanionDeckElement + vDelta/vSnapshot/vPress WS types, schema v1.4.0"
```

---

### Task 2: VirtualSurfaceSession

**Files:**
- Create: `packages/backend/src/satellite/VirtualSurfaceSession.ts`

- [ ] **Step 1: Create VirtualSurfaceSession.ts**

```typescript
/**
 * VirtualSurfaceSession.ts
 *
 * Verwaltet eine Companion Satellite-Verbindung als registriertes Surface (ADD-DEVICE).
 * Im Gegensatz zu SatelliteClient (ADD-SUB) registriert sich diese Session als echtes
 * StreamDeck-ähnliches Gerät — Companion weist ihr eine Seite über die Surface-
 * Configuration-UI zu und sendet KEY-STATE für alle Buttons des Grids.
 *
 * Aufgaben:
 *  - ADD-DEVICE mit deviceId, surfaceName, cols × rows senden
 *  - KEY-STATE-Nachrichten parsen → 'keyState'-Events emittieren
 *  - KEY-PRESS senden (View-Mode Button-Klick im Frontend)
 *  - PING/PONG Keepalive
 *  - Exponential Backoff Reconnect mit Re-ADD-DEVICE
 */
import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { KeyState } from '@cwp/shared'

export type VirtualSurfaceStatus = 'connecting' | 'connected' | 'stale' | 'error'

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000]
const KEEPALIVE_INTERVAL_MS = 2000
const KEEPALIVE_TIMEOUT_MS  = 6000

/**
 * Eine Satellite-Verbindung als ADD-DEVICE Surface.
 * 1 Instanz pro virtualCompanionDeck-Element.
 *
 * Events:
 *  'keyState'  (keyIndex: number, state: Partial<KeyState>)
 *  'status'    (status: VirtualSurfaceStatus)
 */
export class VirtualSurfaceSession extends EventEmitter {
  readonly deviceId: string

  private surfaceName: string
  private cols: number
  private rows: number
  private host: string
  private port: number

  private ws: WebSocket | null = null
  private lineBuffer = ''
  private status: VirtualSurfaceStatus = 'connecting'
  private destroyed = false

  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempt = 0
  private keepaliveTimer: NodeJS.Timeout | null = null
  private keepaliveTimeoutTimer: NodeJS.Timeout | null = null

  constructor(
    deviceId: string,
    surfaceName: string,
    cols: number,
    rows: number,
    host: string,
    port: number,
  ) {
    super()
    this.deviceId = deviceId
    this.surfaceName = surfaceName
    this.cols = cols
    this.rows = rows
    this.host = host
    this.port = port
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  start(): void {
    if (this.destroyed) return
    this.connect()
  }

  async stop(): Promise<void> {
    this.destroyed = true
    this.clearTimers()
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendLine(`REMOVE-DEVICE DEVICEID="${this.deviceId}"`)
      await new Promise(r => setTimeout(r, 150))
    }
    this.ws?.close()
    this.ws = null
  }

  sendKeyPress(keyIndex: number, pressed: boolean): void {
    if (this.status !== 'connected') {
      console.warn(`[VirtualSurface ${this.deviceId}] sendKeyPress ignoriert — status=${this.status}`)
      return
    }
    const pressedStr = pressed ? 'true' : 'false'
    this.sendLine(`KEY-PRESS DEVICEID="${this.deviceId}" KEY=${keyIndex} PRESSED=${pressedStr}`)
  }

  getStatus(): VirtualSurfaceStatus {
    return this.status
  }

  // ─── Connection ────────────────────────────────────────────────────────────

  private connect(): void {
    this.setStatus('connecting')
    this.lineBuffer = ''

    const url = `ws://${this.host}:${this.port}`
    console.log(`[VirtualSurface ${this.deviceId}] Verbinde zu ${url}`)
    const socket = new WebSocket(url)
    this.ws = socket

    socket.on('open', () => {
      this.reconnectAttempt = 0
      console.log(`[VirtualSurface ${this.deviceId}] WebSocket verbunden`)
    })

    socket.on('message', (data: WebSocket.RawData) => {
      this.lineBuffer += data.toString()
      const lines = this.lineBuffer.split('\n')
      this.lineBuffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed) this.handleLine(trimmed)
      }
    })

    socket.on('close', () => {
      console.log(`[VirtualSurface ${this.deviceId}] Verbindung getrennt`)
      this.clearTimers()
      if (!this.destroyed) {
        this.setStatus('stale')
        this.scheduleReconnect()
      }
    })

    socket.on('error', (err: Error) => {
      console.error(`[VirtualSurface ${this.deviceId}] Fehler: ${err.message}`)
      this.clearTimers()
      if (!this.destroyed) {
        this.setStatus('error')
        this.scheduleReconnect()
      }
    })
  }

  private scheduleReconnect(): void {
    const delayMs = BACKOFF_MS[Math.min(this.reconnectAttempt, BACKOFF_MS.length - 1)]
    this.reconnectAttempt++
    console.log(`[VirtualSurface ${this.deviceId}] Reconnect in ${delayMs}ms`)
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) this.connect()
    }, delayMs)
  }

  // ─── Protocol ──────────────────────────────────────────────────────────────

  private handleLine(line: string): void {
    if (line.startsWith('BEGIN ')) {
      this.sendAddDevice()
    } else if (line.startsWith('ADD-DEVICE OK')) {
      console.log(`[VirtualSurface ${this.deviceId}] Surface registriert ✓`)
      this.setStatus('connected')
      this.startKeepalive()
    } else if (line.startsWith('ADD-DEVICE ERROR')) {
      console.error(`[VirtualSurface ${this.deviceId}] ADD-DEVICE Fehler: ${line}`)
      this.setStatus('error')
    } else if (line.startsWith('KEY-STATE ')) {
      this.handleKeyState(line)
    } else if (line.startsWith('PING')) {
      this.sendLine('PONG')
    } else if (line.startsWith('PONG')) {
      if (this.keepaliveTimeoutTimer) {
        clearTimeout(this.keepaliveTimeoutTimer)
        this.keepaliveTimeoutTimer = null
      }
    } else if (line.startsWith('KEYS-CLEAR')) {
      // Companion fordert Reset aller Button-States — ignorieren (kein eigener State hier)
    }
  }

  private sendAddDevice(): void {
    const keysTotal = this.cols * this.rows
    this.sendLine(
      `ADD-DEVICE DEVICEID="${this.deviceId}" PRODUCT_NAME="${this.surfaceName}" ` +
      `KEYS_TOTAL=${keysTotal} KEYS_PER_ROW=${this.cols} ` +
      `BITMAPS=72 COLORS=hex TEXT=true TEXT_STYLE=true`,
    )
  }

  private handleKeyState(line: string): void {
    // KEY-STATE DEVICEID="cwp-..." KEY=3 TYPE=BUTTON COLOR=#ff0000 TEXT=<b64> BITMAP=<b64>
    const params = parseParams(line.slice('KEY-STATE '.length))
    const keyParam = params['KEY']
    if (keyParam === undefined) return
    const keyIndex = parseInt(keyParam, 10)
    if (isNaN(keyIndex)) return

    const state: Partial<KeyState> = {}

    const color = params['COLOR']
    if (color !== undefined) state.bgColor = color

    const textColor = params['TEXT_COLOR'] ?? params['TEXTCOLOR']
    if (textColor !== undefined) state.textColor = textColor

    const text = params['TEXT']
    if (text !== undefined) {
      const decoded = decodeBase64Utf8(text)
      state.text = decoded.replace(/\\n/g, '\n')
    }

    const bitmap = params['BITMAP']
    if (bitmap !== undefined) state.bitmap = bitmap

    this.emit('keyState', keyIndex, state)
  }

  // ─── Keepalive ─────────────────────────────────────────────────────────────

  private startKeepalive(): void {
    this.keepaliveTimer = setInterval(() => {
      this.sendLine(`PING ${Date.now()}`)
      this.keepaliveTimeoutTimer = setTimeout(() => {
        console.warn(`[VirtualSurface ${this.deviceId}] PONG Timeout — reconnect`)
        this.ws?.close()
      }, KEEPALIVE_TIMEOUT_MS)
    }, KEEPALIVE_INTERVAL_MS)
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private sendLine(line: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(line + '\n')
  }

  private setStatus(status: VirtualSurfaceStatus): void {
    if (this.status === status) return
    this.status = status
    this.emit('status', status)
  }

  private clearTimers(): void {
    if (this.keepaliveTimer)        { clearInterval(this.keepaliveTimer); this.keepaliveTimer = null }
    if (this.keepaliveTimeoutTimer) { clearTimeout(this.keepaliveTimeoutTimer); this.keepaliveTimeoutTimer = null }
    if (this.reconnectTimer)        { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
  }
}

// ─── Protocol Helpers ────────────────────────────────────────────────────────

function parseParams(str: string): Record<string, string> {
  const result: Record<string, string> = {}
  const re = /(\w+)=(?:"([^"]*)"|(\S+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(str)) !== null) {
    result[m[1]] = m[2] !== undefined ? m[2] : m[3]
  }
  return result
}

function decodeBase64Utf8(value: string): string {
  try {
    const buf = Buffer.from(value, 'base64')
    const decoded = buf.toString('utf8')
    if (/^[\x20-\x7E\u00C0-\u024F]*$/.test(decoded) && decoded !== value) {
      return decoded
    }
  } catch { /* ignore */ }
  return value
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/satellite/VirtualSurfaceSession.ts
git commit -m "feat(backend): VirtualSurfaceSession — ADD-DEVICE/KEY-STATE/KEY-PRESS"
```

---

### Task 3: Backend Tests Setup + VirtualSurfaceSession Tests

**Files:**
- Modify: `packages/backend/package.json`
- Create: `packages/backend/vitest.config.ts`
- Create: `packages/backend/src/satellite/VirtualSurfaceSession.test.ts`

- [ ] **Step 1: Add Vitest to backend**

In `packages/backend/package.json`, add `"test": "vitest run"` to scripts and add to devDependencies:

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "ts-node-dev --respawn --transpile-only src/standalone.ts",
    "start": "node dist/standalone.js",
    "test": "vitest run"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "@types/ws": "^8.5.10",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.5",
    "vitest": "^4.1.2"
  }
}
```

- [ ] **Step 2: Create vitest.config.ts for backend**

```typescript
// packages/backend/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 3: Install vitest in backend**

```bash
npm install -w @cwp/backend
```

- [ ] **Step 4: Write failing tests for VirtualSurfaceSession**

```typescript
// packages/backend/src/satellite/VirtualSurfaceSession.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VirtualSurfaceSession } from './VirtualSurfaceSession'
import { EventEmitter } from 'events'

// Minimaler WS-Mock: verhält sich wie EventEmitter + hat readyState + send
class MockWS extends EventEmitter {
  readyState = 1 // OPEN
  sent: string[] = []
  send(data: string) { this.sent.push(data) }
  close() { this.readyState = 3; this.emit('close') }
}

let mockWs: MockWS

vi.mock('ws', () => {
  const MockWebSocket = vi.fn().mockImplementation(() => {
    mockWs = new MockWS()
    return mockWs
  }) as any
  MockWebSocket.OPEN = 1
  return { default: MockWebSocket, WebSocket: MockWebSocket }
})

describe('VirtualSurfaceSession', () => {
  let session: VirtualSurfaceSession

  beforeEach(() => {
    session = new VirtualSurfaceSession('cwp-a1b2c3d4', 'Test Surface', 8, 4, '127.0.0.1', 16623)
  })

  it('sendet ADD-DEVICE nach BEGIN', () => {
    session.start()
    mockWs.emit('open')
    mockWs.emit('message', 'BEGIN CompanionVersion="4.3.0" ApiVersion="1.10.0"\n')
    expect(mockWs.sent.some(s =>
      s.includes('ADD-DEVICE') &&
      s.includes('cwp-a1b2c3d4') &&
      s.includes('KEYS_TOTAL=32') &&
      s.includes('KEYS_PER_ROW=8')
    )).toBe(true)
  })

  it('setzt Status auf connected nach ADD-DEVICE OK', () => {
    session.start()
    mockWs.emit('open')
    mockWs.emit('message', 'BEGIN CompanionVersion="4.3.0" ApiVersion="1.10.0"\n')
    mockWs.emit('message', 'ADD-DEVICE OK\n')
    expect(session.getStatus()).toBe('connected')
  })

  it('emittiert keyState bei KEY-STATE Nachricht', () => {
    const handler = vi.fn()
    session.on('keyState', handler)
    session.start()
    mockWs.emit('open')
    mockWs.emit('message', 'BEGIN CompanionVersion="4.3.0" ApiVersion="1.10.0"\n')
    mockWs.emit('message', 'ADD-DEVICE OK\n')
    mockWs.emit('message', 'KEY-STATE DEVICEID="cwp-a1b2c3d4" KEY=3 TYPE=BUTTON COLOR=#ff0000\n')
    expect(handler).toHaveBeenCalledWith(3, expect.objectContaining({ bgColor: '#ff0000' }))
  })

  it('sendet KEY-PRESS wenn verbunden', () => {
    session.start()
    mockWs.emit('open')
    mockWs.emit('message', 'BEGIN CompanionVersion="4.3.0" ApiVersion="1.10.0"\n')
    mockWs.emit('message', 'ADD-DEVICE OK\n')
    mockWs.sent = []
    session.sendKeyPress(5, true)
    expect(mockWs.sent.some(s =>
      s.includes('KEY-PRESS') && s.includes('KEY=5') && s.includes('PRESSED=true')
    )).toBe(true)
  })

  it('setzt Status auf stale nach Disconnect', () => {
    const statusHandler = vi.fn()
    session.on('status', statusHandler)
    session.start()
    mockWs.emit('open')
    mockWs.emit('message', 'BEGIN CompanionVersion="4.3.0" ApiVersion="1.10.0"\n')
    mockWs.emit('message', 'ADD-DEVICE OK\n')
    mockWs.emit('close')
    expect(statusHandler).toHaveBeenCalledWith('stale')
  })
})
```

- [ ] **Step 5: Run tests — expect FAIL (module not yet importable from test env)**

```bash
npm run test -w @cwp/backend
```

Note: if they pass already because the code is complete, that's fine — move on.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/package.json packages/backend/vitest.config.ts packages/backend/src/satellite/VirtualSurfaceSession.test.ts
git commit -m "test(backend): VirtualSurfaceSession tests + vitest setup"
```

---

### Task 4: StateStore Virtual Keys Extension

**Files:**
- Modify: `packages/backend/src/state/StateStore.ts`
- Create: `packages/backend/src/state/StateStore.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/backend/src/state/StateStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { StateStore } from './StateStore'

describe('StateStore — virtual keys', () => {
  let store: StateStore

  beforeEach(() => { store = new StateStore() })

  it('setVirtualKey gibt Delta zurück wenn sich etwas ändert', () => {
    const delta = store.setVirtualKey('cwp-a1b2c3d4', 3, { bgColor: '#ff0000' })
    expect(delta).toEqual({ bgColor: '#ff0000' })
  })

  it('setVirtualKey gibt null zurück wenn kein Unterschied', () => {
    store.setVirtualKey('cwp-a1b2c3d4', 3, { bgColor: '#ff0000' })
    const delta = store.setVirtualKey('cwp-a1b2c3d4', 3, { bgColor: '#ff0000' })
    expect(delta).toBeNull()
  })

  it('getVirtualSnapshot gibt alle Keys für ein Device zurück', () => {
    store.setVirtualKey('cwp-a1b2c3d4', 0, { bgColor: '#f00', text: 'A' })
    store.setVirtualKey('cwp-a1b2c3d4', 1, { bgColor: '#0f0' })
    const snap = store.getVirtualSnapshot('cwp-a1b2c3d4')
    expect(snap[0]).toMatchObject({ bgColor: '#f00', text: 'A' })
    expect(snap[1]).toMatchObject({ bgColor: '#0f0' })
  })

  it('clearVirtualKeys löscht alle Keys eines Devices', () => {
    store.setVirtualKey('cwp-a1b2c3d4', 0, { bgColor: '#f00' })
    store.clearVirtualKeys('cwp-a1b2c3d4')
    const snap = store.getVirtualSnapshot('cwp-a1b2c3d4')
    expect(Object.keys(snap).length).toBe(0)
  })

  it('clearVirtualKeys löscht nur das angegebene Device', () => {
    store.setVirtualKey('cwp-a1b2c3d4', 0, { bgColor: '#f00' })
    store.setVirtualKey('cwp-b9c8d7e6', 0, { bgColor: '#0f0' })
    store.clearVirtualKeys('cwp-a1b2c3d4')
    const snap = store.getVirtualSnapshot('cwp-b9c8d7e6')
    expect(snap[0]).toMatchObject({ bgColor: '#0f0' })
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test -w @cwp/backend
```

Expected: FAIL with "setVirtualKey is not a function"

- [ ] **Step 3: Add virtual key methods to StateStore.ts**

Add at the end of the `StateStore` class in `packages/backend/src/state/StateStore.ts`, before the closing `}`:

```typescript
  // ─── Virtual Keys (virtualCompanionDeck-Elemente) ─────────────────────────
  // key: "deviceId:keyIndex"
  private virtualStore = new Map<string, KeyState>()

  /**
   * Aktualisiert den State für einen Virtual-Key.
   * Gibt nur geänderte Felder zurück (Delta), oder null wenn kein Unterschied.
   */
  setVirtualKey(deviceId: string, keyIndex: number, incoming: Partial<KeyState>): Partial<KeyState> | null {
    const k = `${deviceId}:${keyIndex}`
    const current = this.virtualStore.get(k) ?? {}
    const changed: Partial<KeyState> = {}
    let hasChange = false
    for (const field of ['bgColor', 'textColor', 'text', 'bitmap'] as const) {
      const newVal = incoming[field]
      if (newVal !== undefined && newVal !== current[field]) {
        changed[field] = newVal
        hasChange = true
      }
    }
    if (!hasChange) return null
    this.virtualStore.set(k, { ...current, ...changed })
    return changed
  }

  /**
   * Gibt alle Virtual-Keys eines Devices zurück (keyIndex → KeyState).
   * Wird beim Connect eines neuen Frontend-Clients als vSnapshot gesendet.
   */
  getVirtualSnapshot(deviceId: string): Record<number, KeyState> {
    const prefix = `${deviceId}:`
    const result: Record<number, KeyState> = {}
    for (const [k, state] of this.virtualStore) {
      if (k.startsWith(prefix)) {
        const keyIndex = parseInt(k.slice(prefix.length), 10)
        if (!isNaN(keyIndex)) result[keyIndex] = state
      }
    }
    return result
  }

  /**
   * Löscht alle Virtual-Keys eines Devices (bei Session-Stop oder Element-Löschen).
   */
  clearVirtualKeys(deviceId: string): void {
    const prefix = `${deviceId}:`
    for (const k of this.virtualStore.keys()) {
      if (k.startsWith(prefix)) this.virtualStore.delete(k)
    }
  }
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm run test -w @cwp/backend
```

Expected: all StateStore tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/state/StateStore.ts packages/backend/src/state/StateStore.test.ts
git commit -m "feat(backend): StateStore virtual keys — setVirtualKey/getVirtualSnapshot/clearVirtualKeys"
```

---

### Task 5: VirtualSurfaceManager

**Files:**
- Create: `packages/backend/src/VirtualSurfaceManager.ts`
- Create: `packages/backend/src/VirtualSurfaceManager.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/backend/src/VirtualSurfaceManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VirtualSurfaceManager } from './VirtualSurfaceManager'
import { StateStore } from './state/StateStore'
import type { Settings, VirtualCompanionDeckElement } from '@cwp/shared'

// Wir mocken VirtualSurfaceSession komplett
const mockStart = vi.fn()
const mockStop = vi.fn().mockResolvedValue(undefined)
const mockGetStatus = vi.fn().mockReturnValue('connecting')

vi.mock('./satellite/VirtualSurfaceSession', () => ({
  VirtualSurfaceSession: vi.fn().mockImplementation(() => ({
    deviceId: 'cwp-a1b2c3d4',
    start: mockStart,
    stop: mockStop,
    getStatus: mockGetStatus,
    on: vi.fn(),
  })),
}))

const makeSettings = (elements: VirtualCompanionDeckElement[] = []): Settings => ({
  version: '1.4.0' as any,
  activeHostId: 'h1',
  hosts: [{ id: 'h1', name: 'H1', host: '127.0.0.1', satellite: { wsPort: 16623 } }],
  panels: [{ id: 'p1', name: 'P1', zoom: 1, defaultMode: 'view',
    grid: { enabled: false, size: 40, snap: false }, elements }],
})

const makeDeckElement = (): VirtualCompanionDeckElement => ({
  id: 'el-1', type: 'virtualCompanionDeck',
  x: 0, y: 0, w: 400, h: 200, z: 0,
  hostId: 'h1', deviceId: 'cwp-a1b2c3d4',
  surfaceName: 'Test', grid: { cols: 8, rows: 4 },
  style: { fill: '#1e3a5f', opacity: 0.85, borderRadius: 8, padding: 8, gap: 5 },
})

describe('VirtualSurfaceManager', () => {
  let store: StateStore
  let broadcast: ReturnType<typeof vi.fn>
  let manager: VirtualSurfaceManager

  beforeEach(() => {
    vi.clearAllMocks()
    store = new StateStore()
    broadcast = vi.fn()
    manager = new VirtualSurfaceManager(store, broadcast)
  })

  it('startet eine Session für jedes virtualCompanionDeck-Element', () => {
    manager.sync(makeSettings([makeDeckElement()]))
    expect(mockStart).toHaveBeenCalledTimes(1)
  })

  it('stoppt Session wenn Element entfernt wird', async () => {
    manager.sync(makeSettings([makeDeckElement()]))
    await manager.sync(makeSettings([]))
    expect(mockStop).toHaveBeenCalledTimes(1)
  })

  it('startet keine doppelte Session für gleiche deviceId', () => {
    manager.sync(makeSettings([makeDeckElement()]))
    manager.sync(makeSettings([makeDeckElement()]))
    expect(mockStart).toHaveBeenCalledTimes(1)
  })

  it('stoppt alle Sessions bei stop()', async () => {
    manager.sync(makeSettings([makeDeckElement()]))
    await manager.stop()
    expect(mockStop).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test -w @cwp/backend
```

Expected: FAIL with "Cannot find module './VirtualSurfaceManager'"

- [ ] **Step 3: Create VirtualSurfaceManager.ts**

```typescript
/**
 * VirtualSurfaceManager.ts
 *
 * Verwaltet alle VirtualSurfaceSession-Instanzen (eine pro virtualCompanionDeck-Element).
 *
 * Aufgaben:
 *  - sync(settings): Diff gegen aktive Sessions — neue starten, entfernte stoppen
 *  - KEY-STATE-Events weiterleiten → StateStore → vDelta an Frontend broadcasen
 *  - Status-Events → vSessionStatus an Frontend broadcasen
 *  - getSnapshot(deviceId): vSnapshot-Daten aus StateStore lesen (für neue WS-Clients)
 */
import { Settings, VirtualCompanionDeckElement, VDeltaMessage, VSessionStatusMessage } from '@cwp/shared'
import { VirtualSurfaceSession } from './satellite/VirtualSurfaceSession'
import { StateStore } from './state/StateStore'

type BroadcastFn = (msg: VDeltaMessage | VSessionStatusMessage) => void

/**
 * Orchestriert VirtualSurfaceSession-Instanzen.
 * Eine Session pro virtualCompanionDeck-Element (identifiziert über deviceId).
 */
export class VirtualSurfaceManager {
  private sessions = new Map<string, VirtualSurfaceSession>()
  private store: StateStore
  private broadcast: BroadcastFn

  constructor(store: StateStore, broadcast: BroadcastFn) {
    this.store = store
    this.broadcast = broadcast
  }

  /**
   * Synchronisiert Sessions mit dem aktuellen Settings-Stand.
   * Neue virtualCompanionDeck-Elemente bekommen eine Session, entfernte werden gestoppt.
   * Wird nach jedem Settings-Save und beim Start aufgerufen.
   */
  sync(settings: Settings): void {
    // Alle virtualCompanionDeck-Elemente aus allen Panels sammeln
    const desired = new Map<string, VirtualCompanionDeckElement>()
    for (const panel of settings.panels) {
      for (const el of panel.elements) {
        if (el.type === 'virtualCompanionDeck') {
          desired.set(el.deviceId, el)
        }
      }
    }

    // Entfernte Sessions stoppen
    for (const [deviceId, session] of this.sessions) {
      if (!desired.has(deviceId)) {
        session.stop().catch(() => {})
        this.store.clearVirtualKeys(deviceId)
        this.sessions.delete(deviceId)
      }
    }

    // Neue Sessions starten
    for (const [deviceId, el] of desired) {
      if (!this.sessions.has(deviceId)) {
        this.createSession(el, settings)
      }
    }
  }

  /**
   * Liefert Snapshot-Daten für einen neuen Frontend-Client.
   * Gibt alle aktiven deviceIds + deren Key-States zurück.
   */
  getAllSnapshots(): Array<{ deviceId: string; keys: Record<number, import('@cwp/shared').KeyState> }> {
    const result = []
    for (const deviceId of this.sessions.keys()) {
      result.push({ deviceId, keys: this.store.getVirtualSnapshot(deviceId) })
    }
    return result
  }

  /**
   * Leitet KEY-PRESS vom Frontend an die richtige Session weiter.
   */
  handleVPress(deviceId: string, keyIndex: number, pressed: boolean): void {
    const session = this.sessions.get(deviceId)
    if (!session) {
      console.warn(`[VirtualSurfaceManager] Kein Session für deviceId "${deviceId}"`)
      return
    }
    session.sendKeyPress(keyIndex, pressed)
  }

  /**
   * Stoppt alle Sessions (Graceful Shutdown).
   */
  async stop(): Promise<void> {
    await Promise.all([...this.sessions.values()].map(s => s.stop()))
    this.sessions.clear()
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private createSession(el: VirtualCompanionDeckElement, settings: Settings): void {
    const host = settings.hosts.find(h => h.id === el.hostId)
    if (!host) {
      console.warn(`[VirtualSurfaceManager] Host "${el.hostId}" nicht in Settings — Session nicht gestartet`)
      return
    }

    const session = new VirtualSurfaceSession(
      el.deviceId,
      el.surfaceName,
      el.grid.cols,
      el.grid.rows,
      host.host,
      host.satellite.wsPort,
    )

    session.on('keyState', (keyIndex: number, state: Partial<import('@cwp/shared').KeyState>) => {
      const delta = this.store.setVirtualKey(el.deviceId, keyIndex, state)
      if (delta) {
        this.broadcast({ t: 'vDelta', deviceId: el.deviceId, keyIndex, ...delta })
      }
    })

    session.on('status', (status: import('./satellite/VirtualSurfaceSession').VirtualSurfaceStatus) => {
      this.broadcast({ t: 'vSessionStatus', deviceId: el.deviceId, status })
    })

    this.sessions.set(el.deviceId, session)
    session.start()
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm run test -w @cwp/backend
```

Expected: all VirtualSurfaceManager tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/VirtualSurfaceManager.ts packages/backend/src/VirtualSurfaceManager.test.ts
git commit -m "feat(backend): VirtualSurfaceManager — session orchestration + diff sync"
```

---

### Task 6: ClientServer + HostManager + standalone.ts

**Files:**
- Modify: `packages/backend/src/server/ClientServer.ts`
- Modify: `packages/backend/src/HostManager.ts`
- Modify: `packages/backend/src/standalone.ts`

- [ ] **Step 1: Add VPress handler type + onVPress parameter to ClientServer**

In `packages/backend/src/server/ClientServer.ts`:

Add import at top:
```typescript
import {
  BackendToFrontend,
  FrontendToBackend,
  Settings,
  SnapshotMessage,
  VSnapshotMessage,
} from '@cwp/shared'
```

Add export type after existing types:
```typescript
export type VPressHandler = (deviceId: string, keyIndex: number, pressed: boolean) => void
```

Add `onVPress` parameter to constructor signature (after `onRotate`, before `staticDir`):
```typescript
constructor(
  port: number,
  settings: Settings,
  settingsPath: string,
  onPress: PressHandler,
  onSettingsUpdate?: (s: Settings) => void,
  onPreviewPageAdd?: PreviewPageHandler,
  onPreviewPageRemove?: PreviewPageRemoveHandler,
  onRotate?: RotateHandler,
  onVPress?: VPressHandler,
  staticDir?: string,
)
```

Add private field:
```typescript
private onVPress?: VPressHandler
```

Assign in constructor body (after `this.onRotate = onRotate`):
```typescript
this.onVPress = onVPress
```

- [ ] **Step 2: Add vPress to WS message handler in ClientServer**

In the `ws.on('message', ...)` handler, add after the `rotate` case:

```typescript
} else if (msg.t === 'vPress') {
  this.onVPress?.(msg.deviceId, msg.keyIndex, msg.pressed)
}
```

- [ ] **Step 3: Update schema version check in ClientServer**

Change `incoming.version !== '1.3.0'` to `incoming.version !== '1.4.0'` in the POST /api/settings handler.

- [ ] **Step 4: Add sendVSnapshotToClient method to ClientServer**

Add after `sendSnapshotToClient`:

```typescript
sendVSnapshotToClient(ws: WebSocket, snapshot: VSnapshotMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(snapshot))
}
```

- [ ] **Step 5: Integrate VirtualSurfaceManager into HostManager**

In `packages/backend/src/HostManager.ts`:

Add import:
```typescript
import { VirtualSurfaceManager } from './VirtualSurfaceManager'
import { VDeltaMessage, VSessionStatusMessage, VSnapshotMessage } from '@cwp/shared'
```

Add private field in class:
```typescript
private virtualSurfaceManager: VirtualSurfaceManager
```

In constructor, after `this.onStatusChange = onStatusChange`:
```typescript
this.virtualSurfaceManager = new VirtualSurfaceManager(
  store,
  (msg: VDeltaMessage | VSessionStatusMessage) => clientServer.broadcast(msg),
)
```

Also in constructor, extend `clientServer.onNewClient`:

Replace:
```typescript
clientServer.onNewClient((ws) => this.sendAllSnapshotsToClient(ws))
```
With:
```typescript
clientServer.onNewClient((ws) => {
  this.sendAllSnapshotsToClient(ws)
  // vSnapshot für alle aktiven Virtual Decks senden
  for (const { deviceId, keys } of this.virtualSurfaceManager.getAllSnapshots()) {
    const snap: VSnapshotMessage = { t: 'vSnapshot', deviceId, keys }
    clientServer.sendVSnapshotToClient(ws, snap)
  }
})
```

In `syncSubscriptions`, add after the host-sync loop:
```typescript
this.virtualSurfaceManager.sync(settings)
```

Add `handleVPress` method:
```typescript
handleVPress(deviceId: string, keyIndex: number, pressed: boolean): void {
  this.virtualSurfaceManager.handleVPress(deviceId, keyIndex, pressed)
}
```

In `stop()`, add:
```typescript
await this.virtualSurfaceManager.stop()
```

- [ ] **Step 6: Wire onVPress in standalone.ts**

In `packages/backend/src/standalone.ts`, find where `ClientServer` is instantiated and add the `onVPress` handler parameter (9th arg, before `staticDir`).

First read the current standalone.ts to find the exact instantiation. The pattern will be:
```typescript
const clientServer = new ClientServer(
  port, settings, settingsPath,
  (hostId, page, row, col, pressed) => hostManager.handlePress(hostId, page, row, col, pressed),
  (newSettings) => { ... },
  (hostId, page, keysPerRow, rows) => hostManager.addPickerSubscriptions(...),
  (hostId, page) => hostManager.removePickerSubscriptions(hostId, page),
  (hostId, page, row, col, dir) => hostManager.handleRotate(hostId, page, row, col, dir),
  (deviceId, keyIndex, pressed) => hostManager.handleVPress(deviceId, keyIndex, pressed),  // ADD THIS
)
```

Also update version string if present: change `'1.3.0'` to `'1.4.0'`.

- [ ] **Step 7: Build backend to verify no type errors**

```bash
npm run build -w @cwp/backend
```

Expected: no errors.

- [ ] **Step 8: Run all backend tests**

```bash
npm run test -w @cwp/backend
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add packages/backend/src/server/ClientServer.ts packages/backend/src/HostManager.ts packages/backend/src/standalone.ts
git commit -m "feat(backend): wire VirtualSurfaceManager into ClientServer + HostManager"
```

---

### Task 7: Frontend Store Extensions

**Files:**
- Modify: `packages/frontend/src/store/useAppStore.ts`
- Modify: `packages/frontend/src/store/useAppStore.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/frontend/src/store/useAppStore.test.ts`:

```typescript
describe('virtualKeys — applyVDelta', () => {
  it('speichert Virtual-Key-State nach vDelta', () => {
    useAppStore.getState().applyVDelta({ t: 'vDelta', deviceId: 'cwp-a1b2c3d4', keyIndex: 3, bgColor: '#f00' })
    const state = useAppStore.getState().getVirtualKeyState('cwp-a1b2c3d4', 3)
    expect(state?.bgColor).toBe('#f00')
  })

  it('merged vDelta auf bestehenden State', () => {
    useAppStore.getState().applyVDelta({ t: 'vDelta', deviceId: 'cwp-a1b2c3d4', keyIndex: 0, bgColor: '#f00' })
    useAppStore.getState().applyVDelta({ t: 'vDelta', deviceId: 'cwp-a1b2c3d4', keyIndex: 0, text: 'LIVE' })
    const state = useAppStore.getState().getVirtualKeyState('cwp-a1b2c3d4', 0)
    expect(state?.bgColor).toBe('#f00')
    expect(state?.text).toBe('LIVE')
  })
})

describe('virtualKeys — applyVSnapshot', () => {
  it('ersetzt alle Keys eines Devices nach vSnapshot', () => {
    useAppStore.getState().applyVDelta({ t: 'vDelta', deviceId: 'cwp-a1b2c3d4', keyIndex: 0, bgColor: '#f00' })
    useAppStore.getState().applyVSnapshot({ t: 'vSnapshot', deviceId: 'cwp-a1b2c3d4', keys: { 1: { bgColor: '#0f0' } } })
    // Key 0 weg (replaced), Key 1 vorhanden
    expect(useAppStore.getState().getVirtualKeyState('cwp-a1b2c3d4', 0)).toBeUndefined()
    expect(useAppStore.getState().getVirtualKeyState('cwp-a1b2c3d4', 1)?.bgColor).toBe('#0f0')
  })
})

describe('virtualSessionStatus', () => {
  it('speichert vSessionStatus', () => {
    useAppStore.getState().applyVSessionStatus({ t: 'vSessionStatus', deviceId: 'cwp-a1b2c3d4', status: 'connected' })
    expect(useAppStore.getState().getVirtualSessionStatus('cwp-a1b2c3d4')).toBe('connected')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test -w @cwp/frontend
```

Expected: FAIL with "applyVDelta is not a function"

- [ ] **Step 3: Add virtual state to useAppStore.ts**

Add imports (extend existing):
```typescript
import {
  KeyState,
  Settings,
  HostProfile,
  Panel,
  AnyElement,
  DeltaMessage,
  SnapshotMessage,
  SessionStatusMessage,
  HostInfoMessage,
  VDeltaMessage,
  VSnapshotMessage,
  VSessionStatusMessage,
  pageKey,
} from '@cwp/shared'
```

Add to `AppStore` interface (after `hostInfo` block):
```typescript
// ─── Virtual Deck State ───────────────────────────────────────────────────
/** key: deviceId → Record<keyIndex, KeyState> */
virtualKeys: Record<string, Record<number, KeyState>>
applyVDelta: (msg: VDeltaMessage) => void
applyVSnapshot: (msg: VSnapshotMessage) => void
getVirtualKeyState: (deviceId: string, keyIndex: number) => KeyState | undefined

/** key: deviceId → status */
virtualSessionStatus: Record<string, 'connecting' | 'connected' | 'stale' | 'error'>
applyVSessionStatus: (msg: VSessionStatusMessage) => void
getVirtualSessionStatus: (deviceId: string) => string | undefined
```

Add implementations to `create<AppStore>((set, get) => ({`:

After `applyHostInfo` implementation, add:

```typescript
  // ─── Virtual Deck ─────────────────────────────────────────────────────────
  virtualKeys: {},

  applyVDelta: (msg) => {
    set((s) => {
      const deviceKeys = s.virtualKeys[msg.deviceId] ?? {}
      return {
        virtualKeys: {
          ...s.virtualKeys,
          [msg.deviceId]: {
            ...deviceKeys,
            [msg.keyIndex]: {
              ...deviceKeys[msg.keyIndex],
              ...(msg.bgColor !== undefined && { bgColor: msg.bgColor }),
              ...(msg.textColor !== undefined && { textColor: msg.textColor }),
              ...(msg.text !== undefined && { text: msg.text }),
              ...(msg.bitmap !== undefined && { bitmap: msg.bitmap }),
            },
          },
        },
      }
    })
  },

  applyVSnapshot: (msg) => {
    set((s) => ({
      virtualKeys: {
        ...s.virtualKeys,
        [msg.deviceId]: msg.keys as Record<number, KeyState>,
      },
    }))
  },

  getVirtualKeyState: (deviceId, keyIndex) => {
    return get().virtualKeys[deviceId]?.[keyIndex]
  },

  virtualSessionStatus: {},

  applyVSessionStatus: (msg) => {
    set((s) => ({
      virtualSessionStatus: { ...s.virtualSessionStatus, [msg.deviceId]: msg.status },
    }))
  },

  getVirtualSessionStatus: (deviceId) => {
    return get().virtualSessionStatus[deviceId]
  },
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm run test -w @cwp/frontend
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/store/useAppStore.ts packages/frontend/src/store/useAppStore.test.ts
git commit -m "feat(frontend): virtual deck state in useAppStore — virtualKeys + virtualSessionStatus"
```

---

### Task 8: useWebSocket Extensions

**Files:**
- Modify: `packages/frontend/src/ws/useWebSocket.ts`

- [ ] **Step 1: Add vDelta/vSnapshot/vSessionStatus handling + sendVPress**

In `packages/frontend/src/ws/useWebSocket.ts`:

Add store selector imports:
```typescript
const applyVDelta = useAppStore((s) => s.applyVDelta)
const applyVSnapshot = useAppStore((s) => s.applyVSnapshot)
const applyVSessionStatus = useAppStore((s) => s.applyVSessionStatus)
```

In `socket.onmessage` switch, add after `case 'hostInfo'`:
```typescript
case 'vDelta':
  applyVDelta(msg)
  break
case 'vSnapshot':
  applyVSnapshot(msg)
  break
case 'vSessionStatus':
  applyVSessionStatus(msg)
  break
```

Update return type of `useWebSocket` and add `sendVPress`:
```typescript
export function useWebSocket(): {
  sendPress: (hostId: string, page: number, row: number, col: number, pressed: boolean) => void
  sendRotate: (hostId: string, page: number, row: number, col: number, direction: 1 | -1) => void
  sendVPress: (deviceId: string, keyIndex: number, pressed: boolean) => void
}
```

Add implementation before `return`:
```typescript
const sendVPress = useCallback(
  (deviceId: string, keyIndex: number, pressed: boolean) => {
    if (ws.current?.readyState !== WebSocket.OPEN) return
    const msg: FrontendToBackend = { t: 'vPress', deviceId, keyIndex, pressed }
    ws.current.send(JSON.stringify(msg))
  },
  [],
)
```

Update return:
```typescript
return { sendPress, sendRotate, sendVPress }
```

Also update the `connect` dependency array in `useCallback` to include the new dispatch functions:
```typescript
}, [applyDelta, applySnapshot, applySessionStatus, applyHostInfo, markAllSessionsStale, applyVDelta, applyVSnapshot, applyVSessionStatus])
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/ws/useWebSocket.ts
git commit -m "feat(frontend): useWebSocket — vDelta/vSnapshot/vSessionStatus + sendVPress"
```

---

### Task 9: VirtualCompanionDeckElement Component

**Files:**
- Create: `packages/frontend/src/components/Elements/VirtualCompanionDeckElement.tsx`

- [ ] **Step 1: Create VirtualCompanionDeckElement.tsx**

```typescript
/**
 * VirtualCompanionDeckElement.tsx
 *
 * Rendert ein Virtual Companion Deck auf dem Canvas.
 * Hintergrund: farbige Shape mit Opacity.
 * Buttons: CSS-Grid, skalieren mit Element-W/H.
 * Jede Zelle: identische Rendering-Logik wie CompanionButtonElement.
 * View-Mode: Klick → sendVPress(deviceId, keyIndex, true/false)
 */
import React, { useState, useCallback, useMemo } from 'react'
import { VirtualCompanionDeckElement as VirtualCompanionDeckElementType } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { rawRgbBase64ToDataUrl } from '../../utils/bitmap'

interface Props {
  element: VirtualCompanionDeckElementType
  mode: 'view' | 'edit'
  sendVPress: (deviceId: string, keyIndex: number, pressed: boolean) => void
  isContained?: boolean
}

/**
 * Einzelner Button innerhalb des Decks.
 * keyIndex = row * cols + col
 */
const DeckButton = React.memo(function DeckButton({
  deviceId,
  keyIndex,
  mode,
  render,
  sendVPress,
}: {
  deviceId: string
  keyIndex: number
  mode: 'view' | 'edit'
  render: VirtualCompanionDeckElementType['render']
  sendVPress: Props['sendVPress']
}) {
  const keyState = useAppStore((s) => s.getVirtualKeyState(deviceId, keyIndex))

  const showBitmap  = render?.showBitmap === true
  const scaleBitmap = render?.scaleBitmap !== false
  const showText    = render?.showText !== false
  const showBgColor = render?.showBgColor !== false
  const borderRadius = render?.borderRadius ?? 4
  const fontSize    = render?.fontSize ?? 11
  const textAlign   = render?.textAlign ?? 'bottom'
  const bitmapSize  = 72

  const [pressed, setPressed] = useState(false)

  const handlePointerDown = useCallback(() => {
    if (mode !== 'view') return
    setPressed(true)
    sendVPress(deviceId, keyIndex, true)
  }, [mode, deviceId, keyIndex, sendVPress])

  const handlePointerUp = useCallback(() => {
    if (mode !== 'view' || !pressed) return
    setPressed(false)
    sendVPress(deviceId, keyIndex, false)
  }, [mode, deviceId, keyIndex, sendVPress, pressed])

  const handlePointerLeave = useCallback(() => {
    if (mode !== 'view' || !pressed) return
    setPressed(false)
    sendVPress(deviceId, keyIndex, false)
  }, [mode, deviceId, keyIndex, sendVPress, pressed])

  const bgColor   = keyState?.bgColor
  const textColor = keyState?.textColor ?? '#ffffff'
  const text      = keyState?.text ?? ''
  const bitmap    = keyState?.bitmap

  const bitmapSrc = useMemo(
    () => (showBitmap && bitmap ? rawRgbBase64ToDataUrl(bitmap, bitmapSize, bitmapSize) : ''),
    [showBitmap, bitmap],
  )

  const hasData = !!bgColor || !!bitmap || !!text

  const textPos: React.CSSProperties =
    textAlign === 'top'    ? { top: 4 } :
    textAlign === 'center' ? { top: '50%', transform: 'translateY(-50%)' } :
                             { bottom: 4 }

  return (
    <div
      style={{
        position: 'relative',
        borderRadius,
        overflow: 'hidden',
        cursor: mode === 'view' ? 'pointer' : 'default',
        userSelect: 'none',
        touchAction: 'none',
        aspectRatio: '1',
        background: showBgColor && bgColor ? bgColor : (hasData ? '#1a2030' : '#111'),
        ...(!hasData && { border: '1px solid #1e2530', opacity: 0.6 }),
        ...(pressed && { transform: 'scale(0.95)', outline: '2px solid #ff5a5f', outlineOffset: '-2px' }),
        transition: pressed ? 'none' : 'transform 0.08s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
    >
      {bitmapSrc && (
        <img
          src={bitmapSrc}
          style={scaleBitmap
            ? { display: 'block', width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'auto', pointerEvents: 'none' }
            : { display: 'block', width: bitmapSize, height: bitmapSize, imageRendering: 'pixelated', pointerEvents: 'none', flexShrink: 0 }
          }
          alt=""
          draggable={false}
        />
      )}
      {showText && text && (
        <span style={{
          position: 'absolute',
          left: 3, right: 3,
          color: textColor,
          fontSize,
          fontWeight: 600,
          fontFamily: "'Inter', system-ui, sans-serif",
          textAlign: 'center',
          lineHeight: 1.3,
          pointerEvents: 'none',
          textShadow: bgColor ? '0 1px 3px rgba(0,0,0,0.6)' : 'none',
          ...textPos,
        }}>
          {text.split('\n').map((line, i, arr) =>
            i < arr.length - 1
              ? <React.Fragment key={i}>{line}<br /></React.Fragment>
              : <React.Fragment key={i}>{line}</React.Fragment>
          )}
        </span>
      )}
    </div>
  )
})

export const VirtualCompanionDeckElement = React.memo(function VirtualCompanionDeckElement({
  element,
  mode,
  sendVPress,
  isContained,
}: Props) {
  const { deviceId, grid, style, render } = element
  const { cols, rows } = grid
  const { fill, opacity, borderRadius, padding, gap } = style

  const vStatus = useAppStore((s) => s.getVirtualSessionStatus(deviceId))
  const isStale = vStatus === 'stale' || vStatus === 'error'

  const containerStyle: React.CSSProperties = {
    ...(isContained
      ? { position: 'relative' as const, width: '100%', height: '100%' }
      : { position: 'absolute' as const, left: element.x, top: element.y,
          width: element.w, height: element.h, zIndex: element.z }
    ),
    background: fill,
    opacity,
    borderRadius,
    padding,
    boxSizing: 'border-box',
    overflow: 'hidden',
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap,
    width: '100%',
    height: '100%',
  }

  return (
    <div style={containerStyle}>
      <div style={gridStyle}>
        {Array.from({ length: cols * rows }, (_, i) => (
          <DeckButton
            key={i}
            deviceId={deviceId}
            keyIndex={i}
            mode={mode}
            render={render}
            sendVPress={sendVPress}
          />
        ))}
      </div>

      {isStale && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius,
          pointerEvents: 'none',
        }}>
          <span style={{ color: '#ff8a3d', fontSize: 12, fontWeight: 600 }}>⚠ {vStatus}</span>
        </div>
      )}
    </div>
  )
})
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/Elements/VirtualCompanionDeckElement.tsx
git commit -m "feat(frontend): VirtualCompanionDeckElement — scalable button grid"
```

---

### Task 10: Wire VirtualCompanionDeckElement in Canvas

**Files:**
- Modify: `packages/frontend/src/components/Canvas/Canvas.tsx`

- [ ] **Step 1: Add import + sendVPress prop to Canvas**

In `packages/frontend/src/components/Canvas/Canvas.tsx`, find the imports section and add:
```typescript
import { VirtualCompanionDeckElement } from '../Elements/VirtualCompanionDeckElement'
```

Find `CanvasProps` interface (or the props type) and add `sendVPress`:
```typescript
sendVPress: (deviceId: string, keyIndex: number, pressed: boolean) => void
```

- [ ] **Step 2: Add renderElement case**

In the `renderElement` function (around line 383–396), add after the `channelStrip` case:
```typescript
case 'virtualCompanionDeck':
  return <VirtualCompanionDeckElement element={el} mode={mode} sendVPress={sendVPress} isContained={isContained} />
```

- [ ] **Step 3: Thread sendVPress from App.tsx through Canvas**

In `packages/frontend/src/App.tsx`, find where `useWebSocket` is called:
```typescript
const { sendPress, sendRotate, sendVPress } = useWebSocket()
```

Find where `<Canvas>` is rendered and add the `sendVPress` prop:
```typescript
<Canvas
  ...
  sendVPress={sendVPress}
/>
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/components/Canvas/Canvas.tsx packages/frontend/src/App.tsx
git commit -m "feat(frontend): wire VirtualCompanionDeckElement in Canvas"
```

---

### Task 11: VirtualCompanionDeckWizard

**Files:**
- Create: `packages/frontend/src/components/AddElement/VirtualCompanionDeckWizard.tsx`

- [ ] **Step 1: Create VirtualCompanionDeckWizard.tsx**

```typescript
/**
 * VirtualCompanionDeckWizard.tsx
 *
 * 3-Schritt-Wizard zum Erstellen eines virtualCompanionDeck-Elements:
 *   Schritt 1 — Name (surfaceName)
 *   Schritt 2 — Grid-Größe (cols × rows) + Live-Vorschau
 *   Schritt 3 — Host-Auswahl
 *
 * onConfirm liefert ein fertiges VirtualCompanionDeckElement (ohne id) zurück.
 */
import { useState } from 'react'
import { VirtualCompanionDeckElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { NumericInput } from '../PropertiesPanel/NumericInput'

interface Props {
  canvasPos: { x: number; y: number }
  onConfirm: (draft: Omit<VirtualCompanionDeckElement, 'id'>) => void
  onClose: () => void
}

type Step = 1 | 2 | 3

function generateDeviceId(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `cwp-${hex}`
}

export function VirtualCompanionDeckWizard({ canvasPos, onConfirm, onClose }: Props) {
  const settings = useAppStore((s) => s.settings)
  const sessionStatus = useAppStore((s) => s.sessionStatus)

  const [step, setStep] = useState<Step>(1)
  const [surfaceName, setSurfaceName] = useState('Webpanel Surface')
  const [cols, setCols] = useState(8)
  const [rows, setRows] = useState(4)
  const [selectedHostId, setSelectedHostId] = useState<string>(
    settings?.hosts.find(h => sessionStatus[h.id] === 'connected')?.id
    ?? settings?.hosts[0]?.id
    ?? '',
  )

  const hosts = settings?.hosts ?? []

  const handleCreate = () => {
    const deviceId = generateDeviceId()
    // Default-Größe: 60px pro Button + Padding + Gap
    const btnSize = 60
    const w = cols * btnSize + 2 * 8 + (cols - 1) * 5
    const h = rows * btnSize + 2 * 8 + (rows - 1) * 5
    const draft: Omit<VirtualCompanionDeckElement, 'id'> = {
      type: 'virtualCompanionDeck',
      x: Math.round(canvasPos.x),
      y: Math.round(canvasPos.y),
      w, h, z: 0,
      hostId: selectedHostId,
      deviceId,
      surfaceName,
      grid: { cols, rows },
      style: { fill: '#1e3a5f', opacity: 0.85, borderRadius: 8, padding: 8, gap: 5 },
      render: { showBitmap: false, showText: true, showBgColor: true, borderRadius: 4, fontSize: 11, textAlign: 'bottom' },
    }
    onConfirm(draft)
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1090,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  const dialogStyle: React.CSSProperties = {
    background: '#1c1c2e',
    border: '1px solid #333',
    borderRadius: 8,
    width: 380,
    overflow: 'hidden',
  }

  const headerStyle: React.CSSProperties = {
    background: '#252540',
    padding: '12px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: '1px solid #333',
  }

  const stepBarStyle: React.CSSProperties = {
    display: 'flex',
    padding: '12px 16px',
    borderBottom: '1px solid #222',
    gap: 0,
  }

  const bodyStyle: React.CSSProperties = { padding: 16 }

  const footerStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderTop: '1px solid #222',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }

  const labelStyle: React.CSSProperties = { color: '#888', fontSize: 11, display: 'block', marginBottom: 5 }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#111', border: '1px solid #333', borderRadius: 4,
    padding: '7px 10px', color: '#ddd', fontSize: 12, boxSizing: 'border-box',
  }

  const btnPrimary: React.CSSProperties = {
    background: '#4a9eff', border: 'none', color: '#fff', borderRadius: 4,
    padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  }

  const btnSecondary: React.CSSProperties = {
    background: 'transparent', border: '1px solid #333',
    color: '#888', borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
  }

  const renderStepDot = (n: Step) => {
    const active = step === n
    const done = step > n
    return (
      <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: done || active ? '#4a9eff' : '#222',
          border: done || active ? 'none' : '1px solid #333',
          color: done || active ? '#fff' : '#555',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 600,
          boxShadow: active ? '0 0 0 3px #4a9eff33' : 'none',
        }}>
          {done ? '✓' : n}
        </div>
        <div style={{ fontSize: 9, color: active ? '#4a9eff' : '#555' }}>
          {n === 1 ? 'Name' : n === 2 ? 'Grid' : 'Host'}
        </div>
      </div>
    )
  }

  return (
    <div style={overlayStyle} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={dialogStyle}>
        <div style={headerStyle}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Virtual Companion Deck</span>
          <span style={{ color: '#555', cursor: 'pointer', fontSize: 16 }} onClick={onClose}>✕</span>
        </div>

        <div style={stepBarStyle}>
          {([1, 2, 3] as Step[]).map(renderStepDot)}
        </div>

        <div style={bodyStyle}>
          {step === 1 && (
            <div>
              <label style={labelStyle}>Surface-Name (erscheint in Companions Surface-Config)</label>
              <input
                style={inputStyle}
                value={surfaceName}
                onChange={e => setSurfaceName(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <label style={labelStyle}>Grid-Größe (Spalten × Zeilen)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <NumericInput value={cols} onChange={setCols} min={1} max={32} compact />
                <span style={{ color: '#555', fontSize: 14 }}>×</span>
                <NumericInput value={rows} onChange={setRows} min={1} max={32} compact />
              </div>
              {/* Grid-Vorschau */}
              <div style={{ marginTop: 12, background: '#111', border: '1px solid #222', borderRadius: 4, padding: 10 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(cols, 16)}, 1fr)`,
                  gap: 2,
                }}>
                  {Array.from({ length: Math.min(cols * rows, 128) }, (_, i) => (
                    <div key={i} style={{ aspectRatio: '1', background: '#2a2a2a', borderRadius: 2 }} />
                  ))}
                </div>
                <div style={{ color: '#555', fontSize: 10, marginTop: 6, textAlign: 'center' }}>
                  {cols * rows} Buttons (KEYS_TOTAL={cols * rows}, KEYS_PER_ROW={cols})
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <label style={labelStyle}>Companion-Host auswählen</label>
              {hosts.length === 0 && (
                <div style={{ color: '#888', fontSize: 12 }}>Keine Hosts konfiguriert. Bitte zuerst einen Host hinzufügen.</div>
              )}
              {hosts.map(host => (
                <div
                  key={host.id}
                  onClick={() => setSelectedHostId(host.id)}
                  style={{
                    background: selectedHostId === host.id ? '#0d1f3a' : '#111',
                    border: `1px solid ${selectedHostId === host.id ? '#4a9eff' : '#333'}`,
                    borderRadius: 4, padding: '8px 10px', marginBottom: 6, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: sessionStatus[host.id] === 'connected' ? '#4caf50' : '#ff9800',
                    boxShadow: sessionStatus[host.id] === 'connected' ? '0 0 4px #4caf5088' : 'none',
                  }} />
                  <span style={{ color: '#ddd', fontSize: 12, flex: 1 }}>{host.name}</span>
                  <span style={{ color: '#555', fontSize: 10 }}>{host.host}:{host.satellite.wsPort}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={footerStyle}>
          <button style={btnSecondary} onClick={step === 1 ? onClose : () => setStep((s) => (s - 1) as Step)}>
            {step === 1 ? 'Abbrechen' : 'Zurück'}
          </button>
          {step < 3 ? (
            <button
              style={btnPrimary}
              disabled={step === 1 && !surfaceName.trim()}
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              Weiter →
            </button>
          ) : (
            <button
              style={btnPrimary}
              disabled={!selectedHostId}
              onClick={handleCreate}
            >
              Erstellen ✓
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/AddElement/VirtualCompanionDeckWizard.tsx
git commit -m "feat(frontend): VirtualCompanionDeckWizard — 3-step setup wizard"
```

---

### Task 12: VirtualCompanionDeckProps

**Files:**
- Create: `packages/frontend/src/components/PropertiesPanel/VirtualCompanionDeckProps.tsx`

- [ ] **Step 1: Create VirtualCompanionDeckProps.tsx**

```typescript
/**
 * VirtualCompanionDeckProps.tsx
 *
 * PropertiesPanel-Block für virtualCompanionDeck-Elemente.
 * Sektionen: Surface (Name, Grid, Host, DeviceID), Darstellung, Button-Darstellung.
 */
import { useState } from 'react'
import { VirtualCompanionDeckElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { NumericInput } from './NumericInput'

interface Props {
  element: VirtualCompanionDeckElement
  panelId: string
}

function generateDeviceId(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `cwp-${hex}`
}

export function VirtualCompanionDeckProps({ element, panelId }: Props) {
  const updateElement = useAppStore((s) => s.updateElement)
  const settings = useAppStore((s) => s.settings)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const vStatus = useAppStore((s) => s.getVirtualSessionStatus(element.deviceId))

  const [confirmNewId, setConfirmNewId] = useState(false)

  const hosts = settings?.hosts ?? []

  const update = (patch: Partial<VirtualCompanionDeckElement>) =>
    updateElement(panelId, element.id, patch as any)

  const updateStyle = (patch: Partial<VirtualCompanionDeckElement['style']>) =>
    update({ style: { ...element.style, ...patch } })

  const updateRender = (patch: Partial<NonNullable<VirtualCompanionDeckElement['render']>>) =>
    update({ render: { ...element.render, ...patch } })

  const labelStyle: React.CSSProperties = { color: '#888', fontSize: 11 }
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }
  const inputStyle: React.CSSProperties = {
    background: '#111', border: '1px solid #333', borderRadius: 3,
    padding: '3px 7px', color: '#ddd', fontSize: 11, textAlign: 'center',
  }
  const sectionTitleStyle: React.CSSProperties = { color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }

  const statusColor = vStatus === 'connected' ? '#4caf50' : vStatus === 'connecting' ? '#ff9800' : '#ff5555'

  return (
    <div style={{ fontSize: 12 }}>

      {/* Surface */}
      <div style={{ marginBottom: 12 }}>
        <div style={sectionTitleStyle}>Surface</div>

        <div style={rowStyle}>
          <span style={labelStyle}>Name</span>
          <input
            style={{ ...inputStyle, minWidth: 130 }}
            value={element.surfaceName}
            onChange={e => update({ surfaceName: e.target.value })}
          />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Grid</span>
          <span style={{ ...inputStyle, color: '#aaa' }}>{element.grid.cols} × {element.grid.rows}</span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Host</span>
          <select
            style={{ ...inputStyle, minWidth: 130 }}
            value={element.hostId}
            onChange={e => update({ hostId: e.target.value })}
          >
            {hosts.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Status</span>
          <span style={{ fontSize: 11, color: statusColor }}>● {vStatus ?? 'unbekannt'}</span>
        </div>

        <div style={{ marginBottom: 7 }}>
          <div style={{ ...labelStyle, marginBottom: 4 }}>Device ID</div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <div style={{
              ...inputStyle, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 10, color: '#666',
            }}>
              {element.deviceId}
            </div>
            {!confirmNewId ? (
              <button
                onClick={() => setConfirmNewId(true)}
                style={{ ...inputStyle, color: '#888', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                ↻ Neu
              </button>
            ) : (
              <button
                onClick={() => { update({ deviceId: generateDeviceId() }); setConfirmNewId(false) }}
                style={{ ...inputStyle, color: '#ff8a3d', cursor: 'pointer', whiteSpace: 'nowrap', borderColor: '#ff8a3d' }}
              >
                Bestätigen
              </button>
            )}
          </div>
          {confirmNewId && (
            <div style={{ color: '#ff8a3d', fontSize: 10, marginTop: 3 }}>
              Neue ID setzt die Companion-Surface-Zuweisung zurück.{' '}
              <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setConfirmNewId(false)}>Abbrechen</span>
            </div>
          )}
        </div>
      </div>

      {/* Darstellung */}
      <div style={{ borderTop: '1px solid #222', paddingTop: 10, marginBottom: 12 }}>
        <div style={sectionTitleStyle}>Darstellung</div>

        <div style={rowStyle}>
          <span style={labelStyle}>Hintergrund</span>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <div style={{ width: 14, height: 14, borderRadius: 2, background: element.style.fill, border: '1px solid #444', cursor: 'pointer' }} />
            <input
              style={{ ...inputStyle, width: 70 }}
              value={element.style.fill}
              onChange={e => updateStyle({ fill: e.target.value })}
            />
          </div>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Deckkraft</span>
          <NumericInput
            value={Math.round(element.style.opacity * 100)}
            onChange={v => updateStyle({ opacity: Math.max(0, Math.min(1, v / 100)) })}
            min={0} max={100} compact
          />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Eckenradius</span>
          <NumericInput value={element.style.borderRadius} onChange={v => updateStyle({ borderRadius: v })} min={0} compact />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Padding</span>
          <NumericInput value={element.style.padding} onChange={v => updateStyle({ padding: v })} min={0} compact />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Gap</span>
          <NumericInput value={element.style.gap} onChange={v => updateStyle({ gap: v })} min={0} compact />
        </div>
      </div>

      {/* Button-Darstellung */}
      <div style={{ borderTop: '1px solid #222', paddingTop: 10 }}>
        <div style={sectionTitleStyle}>Button-Darstellung</div>

        <div style={rowStyle}>
          <span style={labelStyle}>Bitmap</span>
          <input
            type="checkbox"
            checked={element.render?.showBitmap === true}
            onChange={e => updateRender({ showBitmap: e.target.checked })}
          />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Text-Overlay</span>
          <input
            type="checkbox"
            checked={element.render?.showText !== false}
            onChange={e => updateRender({ showText: e.target.checked })}
          />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Button-Radius</span>
          <NumericInput value={element.render?.borderRadius ?? 4} onChange={v => updateRender({ borderRadius: v })} min={0} compact />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Schriftgröße</span>
          <NumericInput value={element.render?.fontSize ?? 11} onChange={v => updateRender({ fontSize: v })} min={6} max={32} compact />
        </div>
      </div>

    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/PropertiesPanel/VirtualCompanionDeckProps.tsx
git commit -m "feat(frontend): VirtualCompanionDeckProps — PropertiesPanel block"
```

---

### Task 13: AddElementMenu + PropertiesPanel Wiring

**Files:**
- Modify: `packages/frontend/src/components/AddElement/AddElementMenu.tsx`
- Modify: `packages/frontend/src/components/PropertiesPanel/PropertiesPanel.tsx`

- [ ] **Step 1: Add virtualCompanionDeck to AddElementMenu**

In `packages/frontend/src/components/AddElement/AddElementMenu.tsx`:

Add import:
```typescript
import { VirtualCompanionDeckWizard } from './VirtualCompanionDeckWizard'
```

Add to `MENU_ITEMS`:
```typescript
const MENU_ITEMS = [
  { type: 'companionButton',    label: 'Companion Button',       icon: '⊞' },
  { type: 'virtualCompanionDeck', label: 'Virtual Companion Deck', icon: '▦' },
  { type: 'channelStrip',       label: 'Channel Strip',          icon: '🎚' },
  { type: 'label',              label: 'Label',                  icon: 'T' },
  { type: 'shape',              label: 'Shape',                  icon: '▭' },
] as const
```

Add state:
```typescript
const [deckWizardOpen, setDeckWizardOpen] = useState(false)
```

In `handleSelect`, add before the `addElement` line:
```typescript
if (type === 'virtualCompanionDeck') {
  setDeckWizardOpen(true)
  return
}
```

Add handler:
```typescript
const handleDeckWizardConfirm = (draft: Omit<import('@cwp/shared').VirtualCompanionDeckElement, 'id'>) => {
  const id = crypto.randomUUID()
  addElement(panelId, { id, ...draft } as import('@cwp/shared').AnyElement)
  onClose()
}
```

Add to JSX (after `ChannelStripWizard`):
```typescript
{deckWizardOpen && (
  <VirtualCompanionDeckWizard
    canvasPos={canvasPos}
    onConfirm={handleDeckWizardConfirm}
    onClose={() => { setDeckWizardOpen(false); onClose() }}
  />
)}
```

Update the click-outside guard:
```typescript
if (pickerOpen || wizardOpen || deckWizardOpen) return
```

- [ ] **Step 2: Add VirtualCompanionDeckProps to PropertiesPanel**

In `packages/frontend/src/components/PropertiesPanel/PropertiesPanel.tsx`:

Add import:
```typescript
import { VirtualCompanionDeckProps } from './VirtualCompanionDeckProps'
```

Add after the `channelStrip` block (around line 191):
```typescript
} else if (singleEl.type === 'virtualCompanionDeck') {
  specificContent = (
    <>
      {specificContent}
      <div style={{ borderTop: '1px solid #2a3344', paddingTop: 12 }}>
        <VirtualCompanionDeckProps element={singleEl} panelId={panel!.id} />
      </div>
    </>
  )
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
npm run test -w @cwp/frontend
npm run test -w @cwp/backend
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/components/AddElement/AddElementMenu.tsx packages/frontend/src/components/PropertiesPanel/PropertiesPanel.tsx
git commit -m "feat(frontend): wire Virtual Companion Deck in AddElementMenu + PropertiesPanel"
```

---

### Task 14: Integration Test + .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add .superpowers to .gitignore**

Check if `.superpowers/` is already in `.gitignore`. If not, add it:

```bash
grep -q ".superpowers" .gitignore || echo ".superpowers/" >> .gitignore
```

- [ ] **Step 2: Build frontend**

```bash
npm run build -w @cwp/frontend
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 3: Start dev server and smoke test**

```bash
npm run dev
```

Open `http://localhost:5173`. Steps to verify:
1. Open `+` Menu → "Virtual Companion Deck" erscheint ✓
2. Wizard öffnet sich → 3 Schritte (Name, Grid, Host) ✓
3. Element auf Canvas platziert → Button-Grid sichtbar ✓
4. Element selektieren → PropertiesPanel zeigt "Virtual Companion Deck"-Sektionen ✓
5. Element resize → Buttons skalieren mit ✓
6. In Companion: Surface Configuration zeigt neues Device mit richtigem Namen ✓
7. Companion-Seite auf Surface zuweisen → Buttons füllen sich ✓
8. View-Mode: Button klicken → Companion reagiert ✓

- [ ] **Step 4: Final commit**

```bash
git add .gitignore
git commit -m "chore: add .superpowers to .gitignore"
```

---

## Self-Review

**Spec coverage check:**

| Spec-Anforderung | Task |
|---|---|
| `VirtualCompanionDeckElement` Interface | Task 1 |
| `VDeltaMessage`, `VSnapshotMessage`, `VSessionStatusMessage`, `VPressMessage` | Task 1 |
| Schema v1.4.0 | Task 1 |
| `VirtualSurfaceSession` (ADD-DEVICE/KEY-STATE/KEY-PRESS/PING) | Task 2 |
| `StateStore` virtual keys | Task 4 |
| `VirtualSurfaceManager` (sync/diff) | Task 5 |
| `ClientServer` vPress + broadcast | Task 6 |
| `HostManager` integration | Task 6 |
| `useAppStore` virtual state | Task 7 |
| `useWebSocket` vDelta/vSnapshot/sendVPress | Task 8 |
| `VirtualCompanionDeckElement.tsx` | Task 9 |
| Canvas wiring | Task 10 |
| 3-Schritt-Wizard | Task 11 |
| PropertiesPanel block | Task 12 |
| AddElementMenu + PropertiesPanel wiring | Task 13 |
| deviceId auto-generiert + "↻ Neu" Button | Task 12 |
| clearVirtualKeys bei Session-Stop | Task 5 (in sync()) |
| vSnapshot bei neuem Client-Connect | Task 6 (HostManager.onNewClient) |

**Placeholder scan:** keine TBDs oder "similar to"-Referenzen gefunden.

**Type consistency:**
- `deviceId`: String `cwp-<8hex>` — konsistent in Task 1, 2, 5, 9, 11, 12
- `keyIndex`: `number` (0 bis cols×rows-1) — konsistent in Task 2, 4, 5, 9
- `VirtualSurfaceSession.sendKeyPress(keyIndex, pressed)` — Task 2 definiert, Task 5 benutzt ✓
- `VirtualSurfaceManager.handleVPress(deviceId, keyIndex, pressed)` — Task 5 definiert, Task 6 benutzt ✓
- `StateStore.setVirtualKey(deviceId, keyIndex, state)` — Task 4 definiert, Task 5 benutzt ✓
- `sendVPress` prop in Canvas → VirtualCompanionDeckElement — Task 9 + 10 konsistent ✓

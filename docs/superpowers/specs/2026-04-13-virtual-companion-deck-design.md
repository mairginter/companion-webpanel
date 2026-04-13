# Virtual Companion Deck — Design Spec

**Datum:** 2026-04-13  
**Status:** Approved

---

## Überblick

Ein neues Canvas-Element `virtualCompanionDeck` registriert sich bei Companion als echtes Surface (ADD-DEVICE). Es rendert ein frei skalierbares Button-Grid auf dem Canvas. Jeder Button verhält sich exakt wie `CompanionButtonElement` (Bitmap, Text + Hintergrundfarbe, konfigurierbar). Beim Resize des Elements skalieren alle Buttons proportional mit.

---

## Element-Typ

```typescript
export interface VirtualCompanionDeckElement extends BaseElement {
  type: 'virtualCompanionDeck'

  /** Companion-Host, gegen den das Surface registriert wird */
  hostId: string

  /** Einmalig generierte, stabile Device-ID (cwp-<uuid>) */
  deviceId: string

  /** Name der Surface in Companion (Surface Configuration UI) */
  surfaceName: string

  /** Grid-Konfiguration */
  grid: {
    cols: number   // KEYS_PER_ROW
    rows: number   // KEYS_TOTAL / cols
  }

  /** Darstellung der Hintergrund-Shape */
  style: {
    fill: string           // Hintergrundfarbe (hex). Default: '#1e3a5f'
    opacity: number        // 0–1. Default: 0.85
    borderRadius: number   // px. Default: 8
    padding: number        // px rundum. Default: 8
    gap: number            // px zwischen Buttons. Default: 5
  }

  /** Button-Darstellung (deck-weit, wie CompanionButtonElement.render) */
  render?: {
    showBitmap?: boolean         // Default: false (Text+Farbe wie bestehender CompanionButton)
    scaleBitmap?: boolean        // Default: true
    showText?: boolean           // Default: true
    showBgColor?: boolean        // Default: true
    borderRadius?: number        // Button-Eckenradius px. Default: 4
    fontSize?: number            // Text-Overlay px. Default: 11
    textAlign?: 'center' | 'top' | 'bottom'
  }
}
```

`deviceId` Format: `cwp-<8hex>-<4hex>-<4hex>` (UUID-ähnlich, beim Element-Erstellen einmalig generiert).  
`surfaceName` Default: `Webpanel <hostname>` (analog zur alten SatelliteSession).

---

## Backend

### VirtualSurfaceSession

Neue Datei: `packages/backend/src/satellite/VirtualSurfaceSession.ts`

- Basiert auf der alten `SatelliteSession` (Git `bf0818f`) — reaktiviert und angepasst
- Öffnet eine **eigene WS-Verbindung** zu Companion (:16623), unabhängig vom `SatelliteClient`
- Sendet `ADD-DEVICE DEVICEID="<deviceId>" PRODUCT_NAME="<surfaceName>" KEYS_TOTAL=<cols*rows> KEYS_PER_ROW=<cols> BITMAPS=72 COLORS=true TEXT=true TEXT_STYLE=true`
- Empfängt `KEY-STATE` → emittiert `keyState(keyIndex, state)`
- Sendet `KEY-PRESS DEVICEID="..." KEY=<keyIndex> PRESSED=<true|false>`
- PING/PONG Keepalive (2s Interval, 6s Timeout)
- Exponential Backoff Reconnect (1s→2s→4s→8s→16s→30s), Re-`ADD-DEVICE` nach Reconnect
- Emittiert `status` Events: `connecting | connected | stale | error`

```typescript
class VirtualSurfaceSession extends EventEmitter {
  constructor(deviceId: string, surfaceName: string, cols: number, rows: number, host: string, port: number)
  start(): void
  stop(): Promise<void>
  sendKeyPress(keyIndex: number, pressed: boolean): void
  getStatus(): 'connecting' | 'connected' | 'stale' | 'error'
}
```

### VirtualSurfaceManager

Neue Datei: `packages/backend/src/VirtualSurfaceManager.ts`

- Verwaltet alle `VirtualSurfaceSession`-Instanzen (eine pro `virtualCompanionDeck`-Element)
- `sync(elements: VirtualCompanionDeckElement[], hosts: HostProfile[])`: diff — neue Sessions starten, entfernte stoppen, geänderte (hostId/deviceId/grid) neu starten
- Leitet `keyState`-Events an `StateStore` weiter (neuer Namespace: `virtual:<deviceId>:<keyIndex>`)
- Status-Events → an `ClientServer` als `vSessionStatus`-WS-Nachricht

### StateStore

Erweiterung: neue Map `virtualKeys: Map<string, KeyState>`  
Key-Format: `<deviceId>:<keyIndex>` (z.B. `cwp-a3f291:0`)

Neue Methoden:
- `setVirtualKey(deviceId, keyIndex, state): KeyState | null` → gibt Delta zurück (null wenn kein Unterschied)
- `getVirtualSnapshot(deviceId): Record<number, KeyState>`
- `clearVirtualKeys(deviceId): void`  — wird von `VirtualSurfaceManager` beim Session-Stop aufgerufen, damit keine veralteten Keys im Store bleiben

### HostManager

`HostManager.update(settings)` ruft zusätzlich `virtualSurfaceManager.sync(allVirtualDeckElements, settings.hosts)` auf.

### ClientServer

Neue WS-Nachrichtentypen (Backend → Frontend):

```typescript
interface VDeltaMessage {
  t: 'vDelta'
  deviceId: string
  keyIndex: number
  bgColor?: string
  textColor?: string
  text?: string
  bitmap?: string
}

interface VSnapshotMessage {
  t: 'vSnapshot'
  deviceId: string
  keys: Record<number, KeyState>   // keyIndex → state
}

interface VSessionStatusMessage {
  t: 'vSessionStatus'
  deviceId: string
  status: 'connecting' | 'connected' | 'stale' | 'error'
}
```

Neue WS-Nachricht (Frontend → Backend):

```typescript
interface VPressMessage {
  t: 'vPress'
  deviceId: string
  keyIndex: number
  pressed: boolean
}
```

Bei neuem WS-Client: `vSnapshot` für alle aktiven virtualDecks senden (analog zu bestehendem Snapshot).

---

## Frontend

### Store (`useAppStore`)

Neuer State-Slice:
```typescript
virtualKeys: Record<string, Record<number, KeyState>>
// virtualKeys[deviceId][keyIndex] = KeyState

virtualSessionStatus: Record<string, 'connecting' | 'connected' | 'stale' | 'error'>
// virtualSessionStatus[deviceId] = status
```

Neue Actions:
- `applyVDelta(msg: VDeltaMessage)`
- `applyVSnapshot(msg: VSnapshotMessage)`
- `setVSessionStatus(deviceId, status)`

### useWebSocket

- `vDelta` / `vSnapshot` / `vSessionStatus` Messages dispatchen
- `sendVPress(deviceId, keyIndex, pressed)` Methode

### VirtualCompanionDeckElement.tsx

`packages/frontend/src/components/Elements/VirtualCompanionDeckElement.tsx`

Rendering:
- Äußere `<div>` = Shape (fill, opacity, borderRadius, padding)
- CSS-Grid: `grid-template-columns: repeat(cols, 1fr)`, `gap`
- Jede Zelle: Button-Größe = `(elementWidth - 2*padding - (cols-1)*gap) / cols` (quadratisch)
- Button-Inhalt: identisch zu `CompanionButtonElement` — bgColor, Bitmap (skaliert), Text-Overlay
  - Liest `virtualKeys[deviceId][keyIndex]` aus Store
  - Leerer Button (kein State): dunkler Fallback `#1a1a1a`
- **View-Mode**: `onClick` → `sendVPress(deviceId, keyIndex, true)` + 80ms delay + `sendVPress(..., false)`
- **Edit-Mode**: kein Click-Handler (normales Drag/Resize)
- Status-Overlay: wenn `vSessionStatus[deviceId] !== 'connected'` → halbdurchsichtiges Overlay mit Status-Text

### Resize-Verhalten

Buttons skalieren automatisch durch CSS-Grid mit `1fr`-Columns. Keine explizite Buttonsize nötig — ergibt sich aus `(w - 2*padding - (cols-1)*gap) / cols`. Aspect-Ratio der Buttons: `aspect-ratio: 1`.

### VirtualCompanionDeckProps.tsx

PropertiesPanel-Block für `virtualCompanionDeck`:

**Surface-Sektion:**
- Name (Text-Input)
- Grid: Cols × Rows (NumericInput, read-only nach Erstellen — Grid-Änderung erfordert neue Device-ID)
- Host (Dropdown aus `settings.hosts`)
- Device-ID (read-only, monospace, abgeschnitten) + "↻ Neu" Button (Bestätigungs-Dialog: "Neue Device-ID generieren setzt die Companion-Surface-Zuweisung zurück")

**Darstellung-Sektion:**
- Hintergrundfarbe (ColorInput)
- Deckkraft 0–100% (NumericInput)
- Eckenradius px (NumericInput)
- Padding px (NumericInput)
- Gap px (NumericInput)

**Button-Darstellung-Sektion:**
- Bitmap anzeigen (Toggle)
- Text-Overlay (Toggle)
- Button-Eckenradius px (NumericInput)
- Schriftgröße px (NumericInput)

### VirtualCompanionDeckWizard.tsx

3-Schritt-Wizard (analog zu `ChannelStripWizard`):

| Schritt | Inhalt |
|---|---|
| 1 — Name | Text-Input `surfaceName`, Default: `Webpanel <hostname oder 'Surface'>` |
| 2 — Grid | Cols × Rows NumericInputs + Live-Vorschau des Grids (kleine Quadrate) |
| 3 — Host | Liste der konfigurierten Hosts mit Status-Dot, einer auswählen |

Beim Klick "Erstellen":
- `deviceId` generieren: `cwp-` + 8 zufällige Hex-Zeichen
- `addElement()` mit vollständigem `VirtualCompanionDeckElement`-Objekt
- Default-Größe: `w = cols * 60 + 2*8 + (cols-1)*5`, `h = rows * 60 + 2*8 + (rows-1)*5` (60px Button-Größe als Richtwert)

### AddElementMenu

Neuer Eintrag: "Virtual Companion Deck" (Icon: `grid_view`) → öffnet `VirtualCompanionDeckWizard`

---

## Settings / Schema

### types.ts

`AnyElement` Union erweitern: `| VirtualCompanionDeckElement`

### Schema + Version

Settings-Version **1.4.0** — betrifft die üblichen 5 Stellen:
1. `CompanionWebpannelSettings.schema.json` — `virtualCompanionDeck` in `element` definitions
2. `packages/shared/src/types.ts` — `VirtualCompanionDeckElement` + neue WS-Typen
3. `packages/backend/src/standalone.ts` — Version-String
4. `packages/backend/src/server/ClientServer.ts` — Migration + neuer `vPress`-Handler
5. `CompanionWebpannelSettings.json` — `version: "1.4.0"`

Migration (1.3.0 → 1.4.0): keine Datenmigration nötig, nur Version-Bump.

---

## Nicht im Scope

- Grid-Größe nach dem Erstellen ändern ohne neue Device-ID (zu komplex, kein Usecase)
- Virtuelle Navigation (Page-Up/Down auf der Surface) — Companion übernimmt das
- Mehrere Seiten im selben Deck-Element
- Per-Button-Render-Overrides (einheitlich deck-weit)

---

## Offene Fragen (entschieden)

| Frage | Entscheidung |
|---|---|
| Backend-Architektur | Option A: eigene WS-Verbindung pro VirtualSurfaceSession |
| Button-Darstellung | Wie CompanionButton: Bitmap oder Text+Farbe, deck-weit konfigurierbar |
| Padding | Fest rundum (Option B), Padding + Gap beide konfigurierbar |
| Device-ID | Auto-generiert, persistent, regenerierbar per Button |
| Seiten-Zuweisung | Companion-seitig (Surface Configuration UI) — kein Page-Select im Webpanel |
| Bitmap-Größe | Immer 72px (Companion Standard), CSS-Skalierung auf Button-Größe |

// ─── Settings Types (spiegeln CompanionWebpannelSettings.schema.json v1.4.0) ───

export interface Settings {
  version: '1.4.0'
  activeHostId: string
  hosts: HostProfile[]
  panels: Panel[]
  /** Backend-Server-Konfiguration (optional — default port: 8080) */
  server?: { port?: number }
}

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

// ─── Canvas / Element Types ───────────────────────────────────────────────────

export interface CompanionRef {
  hostId: string
  page: number
  row: number
  col: number
}

export interface BaseElement {
  id: string
  type: string
  x: number
  y: number
  w: number
  h: number
  z: number
  locked?: boolean
}

export interface CompanionButtonElement extends BaseElement {
  type: 'companionButton'
  ref: CompanionRef
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
}

export interface ShapeElement extends BaseElement {
  type: 'shape'
  style: {
    fill: string
    stroke?: string
    strokeWidth?: number
    borderRadius?: number
  }
}

export interface LabelElement extends BaseElement {
  type: 'label'
  text: string
  style?: {
    color?: string
    fontSize?: number
    fontFamily?: string
    fontWeight?: string
    align?: 'left' | 'center' | 'right'
  }
}

export interface MeterElement extends BaseElement {
  type: 'meter'
  source: {
    ref: CompanionRef
    field: 'text'
    parser: 'db'
  }
  style?: {
    min?: number
    max?: number
    peakHoldMs?: number
    zones?: Array<{ to: number; color: string }>
  }
}

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
    /** Mute-Logik umkehren: true wenn aktive Feedback-Farbe = unmuted (z.B. vMix invertiert) */
    invertMute?: boolean
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

export type AnyElement =
  | CompanionButtonElement
  | ShapeElement
  | LabelElement
  | MeterElement
  | ChannelStripElement
  | VirtualCompanionDeckElement

export interface Panel {
  id: string
  name: string
  zoom: number
  defaultMode: 'view' | 'edit'
  grid: { enabled: boolean; size: number; snap: boolean }
  canvas?: { width?: number; height?: number; background?: string; texture?: string }
  elements: AnyElement[]
}

// ─── WebSocket Messages (Backend ↔ Frontend) ─────────────────────────────────

/** Key state as held in memory */
export interface KeyState {
  bgColor?: string
  textColor?: string
  text?: string
  bitmap?: string
}

/** Backend → Frontend: one key changed */
export interface DeltaMessage {
  t: 'delta'
  hostId: string
  page: number
  row: number
  col: number
  bgColor?: string
  textColor?: string
  text?: string
  bitmap?: string
}

/** Backend → Frontend: full state dump for a (hostId, page) — sent on connect */
export interface SnapshotMessage {
  t: 'snapshot'
  hostId: string
  page: number
  /** "row:col" → state */
  keys: Record<string, KeyState>
}

/** Backend → Frontend: Companion version info after handshake */
export interface HostInfoMessage {
  t: 'hostInfo'
  hostId: string
  companionVersion: string
  apiVersion: string
}

/** Backend → Frontend: Satellite connection status changed */
export interface SessionStatusMessage {
  t: 'sessionStatus'
  hostId: string
  /**
   * connecting  — Verbindungsaufbau läuft
   * connected   — Companion verbunden, Subscriptions aktiv
   * stale       — Verbindung unterbrochen, Reconnect läuft
   * error       — Verbindungsfehler (generisch)
   * caps-disabled — CAPS SUBSCRIPTIONS=0: Feature in Companion Settings deaktiviert
   */
  status: 'connecting' | 'connected' | 'stale' | 'error' | 'caps-disabled'
}

/** Frontend → Backend: user pressed or released a button */
export interface PressMessage {
  t: 'press'
  hostId: string
  page: number
  row: number
  col: number
  pressed: boolean
}

/** Frontend → Backend: fader rotate via drum wheel */
export interface RotateMessage {
  t: 'rotate'
  hostId: string
  page: number
  row: number
  col: number
  direction: 1 | -1
}

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

export type BackendToFrontend =
  | DeltaMessage
  | SnapshotMessage
  | SessionStatusMessage
  | HostInfoMessage
  | VDeltaMessage
  | VSnapshotMessage
  | VSessionStatusMessage
export type FrontendToBackend = PressMessage | RotateMessage | VPressMessage

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Schlüssel für hostId:page Lookups (z.B. als Snapshot-Prefix) */
export function pageKey(hostId: string, page: number): string {
  return `${hostId}:${page}`
}

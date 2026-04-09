// ─── Settings Types (spiegeln CompanionWebpannelSettings.schema.json v1.3.0) ───

export interface Settings {
  version: '1.3.0'
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

export type AnyElement =
  | CompanionButtonElement
  | ShapeElement
  | LabelElement
  | MeterElement

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

export type BackendToFrontend = DeltaMessage | SnapshotMessage | SessionStatusMessage | HostInfoMessage
export type FrontendToBackend = PressMessage

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Schlüssel für hostId:page Lookups (z.B. als Snapshot-Prefix) */
export function pageKey(hostId: string, page: number): string {
  return `${hostId}:${page}`
}

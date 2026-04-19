/**
 * SatelliteClient.ts
 *
 * Verwaltet eine WebSocket-Verbindung zu einer Companion-Instanz und
 * kommuniziert über die Button Subscriptions API (ab Companion 4.3 / API 1.10.0).
 *
 * Im Gegensatz zur alten SatelliteSession (ADD-DEVICE) arbeitet dieser Client
 * ohne Surface-Registrierung — Buttons werden direkt per ADD-SUB abonniert.
 *
 * Aufgaben:
 *  - WebSocket-Verbindung zu Companion auf Port 16623 aufbauen und halten
 *  - Handshake: BEGIN empfangen → CAPS SUBSCRIPTIONS=1 prüfen → bereit
 *  - subscribe(subId, page, row, col) → ADD-SUB an Companion senden
 *  - unsubscribe(subId)             → REMOVE-SUB an Companion senden
 *  - press(page, row, col, pressed) → SUB-PRESS an Companion senden
 *  - SUB-STATE-Nachrichten parsen und als 'subState'-Events emittieren
 *  - Verbindungsabbrüche mit Exponential Backoff reconnecten
 *  - Bei Reconnect: alle aktiven Subscriptions automatisch re-subscriben
 *  - Status-Events ('connecting', 'connected', 'stale', 'error') emittieren
 */
import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { KeyState } from '@cwp/shared'

export type ClientStatus = 'connecting' | 'connected' | 'stale' | 'error' | 'caps-disabled'

// Exponential Backoff: 1s, 2s, 4s, 8s, 16s, 30s (cap)
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000]

// Keepalive: Client sendet PING, Companion antwortet mit PONG.
// Ohne regelmäßige PINGs schließt Companion die Verbindung nach ~5-7s idle.
const KEEPALIVE_INTERVAL_MS = 2000
const KEEPALIVE_TIMEOUT_MS  = 6000

// Schutz gegen Protokoll-Fehler: Companion-Zeilen haben \n-Terminierung.
// Bei Ausbleiben (fehlerhafter Host / MitM) würde lineBuffer unbegrenzt wachsen.
const LINE_BUFFER_MAX_BYTES = 10 * 1024 * 1024 // 10 MB

interface SubInfo {
  page: number
  row: number
  col: number
}

/**
 * Verwaltet eine Companion Satellite-Verbindung mit Button Subscriptions API.
 * 1 Instanz pro Host. Alle Subscriptions laufen über diese eine WS-Verbindung.
 *
 * Events:
 *  'subState'  (subId: string, page: number, row: number, col: number, state: Partial<KeyState>)
 *  'status'    (status: ClientStatus)
 *  'capsError' ()  — CAPS SUBSCRIPTIONS=0, User muss in Companion Settings aktivieren
 */
export class SatelliteClient extends EventEmitter {
  readonly hostId: string

  private host: string
  private port: number

  private ws: WebSocket | null = null
  private lineBuffer = ''
  private status: ClientStatus = 'connecting'
  private destroyed = false

  private companionVersion = ''
  private apiVersion = ''

  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempt = 0
  private keepaliveTimer: NodeJS.Timeout | null = null
  private keepaliveTimeoutTimer: NodeJS.Timeout | null = null

  // Alle aktiven Subscriptions (sowohl 'cwp/' als auch 'picker/' Prefix).
  // Werden bei Reconnect automatisch re-subscribed.
  private activeSubs = new Map<string, SubInfo>()

  constructor(hostId: string, host: string, port: number) {
    super()
    this.hostId = hostId
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
    // REMOVE-SUB für alle aktiven Subscriptions senden
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      for (const subId of this.activeSubs.keys()) {
        this.sendLine(`REMOVE-SUB SUBID=${subId}`)
      }
      // Kurz warten damit Companion die REMOVE-SUBs verarbeiten kann
      await new Promise(r => setTimeout(r, 150))
    }
    this.ws?.close()
    this.ws = null
  }

  /**
   * Abonniert einen Button. Wenn bereits verbunden, wird ADD-SUB sofort gesendet.
   * Bei Reconnect werden alle aktiven Subscriptions automatisch re-subscribed.
   */
  subscribe(subId: string, page: number, row: number, col: number): void {
    this.activeSubs.set(subId, { page, row, col })
    if (this.status === 'connected') {
      this.sendAddSub(subId, page, row, col)
    }
  }

  /**
   * Deabonniert einen Button. REMOVE-SUB wird gesendet wenn verbunden.
   */
  unsubscribe(subId: string): void {
    if (!this.activeSubs.has(subId)) return
    this.activeSubs.delete(subId)
    if (this.status === 'connected') {
      this.sendLine(`REMOVE-SUB SUBID=${subId}`)
    }
  }

  /**
   * Sendet einen Button-Press oder Release an Companion.
   * Erfordert eine aktive Subscription für den Button.
   */
  press(page: number, row: number, col: number, pressed: boolean): void {
    if (this.status !== 'connected') return
    const subId = `cwp/${page}/${row}/${col}`
    const pressedStr = pressed ? 'true' : 'false'
    this.sendLine(`SUB-PRESS SUBID=${subId} PRESSED=${pressedStr}`)
  }

  /**
   * Sendet einen SUB-ROTATE an Companion.
   * direction: 1 = CW (up/right), -1 = CCW (down/left)
   */
  rotate(page: number, row: number, col: number, direction: 1 | -1): void {
    if (this.status !== 'connected') return
    const subId = `cwp/${page}/${row}/${col}`
    this.sendLine(`SUB-ROTATE SUBID=${subId} DIRECTION=${direction}`)
  }

  getStatus(): ClientStatus {
    return this.status
  }

  getVersionInfo(): { companionVersion: string; apiVersion: string } {
    return { companionVersion: this.companionVersion, apiVersion: this.apiVersion }
  }

  // ─── Connection ────────────────────────────────────────────────────────────

  private connect(): void {
    this.setStatus('connecting')
    this.lineBuffer = ''

    const url = `ws://${this.host}:${this.port}`
    const socket = new WebSocket(url)
    this.ws = socket

    socket.on('open', () => {
      this.reconnectAttempt = 0
      // Kein ADD-DEVICE — wir warten auf BEGIN + CAPS vom Server
    })

    socket.on('message', (data: WebSocket.RawData) => {
      const chunk = data.toString()
      // Zeilenbasiertes Protokoll — mehrere Zeilen pro WS-Frame möglich
      this.lineBuffer += chunk
      if (this.lineBuffer.length > LINE_BUFFER_MAX_BYTES) {
        console.error(`[SatelliteClient ${this.hostId}] Line buffer overflow (${this.lineBuffer.length} B) — disconnect`)
        this.lineBuffer = ''
        this.ws?.close()
        return
      }
      const lines = this.lineBuffer.split('\n')
      this.lineBuffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed) this.handleLine(trimmed)
      }
    })

    socket.on('close', () => {
      this.clearTimers()
      if (!this.destroyed) {
        this.setStatus('stale')
        this.scheduleReconnect()
      }
    })

    socket.on('error', (err: Error) => {
      console.error(`[SatelliteClient ${this.hostId}] WebSocket-Fehler: ${err.message}`)
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
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) this.connect()
    }, delayMs)
  }

  // ─── Protocol ──────────────────────────────────────────────────────────────

  private handleLine(line: string): void {
    if (line.startsWith('BEGIN ')) {
      this.handleBegin(line)
    } else if (line.startsWith('CAPS ')) {
      this.handleCaps(line)
    } else if (line.startsWith('PING')) {
      // Companion sendet PING (server-seitig) — mit PONG antworten
      this.sendLine('PONG')
    } else if (line.startsWith('PONG')) {
      // Antwort auf unseren PING — Timeout-Timer abbrechen
      if (this.keepaliveTimeoutTimer) {
        clearTimeout(this.keepaliveTimeoutTimer)
        this.keepaliveTimeoutTimer = null
      }
    } else if (line.startsWith('SUB-STATE ')) {
      this.handleSubState(line)
    } else if (line.startsWith('ADD-SUB OK')) {
      // Bestätigung ignorieren — wir vertrauen darauf dass der Subscribe-Aufruf klappt
    } else if (line.startsWith('REMOVE-SUB OK')) {
      // Bestätigung ignorieren
    } else if (line.startsWith('SUB-PRESS OK')) {
      // Bestätigung ignorieren
    } else if (line.startsWith('SUB-ROTATE OK')) {
      // Bestätigung ignorieren
    }
    // Alte ADD-DEVICE / KEY-STATE Zeilen ignorieren (sollten nicht kommen)
  }

  private handleBegin(line: string): void {
    // BEGIN CompanionVersion="4.3.0+..." ApiVersion="1.10.0"
    // Versionen speichern + Event emittieren — auf CAPS warten bevor wir subscriben
    const params = parseParams(line.slice('BEGIN '.length))
    this.apiVersion = params['ApiVersion'] ?? '?'
    this.companionVersion = params['CompanionVersion'] ?? '?'
    console.log(`[SatelliteClient ${this.hostId}] Companion ${this.companionVersion} API ${this.apiVersion}`)
    this.emit('begin', this.companionVersion, this.apiVersion)
  }

  private handleCaps(line: string): void {
    // CAPS SUBSCRIPTIONS=1   → aktiviert
    // CAPS SUBSCRIPTIONS=0   → deaktiviert, User muss in Companion Settings aktivieren
    const params = parseParams(line.slice('CAPS '.length))
    const subsEnabled = params['SUBSCRIPTIONS']

    if (subsEnabled === '0') {
      console.error(
        `[SatelliteClient ${this.hostId}] CAPS SUBSCRIPTIONS=0 — ` +
        `"Button Subscriptions API" in Companion Settings aktivieren!`,
      )
      this.setStatus('caps-disabled')
      return
    }

    // Verbunden! Alle aktiven Subscriptions re-subscriben (auch nach Reconnect)
    this.setStatus('connected')
    for (const [subId, { page, row, col }] of this.activeSubs) {
      this.sendAddSub(subId, page, row, col)
    }
    this.startKeepalive()
  }

  private startKeepalive(): void {
    this.keepaliveTimer = setInterval(() => {
      this.sendLine(`PING ${Date.now()}`)
      // Alten Timeout clearen bevor neuer gesetzt wird — sonst orphaned Timer bei Jitter
      if (this.keepaliveTimeoutTimer) clearTimeout(this.keepaliveTimeoutTimer)
      // Wenn kein PONG innerhalb KEEPALIVE_TIMEOUT_MS → Verbindung schließen
      this.keepaliveTimeoutTimer = setTimeout(() => {
        console.warn(`[SatelliteClient ${this.hostId}] PONG Timeout — reconnect`)
        this.ws?.close()
      }, KEEPALIVE_TIMEOUT_MS)
    }, KEEPALIVE_INTERVAL_MS)
  }

  private handleSubState(line: string): void {
    // SUB-STATE SUBID="cwp/1/0/0" PRESSED=0 TYPE=BUTTON COLOR=#ff0000
    //           TEXT=<base64> BITMAP=<base64> FONT_SIZE=auto
    const params = parseParams(line.slice('SUB-STATE '.length))
    const subId = params['SUBID']
    if (!subId) return

    // subId-Format: "cwp/<page>/<row>/<col>" oder "picker/<page>/<row>/<col>"
    const parts = subId.split('/')
    if (parts.length < 4) return
    const page = parseInt(parts[1], 10)
    const row = parseInt(parts[2], 10)
    const col = parseInt(parts[3], 10)
    if (isNaN(page) || isNaN(row) || isNaN(col)) return

    const state: Partial<KeyState> = {}

    // COLOR=hex (bei COLORS=hex) oder rgb(...) (bei COLORS=true) — wir senden COLORS=hex
    const color = params['COLOR']
    if (color !== undefined) state.bgColor = color

    // TEXT_COLOR (Textfarbe) — kann auch als TEXTCOLOR kommen
    const textColor = params['TEXT_COLOR'] ?? params['TEXTCOLOR']
    if (textColor !== undefined) state.textColor = textColor

    // TEXT = base64-encodierter UTF8-Text
    const text = params['TEXT']
    if (text !== undefined) {
      const decoded = decodeBase64Utf8(text)
      // Companion encodiert Zeilenumbrüche als literale \n-Escape-Sequenz
      state.text = decoded.replace(/\\n/g, '\n')
    }

    // BITMAP = Raw-RGB base64 (72×72×3 Bytes)
    const bitmap = params['BITMAP']
    if (bitmap !== undefined) state.bitmap = bitmap

    // FONT_SIZE = "auto" oder Zahl — ignorieren (nicht Teil des KeyState)

    this.emit('subState', subId, page, row, col, state)
  }

  // ─── Send Helpers ──────────────────────────────────────────────────────────

  private sendAddSub(subId: string, page: number, row: number, col: number): void {
    // LOCATION-Format: "<page>/<row>/<col>"
    this.sendLine(
      `ADD-SUB SUBID=${subId} LOCATION=${page}/${row}/${col} ` +
      `BITMAP=72 COLORS=hex TEXT=true TEXT_STYLE=true`,
    )
  }

  private sendLine(line: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(line + '\n')
  }

  private setStatus(status: ClientStatus): void {
    if (this.status === status) return
    this.status = status
    this.emit('status', status)
  }

  private clearTimers(): void {
    if (this.keepaliveTimer) { clearInterval(this.keepaliveTimer); this.keepaliveTimer = null }
    if (this.keepaliveTimeoutTimer) { clearTimeout(this.keepaliveTimeoutTimer); this.keepaliveTimeoutTimer = null }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
  }
}

// ─── Protocol Helpers ────────────────────────────────────────────────────────

// Hot Path: einmal compilieren statt pro Aufruf. lastIndex wird vor jeder
// Verwendung zurückgesetzt — kein State-Leak zwischen Aufrufen.
const PARAM_REGEX = /(\w+)=(?:"([^"]*)"|(\S+))/g

function parseParams(str: string): Record<string, string> {
  const result: Record<string, string> = {}
  PARAM_REGEX.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PARAM_REGEX.exec(str)) !== null) {
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
  } catch {
    // ignore
  }
  return value
}

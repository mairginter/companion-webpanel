/**
 * SatelliteSession.ts
 *
 * Verwaltet eine einzelne Satellite-Verbindung zu einer Companion-Instanz
 * für genau ein (hostId, page)-Paar.
 *
 * Aufgaben:
 *  - WebSocket-Verbindung zu Companion auf Port 16623 aufbauen und halten
 *  - Companion Satellite-Protokoll sprechen: ADD-DEVICE, KEY-STATE, KEY-PRESS,
 *    PING/PONG (Keepalive), REMOVE-DEVICE (Graceful Shutdown)
 *  - Eingehende KEY-STATE-Nachrichten parsen und als 'keyState'-Events emittieren
 *  - Verbindungsabbrüche erkennen und mit Exponential Backoff reconnecten
 *  - Status-Events ('connecting', 'connected', 'stale', 'error') emittieren
 *    damit das Frontend den Verbindungszustand anzeigen kann
 */
import WebSocket from 'ws'
import { EventEmitter } from 'events'
import * as os from 'os'
import { KeyState, SurfaceConfig, deviceId as makeDeviceId } from '@cwp/shared'

export type SessionStatus = 'connecting' | 'connected' | 'stale' | 'error'

// Exponential Backoff: 1s, 2s, 4s, 8s, 16s, 30s (cap)
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000]
const KEEPALIVE_INTERVAL_MS = 2000
const KEEPALIVE_TIMEOUT_MS = 6000

/**
 * Verwaltet eine Satellite-Verbindung zu Companion für ein (hostId, page)-Paar.
 * Verwendet WebSocket auf Port 16623 (Companion Satellite WS-API).
 * Emittiert 'keyState' für jeden geänderten Button und 'status' bei Verbindungsänderungen.
 */
export class SatelliteSession extends EventEmitter {
  readonly hostId: string
  readonly page: number
  readonly deviceId: string

  private host: string
  private port: number
  readonly surfaceConfig: SurfaceConfig

  private ws: WebSocket | null = null
  private lineBuffer = ''
  private status: SessionStatus = 'connecting'
  private destroyed = false

  private keepaliveTimer: NodeJS.Timeout | null = null
  private keepaliveTimeoutTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempt = 0

  constructor(
    hostId: string,
    page: number,
    host: string,
    port: number,
    surfaceConfig: SurfaceConfig,
  ) {
    super()
    this.hostId = hostId
    this.page = page
    this.host = host
    this.port = port
    this.surfaceConfig = surfaceConfig
    this.deviceId = makeDeviceId(hostId, page)
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  start(): void {
    if (this.destroyed) return
    this.connect()
  }

  async stop(): Promise<void> {
    this.destroyed = true
    this.clearTimers()
    await this.sendRemoveDevice()
    this.ws?.close()
    this.ws = null
  }

  sendKeyPress(keyIndex: number, pressed: boolean): void {
    if (this.status !== 'connected') {
      console.warn(`[Satellite ${this.deviceId}] sendKeyPress ignoriert — status=${this.status}`)
      return
    }
    const id = this.deviceId
    const pressedStr = pressed ? 'true' : 'false'
    this.sendLine(`KEY-PRESS DEVICEID="${id}" KEY=${keyIndex} PRESSED=${pressedStr}`)
  }

  getStatus(): SessionStatus {
    return this.status
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
    })

    socket.on('message', (data: WebSocket.RawData) => {
      const chunk = data.toString()
      // Companion sendet Kommandos zeilenweise — manche WS-Implementierungen
      // schicken mehrere Zeilen in einer Nachricht
      this.lineBuffer += chunk
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
      console.error(`[Satellite ${this.deviceId}] WebSocket-Fehler: ${err.message}`)
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
    } else if (line.startsWith('KEY-STATE ')) {
      this.handleKeyState(line)
    } else if (line.startsWith('PONG')) {
      this.handlePong()
    } else if (line.startsWith('ADD-DEVICE OK')) {
      this.setStatus('connected')
      this.startKeepalive()
    } else if (line.startsWith('ADD-DEVICE ERROR')) {
      console.error(`[Satellite ${this.deviceId}] ADD-DEVICE Fehler: ${line}`)
      this.setStatus('error')
    } else if (line.startsWith('KEYS-CLEAR')) {
      this.emit('keysClear')
    }
  }

  private handleBegin(line: string): void {
    this.sendAddDevice()
  }

  private handleKeyState(line: string): void {
    // KEY-STATE DEVICEID="..." KEY=30 TYPE=BUTTON COLOR=rgb(255,0,0) TEXT=Live BITMAP=<base64>
    const params = parseParams(line.slice('KEY-STATE '.length))
    const keyParam = params['KEY']
    if (keyParam === undefined) return

    const keyIdx = parseInt(keyParam, 10)
    if (isNaN(keyIdx)) return

    const state: Partial<KeyState> = {}

    const color = params['COLOR']
    if (color !== undefined) state.bgColor = color

    const textColor = params['TEXTCOLOR'] ?? params['TEXT_COLOR']
    if (textColor !== undefined) state.textColor = textColor

    const text = params['TEXT']
    if (text !== undefined) {
      const decoded = decodeBase64Utf8(text)
      // Companion encodiert Zeilenumbrüche als literale \n-Escape-Sequenz
      state.text = decoded.replace(/\\n/g, '\n')
    }

    const bitmap = params['BITMAP']
    if (bitmap !== undefined) state.bitmap = bitmap

    this.emit('keyState', keyIdx, state)
  }

  private handlePong(): void {
    if (this.keepaliveTimeoutTimer) {
      clearTimeout(this.keepaliveTimeoutTimer)
      this.keepaliveTimeoutTimer = null
    }
  }

  private sendAddDevice(): void {
    const { keysPerRow, rows } = this.surfaceConfig
    const keysTotal = keysPerRow * rows
    const name = `Webpanel ${os.hostname()} P${this.page}`
    this.sendLine(
      `ADD-DEVICE DEVICEID="${this.deviceId}" PRODUCT_NAME="${name}" ` +
      `KEYS_TOTAL=${keysTotal} KEYS_PER_ROW=${keysPerRow} ` +
      `BITMAPS=72 COLORS=true TEXT=true TEXT_STYLE=true`,
    )
  }

  private async sendRemoveDevice(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendLine(`REMOVE-DEVICE DEVICEID="${this.deviceId}"`)
      await new Promise(r => setTimeout(r, 150))
    }
  }

  // ─── Keepalive ─────────────────────────────────────────────────────────────

  private startKeepalive(): void {
    this.keepaliveTimer = setInterval(() => {
      const ts = Date.now()
      this.sendLine(`PING ${ts}`)
      this.keepaliveTimeoutTimer = setTimeout(() => {
        console.warn(`[Satellite ${this.deviceId}] PONG Timeout — reconnect`)
        this.ws?.close()
      }, KEEPALIVE_TIMEOUT_MS)
    }, KEEPALIVE_INTERVAL_MS)
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private sendLine(line: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(line + '\n')
  }

  private setStatus(status: SessionStatus): void {
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
  } catch {
    // ignore
  }
  return value
}

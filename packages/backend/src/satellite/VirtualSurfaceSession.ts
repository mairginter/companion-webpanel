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
    // Initialen Status immer emittieren (damit neuer Frontend-Client ihn bekommt)
    this.emit('status', this.status)
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
      this.ws?.close()
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

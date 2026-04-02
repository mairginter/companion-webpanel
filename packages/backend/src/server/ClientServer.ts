/**
 * ClientServer.ts
 *
 * HTTP- und WebSocket-Server für alle verbundenen Browser-Clients (Frontend-PWA).
 *
 * Aufgaben:
 *  - GET /api/settings  → liefert die geladenen Settings als JSON an das Frontend
 *  - WebSocket-Verbindungen verwalten (connect, disconnect, broadcast)
 *  - Eingehende KEY-PRESS-Nachrichten vom Browser ans SessionManager weiterleiten
 *  - Snapshots bei neuem Client-Connect senden (via onNewClient-Callback)
 *  - Press-Tracker: verfolgt pro Client welche Buttons gerade gedrückt gehalten werden,
 *    damit bei unerwartetem Disconnect (Tab-Close, Browser-Crash) automatisch
 *    PRESSED=false an Companion gesendet wird — verhindert "stuck buttons"
 *  - Graceful Shutdown: alle Clients sofort terminieren, Port sauber freigeben
 */
import * as http from 'http'
import * as fs from 'fs'
import { WebSocketServer, WebSocket } from 'ws'
import {
  BackendToFrontend,
  FrontendToBackend,
  Settings,
  SnapshotMessage,
} from '@cwp/shared'

export type PressHandler = (hostId: string, page: number, row: number, col: number, pressed: boolean) => void

// Eindeutiger Key für einen gehaltenen Button
type PressKey = `${string}:${number}:${number}:${number}`

function pressKey(hostId: string, page: number, row: number, col: number): PressKey {
  return `${hostId}:${page}:${row}:${col}`
}

/**
 * HTTP + WebSocket Server für Frontend-Browser-Clients.
 * HTTP:      GET /api/settings  → liefert die geladenen Settings als JSON
 * WebSocket: Snapshot bei Connect, Delta-Broadcast, Press-Kommandos
 */
export class ClientServer {
  private httpServer: http.Server
  private wss: WebSocketServer
  private clients = new Set<WebSocket>()
  // Welche Buttons hält welcher Client gerade gedrückt?
  // Wichtig: bei disconnect → PRESSED=false für alle offenen Presses senden
  private clientPresses = new Map<WebSocket, Set<PressKey>>()
  private onPress: PressHandler
  private settings: Settings
  private settingsPath: string

  constructor(port: number, settings: Settings, settingsPath: string, onPress: PressHandler) {
    this.settings = settings
    this.settingsPath = settingsPath
    this.onPress = onPress

    // ─── HTTP Server ────────────────────────────────────────────────────────
    this.httpServer = http.createServer((req, res) => {
      // CORS für Vite-Dev-Server (erlaubt GET und POST vom separaten Dev-Origin :5173)
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      // CORS Preflight (Browser sendet OPTIONS vor POST)
      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      if (req.method === 'GET' && req.url === '/api/settings') {
        const json = JSON.stringify(this.settings, null, 2)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(json)

      } else if (req.method === 'POST' && req.url === '/api/settings') {
        // Gesamten Request-Body einlesen
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const incoming = JSON.parse(body) as Settings

            // Minimalvalidierung: Version muss stimmen
            if (incoming.version !== '1.1.0') {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: `Ungültige Schema-Version: ${incoming.version}` }))
              return
            }

            // Atomar schreiben: erst temp-Datei, dann umbenennen —
            // verhindert korrupte Settings-Datei bei Prozess-Crash während des Schreibens
            const tmpPath = this.settingsPath + '.tmp'
            fs.writeFileSync(tmpPath, JSON.stringify(incoming, null, 2), 'utf8')
            fs.renameSync(tmpPath, this.settingsPath)

            // In-Memory-Kopie aktualisieren damit GET /api/settings sofort den neuen Stand liefert
            this.settings = incoming

            console.log('[ClientServer] Settings gespeichert')
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))

          } catch (err) {
            console.error('[ClientServer] Fehler beim Speichern der Settings:', err)
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Interner Fehler beim Speichern' }))
          }
        })

      } else {
        res.writeHead(404)
        res.end()
      }
    })

    // ─── WebSocket Server (auf demselben Port via HTTP-Upgrade) ─────────────
    this.wss = new WebSocketServer({ server: this.httpServer })

    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      const ip = req.socket.remoteAddress ?? 'unknown'
      console.log(`[ClientServer] Client verbunden von ${ip}`)
      this.clients.add(ws)
      this.clientPresses.set(ws, new Set())

      this.emit('newClient', ws)

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as FrontendToBackend
          if (msg.t === 'press') {
            const key = pressKey(msg.hostId, msg.page, msg.row, msg.col)
            const presses = this.clientPresses.get(ws)
            if (presses) {
              if (msg.pressed) {
                presses.add(key)
              } else {
                presses.delete(key)
              }
            }
            this.onPress(msg.hostId, msg.page, msg.row, msg.col, msg.pressed)
          }
        } catch {
          console.warn('[ClientServer] Ungültige Nachricht vom Client')
        }
      })

      const cleanup = () => {
        this.clients.delete(ws)
        // Alle vom Client noch gehaltenen Buttons loslassen
        const presses = this.clientPresses.get(ws)
        if (presses && presses.size > 0) {
          console.warn(`[ClientServer] Client ${ip} getrennt mit ${presses.size} offenem/n Press(es) — sende PRESSED=false`)
          for (const key of presses) {
            const [hostId, pageStr, rowStr, colStr] = key.split(':')
            this.onPress(hostId, parseInt(pageStr), parseInt(rowStr), parseInt(colStr), false)
          }
        }
        this.clientPresses.delete(ws)
      }

      ws.on('close', () => {
        console.log(`[ClientServer] Client getrennt (${ip})`)
        cleanup()
      })

      ws.on('error', (err) => {
        console.error(`[ClientServer] Client-Fehler: ${err.message}`)
        cleanup()
      })
    })

    this.httpServer.listen(port, () => {
      console.log(`[ClientServer] HTTP+WS auf http://localhost:${port}`)
      console.log(`[ClientServer] Settings-API: http://localhost:${port}/api/settings`)
    })
  }

  broadcast(msg: BackendToFrontend): void {
    const json = JSON.stringify(msg)
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(json)
    }
  }

  sendSnapshotToClient(ws: WebSocket, snapshot: SnapshotMessage): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(snapshot))
  }

  onNewClient(handler: (ws: WebSocket) => void): void {
    this.newClientListeners.push(handler)
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Alle verbundenen WS-Clients sofort terminieren — sonst wartet httpServer.close()
      // bis alle Clients sich selbst trennen → Port bleibt blockiert
      for (const ws of this.clients) ws.terminate()
      this.clients.clear()

      this.wss.close()
      // closeAllConnections() schließt HTTP keep-alive Verbindungen (Node 18+)
      if (typeof (this.httpServer as any).closeAllConnections === 'function') {
        ;(this.httpServer as any).closeAllConnections()
      }
      this.httpServer.close((err) => (err ? reject(err) : resolve()))
    })
  }

  private newClientListeners: Array<(ws: WebSocket) => void> = []

  private emit(event: 'newClient', ws: WebSocket): void {
    if (event === 'newClient') {
      for (const l of this.newClientListeners) l(ws)
    }
  }
}

/**
 * ClientServer.ts
 *
 * HTTP- und WebSocket-Server für alle verbundenen Browser-Clients (Frontend-PWA).
 *
 * Aufgaben:
 *  - GET  /api/settings  → liefert die geladenen Settings als JSON
 *  - POST /api/settings  → speichert neue Settings (atomisch, tmp→rename)
 *  - POST /api/preview-page  → startet temporäre Subscriptions für den Button-Picker-Dialog
 *  - DELETE /api/preview-page → beendet temporäre Subscriptions (Picker geschlossen)
 *  - WebSocket-Verbindungen verwalten (connect, disconnect, broadcast)
 *  - Eingehende KEY-PRESS-Nachrichten vom Browser ans HostManager weiterleiten
 *  - Snapshots bei neuem Client-Connect senden (via onNewClient-Callback)
 *  - Press-Tracker: verfolgt pro Client welche Buttons gerade gedrückt gehalten werden,
 *    damit bei unerwartetem Disconnect automatisch PRESSED=false gesendet wird
 *  - Graceful Shutdown: alle Clients sofort terminieren, Port sauber freigeben
 */
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import { WebSocketServer, WebSocket } from 'ws'
import {
  BackendToFrontend,
  FrontendToBackend,
  Settings,
  SnapshotMessage,
} from '@cwp/shared'

export type PressHandler = (hostId: string, page: number, row: number, col: number, pressed: boolean) => void
export type PreviewPageHandler = (hostId: string, page: number, keysPerRow: number, rows: number) => void
export type PreviewPageRemoveHandler = (hostId: string, page: number) => void

// Eindeutiger Key für einen gehaltenen Button
type PressKey = `${string}:${number}:${number}:${number}`

function pressKey(hostId: string, page: number, row: number, col: number): PressKey {
  return `${hostId}:${page}:${row}:${col}`
}

/**
 * HTTP + WebSocket Server für Frontend-Browser-Clients.
 */
export class ClientServer {
  private httpServer: http.Server
  private wss: WebSocketServer
  private clients = new Set<WebSocket>()
  private clientPresses = new Map<WebSocket, Set<PressKey>>()
  private onPress: PressHandler
  private onSettingsUpdate?: (settings: Settings) => void
  private onPreviewPageAdd?: PreviewPageHandler
  private onPreviewPageRemove?: PreviewPageRemoveHandler
  private settings: Settings
  private settingsPath: string
  private staticDir?: string

  constructor(
    port: number,
    settings: Settings,
    settingsPath: string,
    onPress: PressHandler,
    onSettingsUpdate?: (s: Settings) => void,
    onPreviewPageAdd?: PreviewPageHandler,
    onPreviewPageRemove?: PreviewPageRemoveHandler,
    staticDir?: string,
  ) {
    this.settings = settings
    this.settingsPath = settingsPath
    this.onPress = onPress
    this.onSettingsUpdate = onSettingsUpdate
    this.onPreviewPageAdd = onPreviewPageAdd
    this.onPreviewPageRemove = onPreviewPageRemove
    this.staticDir = staticDir

    // ─── HTTP Server ────────────────────────────────────────────────────────
    this.httpServer = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

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
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const incoming = JSON.parse(body) as Settings

            if (incoming.version !== '1.3.0') {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: `Ungültige Schema-Version: ${incoming.version}` }))
              return
            }

            const tmpPath = this.settingsPath + '.tmp'
            fs.writeFileSync(tmpPath, JSON.stringify(incoming, null, 2), 'utf8')
            fs.renameSync(tmpPath, this.settingsPath)

            this.settings = incoming
            this.onSettingsUpdate?.(incoming)

            console.log('[ClientServer] Settings gespeichert')
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))

          } catch (err) {
            console.error('[ClientServer] Fehler beim Speichern der Settings:', err)
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Interner Fehler beim Speichern' }))
          }
        })

      } else if (req.method === 'POST' && req.url === '/api/preview-page') {
        // Temporäre Subscriptions für den Button-Picker-Dialog starten
        // Body: { hostId, page, keysPerRow, rows }
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const { hostId, page, keysPerRow, rows } = JSON.parse(body)
            if (!hostId || page === undefined || !keysPerRow || !rows) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'hostId, page, keysPerRow, rows erforderlich' }))
              return
            }
            this.onPreviewPageAdd?.(hostId, page, keysPerRow, rows)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Ungültiger Request-Body' }))
          }
        })

      } else if (req.method === 'DELETE' && req.url?.startsWith('/api/preview-page')) {
        // Picker-Subscriptions beenden
        // Query-Parameter: hostId + page
        const url = new URL(req.url, `http://localhost`)
        const hostId = url.searchParams.get('hostId')
        const page = parseInt(url.searchParams.get('page') ?? '', 10)
        if (!hostId || isNaN(page)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'hostId und page erforderlich' }))
          return
        }
        this.onPreviewPageRemove?.(hostId, page)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))

      } else {
        // Static file serving (für pakettierten Electron-Build)
        if (this.staticDir && req.method === 'GET') {
          this.serveStatic(req.url ?? '/', res)
        } else {
          res.writeHead(404)
          res.end()
        }
      }
    })

    // ─── WebSocket Server ─────────────────────────────────────────────────
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
              if (msg.pressed) presses.add(key)
              else presses.delete(key)
            }
            this.onPress(msg.hostId, msg.page, msg.row, msg.col, msg.pressed)
          }
        } catch {
          console.warn('[ClientServer] Ungültige Nachricht vom Client')
        }
      })

      const cleanup = () => {
        this.clients.delete(ws)
        const presses = this.clientPresses.get(ws)
        if (presses && presses.size > 0) {
          console.warn(`[ClientServer] Client ${ip} getrennt mit ${presses.size} offenem/n Press(es) — sende PRESSED=false`)
          for (const key of presses) {
            const parts = key.split(':')
            const hostId = parts[0]
            const page = parseInt(parts[1])
            const row = parseInt(parts[2])
            const col = parseInt(parts[3])
            this.onPress(hostId, page, row, col, false)
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

    this.httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[ClientServer] Port ${port} ist bereits belegt — laufenden Prozess beenden und neu starten.`)
        process.exit(1)
      } else {
        console.error('[ClientServer] Server-Fehler:', err)
      }
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
      for (const ws of this.clients) ws.terminate()
      this.clients.clear()

      this.wss.close()
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

  /**
   * Serviert statische Dateien aus this.staticDir.
   * Fallback: index.html für SPA-Routing (alle nicht-gefundenen Pfade → index.html).
   */
  private serveStatic(urlPath: string, res: http.ServerResponse): void {
    const staticDir = this.staticDir!
    // URL-Pfad normalisieren (query-string entfernen, path-traversal verhindern)
    const safePath = urlPath.split('?')[0].replace(/\.\./g, '')
    const filePath = safePath === '/' || safePath === ''
      ? path.join(staticDir, 'index.html')
      : path.join(staticDir, safePath)

    const mimeTypes: Record<string, string> = {
      '.html':  'text/html',
      '.js':    'application/javascript',
      '.css':   'text/css',
      '.png':   'image/png',
      '.svg':   'image/svg+xml',
      '.ico':   'image/x-icon',
      '.json':  'application/json',
      '.woff2': 'font/woff2',
      '.woff':  'font/woff',
    }

    const ext = path.extname(filePath)
    const mime = mimeTypes[ext] ?? 'application/octet-stream'

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.writeHead(200, { 'Content-Type': mime })
      fs.createReadStream(filePath).pipe(res)
    } else {
      // SPA-Fallback: index.html für alle unbekannten Pfade
      const indexPath = path.join(staticDir, 'index.html')
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        fs.createReadStream(indexPath).pipe(res)
      } else {
        res.writeHead(404)
        res.end()
      }
    }
  }
}

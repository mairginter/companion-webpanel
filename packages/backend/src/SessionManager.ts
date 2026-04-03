/**
 * SessionManager.ts
 *
 * Orchestriert alle Satellite-Sessions und verbindet die drei Schichten:
 * SatelliteSession ↔ StateStore ↔ ClientServer.
 *
 * Aufgaben:
 *  - Beim Start: für jede (hostId, page)-Kombination aus den Settings eine
 *    SatelliteSession anlegen und starten
 *  - KEY-STATE-Events von Sessions in den StateStore schreiben und
 *    resultierende Deltas an alle Frontend-Clients broadcasten
 *  - Status-Änderungen der Sessions direkt an Clients broadcasten
 *  - KEY-PRESS-Anfragen vom Frontend an die richtige Session weiterleiten
 *    (row/col → keyIndex-Berechnung anhand surfaceConfig)
 *  - Beim Shutdown: alle Sessions sauber beenden (REMOVE-DEVICE)
 */
import { WebSocket } from 'ws'
import { Settings, pageKey, keyIndex as calcKeyIndex } from '@cwp/shared'
import { SatelliteSession, SessionStatus } from './satellite/SatelliteSession'
import { StateStore } from './state/StateStore'
import { ClientServer } from './server/ClientServer'

/**
 * Verwaltet alle Satellite-Sessions (eine pro hostId:page-Kombination aus den Settings).
 * Verbindet StateStore, SatelliteSession und ClientServer.
 */
export class SessionManager {
  private sessions = new Map<string, SatelliteSession>()
  private store: StateStore
  private clientServer: ClientServer

  constructor(store: StateStore, clientServer: ClientServer) {
    this.store = store
    this.clientServer = clientServer

    // Snapshot an jeden neuen Frontend-Client senden
    clientServer.onNewClient((ws) => this.sendAllSnapshotsToClient(ws))
  }

  /** Startet alle Sessions aus den Settings */
  start(settings: Settings): void {
    const { hosts, wizard } = settings

    // Alle (hostId, page) Paare aus wizard.pageAssignments sammeln
    const assignments = wizard?.pageAssignments ?? {}

    for (const [key, assignment] of Object.entries(assignments)) {
      const { page, surfaceConfig } = assignment
      // key = "hostId:page" — hostId extrahieren
      const hostId = key.slice(0, key.lastIndexOf(':'))
      const host = hosts.find((h) => h.id === hostId)

      if (!host) {
        console.warn(`[SessionManager] Host "${hostId}" nicht in settings.hosts gefunden — überspringe`)
        continue
      }

      const sessionKey = pageKey(hostId, page)
      if (this.sessions.has(sessionKey)) continue

      const session = new SatelliteSession(
        hostId,
        page,
        host.host,
        host.satellite.wsPort,
        surfaceConfig,
      )

      session.on('keyState', (keyIdx: number, state) => {
        const delta = this.store.update(hostId, page, keyIdx, state)
        if (delta) this.clientServer.broadcast(delta)
      })

      session.on('status', (status: SessionStatus) => {
        this.clientServer.broadcast({ t: 'sessionStatus', hostId, page, status })
      })

      session.on('keysClear', () => {
        this.store.clearSession(hostId, page)
        // Leeren Snapshot broadcasten
        this.clientServer.broadcast({ t: 'snapshot', hostId, page, keys: {} })
      })

      this.sessions.set(sessionKey, session)
      session.start()
    }

    if (this.sessions.size === 0) {
      console.warn('[SessionManager] Keine pageAssignments in Settings — nichts zu verbinden.')
      console.warn('[SessionManager] Füge pageAssignments in CompanionWebpannelSettings.json hinzu.')
    }
  }

  /** Leitet einen KEY-PRESS/RELEASE an die richtige Session weiter */
  handlePress(hostId: string, page: number, row: number, col: number, pressed: boolean): void {
    const sessionKey = pageKey(hostId, page)
    const session = this.sessions.get(sessionKey)

    if (!session) {
      console.warn(`[SessionManager] Kein Session gefunden für ${sessionKey}`)
      return
    }

    const keysPerRow = session['surfaceConfig'].keysPerRow
    const idx = calcKeyIndex(row, col, keysPerRow)
    session.sendKeyPress(idx, pressed)
  }

  /**
   * Neue Sessions für neu hinzugekommene pageAssignments starten.
   * Wird nach POST /api/settings aufgerufen — bestehende Sessions bleiben unberührt.
   */
  update(settings: Settings): void {
    const { hosts, wizard } = settings
    const assignments = wizard?.pageAssignments ?? {}

    for (const [key, assignment] of Object.entries(assignments)) {
      const { page, surfaceConfig } = assignment
      const hostId = key.slice(0, key.lastIndexOf(':'))
      const sessionKey = pageKey(hostId, page)

      if (this.sessions.has(sessionKey)) continue  // bereits aktiv

      const host = hosts.find((h) => h.id === hostId)
      if (!host) continue

      const session = new SatelliteSession(hostId, page, host.host, host.satellite.wsPort, surfaceConfig)

      session.on('keyState', (keyIdx: number, state) => {
        const delta = this.store.update(hostId, page, keyIdx, state)
        if (delta) this.clientServer.broadcast(delta)
      })
      session.on('status', (status: SessionStatus) => {
        this.clientServer.broadcast({ t: 'sessionStatus', hostId, page, status })
      })
      session.on('keysClear', () => {
        this.store.clearSession(hostId, page)
        this.clientServer.broadcast({ t: 'snapshot', hostId, page, keys: {} })
      })

      this.sessions.set(sessionKey, session)
      session.start()
      console.log(`[SessionManager] Neue Session gestartet: ${sessionKey}`)
    }
  }

  /** Graceful Shutdown: REMOVE-DEVICE für alle Sessions */
  async stop(): Promise<void> {
    await Promise.all([...this.sessions.values()].map((s) => s.stop()))
    this.sessions.clear()
  }

  /** Sendet Snapshots aller Sessions an einen einzelnen neuen Client */
  private sendAllSnapshotsToClient(ws: WebSocket): void {
    for (const session of this.sessions.values()) {
      const keys = this.store.getAll(session.hostId, session.page)
      this.clientServer.sendSnapshotToClient(ws, {
        t: 'snapshot',
        hostId: session.hostId,
        page: session.page,
        keys,
      })
      // Auch aktuellen Status senden
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(JSON.stringify({
          t: 'sessionStatus',
          hostId: session.hostId,
          page: session.page,
          status: session.getStatus(),
        }))
      }
    }
  }
}

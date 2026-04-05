/**
 * HostManager.ts
 *
 * Ersetzt SessionManager. Verwaltet eine SatelliteClient-Instanz pro Host
 * und hält alle Button-Subscriptions synchron mit den aktuellen Panel-Settings.
 *
 * Aufgaben:
 *  - 1 SatelliteClient pro hostId anlegen und starten
 *  - syncSubscriptions(settings): Panel-Elemente auslesen → Subscriptions diffsen
 *    → ADD-SUB für neue, REMOVE-SUB für entfernte companionButton-Refs
 *  - addPickerSubscriptions / removePickerSubscriptions: temporäre Subscriptions
 *    für den Button-Picker-Dialog (ohne Auswirkung auf echte Panel-Subscriptions)
 *  - SUB-STATE-Events → StateStore → Delta-Broadcast an Frontend-Clients
 *  - Status-Events → Broadcast an Frontend-Clients
 *  - Press-Anfragen vom Frontend an den richtigen SatelliteClient weiterleiten
 *  - Graceful Shutdown: REMOVE-SUB für alle Subscriptions
 */
import { WebSocket } from 'ws'
import { Settings, AnyElement } from '@cwp/shared'
import { SatelliteClient, ClientStatus } from './satellite/SatelliteClient'
import { StateStore } from './state/StateStore'
import { ClientServer } from './server/ClientServer'

/**
 * Verwaltet alle SatelliteClients (eine pro Host aus den Settings).
 * Synchronisiert Subscriptions automatisch mit den Panel-Elementen.
 */
export class HostManager {
  private clients = new Map<string, SatelliteClient>()
  private store: StateStore
  private clientServer: ClientServer

  // Echte Subscriptions (von Panel-Elementen): hostId → Set<"page/row/col">
  private realSubKeys = new Map<string, Set<string>>()

  // Picker-Subscriptions (temporär für den Picker-Dialog): hostId → Set<"page/row/col">
  private pickerSubKeys = new Map<string, Set<string>>()

  constructor(store: StateStore, clientServer: ClientServer) {
    this.store = store
    this.clientServer = clientServer

    // Snapshot an jeden neuen Frontend-Client senden
    clientServer.onNewClient((ws) => this.sendAllSnapshotsToClient(ws))
  }

  /**
   * Startet HostManager: SatelliteClients für alle Hosts anlegen und
   * Subscriptions für alle companionButton-Elemente aufbauen.
   */
  start(settings: Settings): void {
    this.syncSubscriptions(settings)
  }

  /**
   * Synchronisiert Subscriptions nach Settings-Änderung (z.B. nach Ctrl+S).
   * Neue Hosts/Buttons werden subscribed, entfernte werden unsubscribed.
   */
  syncSubscriptions(settings: Settings): void {
    // Desired: hostId → Set<"page/row/col"> aus allen companionButton-Elementen
    const desired = this.buildDesiredSubs(settings)

    // Für jeden Host in den Settings: Client sicherstellen + Subscriptions diffsen
    for (const host of settings.hosts) {
      const { id: hostId, host: hostAddr, satellite } = host

      // SatelliteClient anlegen falls noch nicht vorhanden
      if (!this.clients.has(hostId)) {
        this.createClient(hostId, hostAddr, satellite.wsPort)
      }

      const client = this.clients.get(hostId)!
      const currentReal = this.realSubKeys.get(hostId) ?? new Set<string>()
      const desiredForHost = desired.get(hostId) ?? new Set<string>()

      // Neue Subscriptions hinzufügen
      for (const prc of desiredForHost) {
        if (!currentReal.has(prc)) {
          const [p, r, c] = prc.split('/').map(Number)
          client.subscribe(`cwp/${prc}`, p, r, c)
        }
      }

      // Entfernte Subscriptions abmelden
      for (const prc of currentReal) {
        if (!desiredForHost.has(prc)) {
          client.unsubscribe(`cwp/${prc}`)
        }
      }

      this.realSubKeys.set(hostId, desiredForHost)
    }
  }

  /**
   * Startet temporäre Subscriptions für den Button-Picker-Dialog.
   * Abonniert alle Buttons einer Page (keysPerRow × rows).
   * Prefix: "picker/<page>/<row>/<col>"
   */
  addPickerSubscriptions(hostId: string, page: number, keysPerRow: number, rows: number): void {
    const client = this.clients.get(hostId)
    if (!client) return

    const pickerSet = this.pickerSubKeys.get(hostId) ?? new Set<string>()

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < keysPerRow; col++) {
        const prc = `${page}/${row}/${col}`
        if (!pickerSet.has(prc)) {
          client.subscribe(`picker/${prc}`, page, row, col)
          pickerSet.add(prc)
        }
      }
    }

    this.pickerSubKeys.set(hostId, pickerSet)
  }

  /**
   * Entfernt alle Picker-Subscriptions für eine bestimmte Page.
   * Wird aufgerufen wenn der Picker-Dialog geschlossen wird.
   */
  removePickerSubscriptions(hostId: string, page: number): void {
    const client = this.clients.get(hostId)
    if (!client) return

    const pickerSet = this.pickerSubKeys.get(hostId)
    if (!pickerSet) return

    const pagePrefix = `${page}/`
    for (const prc of [...pickerSet]) {
      if (prc.startsWith(pagePrefix)) {
        client.unsubscribe(`picker/${prc}`)
        pickerSet.delete(prc)
      }
    }
  }

  /**
   * Leitet einen Button-Press/Release ans richtige SatelliteClient weiter.
   */
  handlePress(hostId: string, page: number, row: number, col: number, pressed: boolean): void {
    const client = this.clients.get(hostId)
    if (!client) {
      console.warn(`[HostManager] Kein Client für Host "${hostId}"`)
      return
    }
    client.press(page, row, col, pressed)
  }

  /**
   * Graceful Shutdown: alle Subscriptions entfernen und Verbindungen schließen.
   */
  async stop(): Promise<void> {
    await Promise.all([...this.clients.values()].map((c) => c.stop()))
    this.clients.clear()
    this.realSubKeys.clear()
    this.pickerSubKeys.clear()
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private createClient(hostId: string, host: string, port: number): void {
    const client = new SatelliteClient(hostId, host, port)

    client.on('subState', (subId: string, page: number, row: number, col: number, state) => {
      // Sowohl cwp/* als auch picker/* landen im selben StateStore (gleicher Row/Col-Key)
      const delta = this.store.update(hostId, page, row, col, state)
      if (delta) this.clientServer.broadcast(delta)
    })

    client.on('status', (status: ClientStatus) => {
      this.clientServer.broadcast({ t: 'sessionStatus', hostId, status })

      // Bei Verbindungsabbruch: Frontend informieren, StateStore leer lassen
      // (stale-Status reicht als visueller Hinweis, Daten bleiben im Store)
    })

    this.clients.set(hostId, client)
    client.start()
  }

  /**
   * Liest alle companionButton-Refs aus allen Panels und gruppiert sie nach hostId.
   * Ergebnis: hostId → Set<"page/row/col">
   */
  private buildDesiredSubs(settings: Settings): Map<string, Set<string>> {
    const desired = new Map<string, Set<string>>()

    for (const panel of settings.panels) {
      for (const el of panel.elements) {
        if (!isCompanionButton(el)) continue
        const { hostId, page, row, col } = el.ref
        if (!desired.has(hostId)) desired.set(hostId, new Set())
        desired.get(hostId)!.add(`${page}/${row}/${col}`)
      }
    }

    return desired
  }

  /** Sendet Snapshots aller aktiven Sessions an einen einzelnen neuen Client */
  private sendAllSnapshotsToClient(ws: WebSocket): void {
    // Für alle bekannten Hosts: alle (hostId, page) Kombinationen aus dem Store
    for (const [hostId, client] of this.clients) {
      // Bekannte Pages aus realSubKeys + pickerSubKeys sammeln
      const pages = new Set<number>()
      const allKeys = [
        ...(this.realSubKeys.get(hostId) ?? []),
        ...(this.pickerSubKeys.get(hostId) ?? []),
      ]
      for (const prc of allKeys) {
        const page = parseInt(prc.split('/')[0], 10)
        if (!isNaN(page)) pages.add(page)
      }

      for (const page of pages) {
        const keys = this.store.getAll(hostId, page)
        this.clientServer.sendSnapshotToClient(ws, { t: 'snapshot', hostId, page, keys })
      }

      // Aktuellen Host-Status senden
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(JSON.stringify({
          t: 'sessionStatus',
          hostId,
          status: client.getStatus(),
        }))
      }
    }
  }
}

function isCompanionButton(el: AnyElement): el is import('@cwp/shared').CompanionButtonElement {
  return el.type === 'companionButton'
}

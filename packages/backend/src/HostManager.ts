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
import { Settings, AnyElement, VDeltaBatchMessage, VSessionStatusMessage, VSnapshotMessage } from '@cwp/shared'
import { SatelliteClient, ClientStatus } from './satellite/SatelliteClient'
import { StateStore } from './state/StateStore'
import { ClientServer } from './server/ClientServer'
import { VirtualSurfaceManager } from './VirtualSurfaceManager'

/**
 * Verwaltet alle SatelliteClients (eine pro Host aus den Settings).
 * Synchronisiert Subscriptions automatisch mit den Panel-Elementen.
 */
export class HostManager {
  private clients = new Map<string, SatelliteClient>()
  private store: StateStore
  private clientServer: ClientServer
  private onStatusChange?: (hostId: string, status: ClientStatus) => void
  private virtualSurfaceManager: VirtualSurfaceManager

  // Echte Subscriptions (von Panel-Elementen): hostId → Map<"page/row/col" → bitmapSize>
  private realSubSizes = new Map<string, Map<string, number>>()

  // Picker-Subscriptions (temporär für den Picker-Dialog): hostId → Set<"page/row/col">
  private pickerSubKeys = new Map<string, Set<string>>()

  constructor(
    store: StateStore,
    clientServer: ClientServer,
    onStatusChange?: (hostId: string, status: ClientStatus) => void,
  ) {
    this.store = store
    this.clientServer = clientServer
    this.onStatusChange = onStatusChange

    this.virtualSurfaceManager = new VirtualSurfaceManager(
      store,
      (msg: VDeltaBatchMessage | VSessionStatusMessage) => clientServer.broadcast(msg),
    )

    // Snapshot an jeden neuen Frontend-Client senden
    clientServer.onNewClient((ws) => {
      this.sendAllSnapshotsToClient(ws)
      // vSnapshot für alle aktiven Virtual Decks senden
      for (const { deviceId, keys } of this.virtualSurfaceManager.getAllSnapshots()) {
        const snap: VSnapshotMessage = { t: 'vSnapshot', deviceId, keys }
        clientServer.sendVSnapshotToClient(ws, snap)
      }
      // vSessionStatus für alle aktiven Virtual Decks senden
      for (const { deviceId, status } of this.virtualSurfaceManager.getAllStatuses()) {
        clientServer.sendToClient(ws, { t: 'vSessionStatus', deviceId, status } as VSessionStatusMessage)
      }
    })
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
    // Desired: hostId → Map<"page/row/col", bitmapSize> aus allen companionButton-Elementen
    const desired = this.buildDesiredSubs(settings)

    // Hosts mit autoConnect=false: laufenden Client stoppen falls vorhanden
    for (const host of settings.hosts) {
      if (host.autoConnect === false && this.clients.has(host.id)) {
        const client = this.clients.get(host.id)!
        client.stop().catch(() => {})
        this.clients.delete(host.id)
        this.realSubSizes.delete(host.id)
        this.clientServer.broadcast({ t: 'sessionStatus', hostId: host.id, status: 'stale' })
      }
    }

    // Für jeden Host in den Settings: Client sicherstellen + Subscriptions diffsen
    for (const host of settings.hosts) {
      const { id: hostId, host: hostAddr, satellite } = host

      // autoConnect=false → kein Client starten
      if (host.autoConnect === false) continue

      // SatelliteClient anlegen falls noch nicht vorhanden
      if (!this.clients.has(hostId)) {
        this.createClient(hostId, hostAddr, satellite.wsPort)
      }

      const client = this.clients.get(hostId)!
      const currentSizes = this.realSubSizes.get(hostId) ?? new Map<string, number>()
      const desiredSizes = desired.get(hostId) ?? new Map<string, number>()

      // Neue und geänderte Subscriptions hinzufügen (Größenänderung → Re-Subscribe)
      for (const [prc, bitmapSize] of desiredSizes) {
        const currentSize = currentSizes.get(prc)
        if (currentSize === undefined) {
          // Neu: direkt subscriben
          const [p, r, c] = prc.split('/').map(Number)
          client.subscribe(`cwp/${prc}`, p, r, c, bitmapSize)
        } else if (currentSize !== bitmapSize) {
          // Gleicher Button, andere Größe → REMOVE-SUB + ADD-SUB
          client.unsubscribe(`cwp/${prc}`)
          const [p, r, c] = prc.split('/').map(Number)
          client.subscribe(`cwp/${prc}`, p, r, c, bitmapSize)
        }
        // gleiche Größe: nichts tun
      }

      // Entfernte Subscriptions abmelden
      for (const prc of currentSizes.keys()) {
        if (!desiredSizes.has(prc)) {
          client.unsubscribe(`cwp/${prc}`)
        }
      }

      this.realSubSizes.set(hostId, desiredSizes)
    }

    this.virtualSurfaceManager.sync(settings)
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
   * Leitet einen Virtual-Deck-Key-Press vom Frontend an den VirtualSurfaceManager weiter.
   */
  handleVPress(deviceId: string, keyIndex: number, pressed: boolean): void {
    this.virtualSurfaceManager.handleVPress(deviceId, keyIndex, pressed)
  }

  /**
   * Leitet einen Fader-Rotate ans richtige SatelliteClient weiter.
   */
  handleRotate(hostId: string, page: number, row: number, col: number, direction: 1 | -1): void {
    const client = this.clients.get(hostId)
    if (!client) {
      console.warn(`[HostManager] Kein Client für Host "${hostId}" (rotate)`)
      return
    }
    client.rotate(page, row, col, direction)
  }

  /**
   * Graceful Shutdown: alle Subscriptions entfernen und Verbindungen schließen.
   */
  async stop(): Promise<void> {
    await Promise.all([...this.clients.values()].map((c) => c.stop()))
    await this.virtualSurfaceManager.stop()
    this.clients.clear()
    this.realSubSizes.clear()
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

    client.on('begin', (companionVersion: string, apiVersion: string) => {
      this.clientServer.broadcast({ t: 'hostInfo', hostId, companionVersion, apiVersion })
    })

    client.on('status', (status: ClientStatus) => {
      this.clientServer.broadcast({ t: 'sessionStatus', hostId, status })
      this.onStatusChange?.(hostId, status)
    })

    this.clients.set(hostId, client)
    client.start()
  }

  /**
   * Liest alle companionButton-Refs aus allen Panels und gruppiert sie nach hostId.
   * Ergebnis: hostId → Map<"page/row/col", bitmapSize>
   * Bei mehreren Elementen auf gleichem Button: MAX-Auflösung gewinnt.
   */
  private buildDesiredSubs(settings: Settings): Map<string, Map<string, number>> {
    const desired = new Map<string, Map<string, number>>()

    const addRef = (ref: import('@cwp/shared').CompanionRef | undefined, bitmapSize = 72) => {
      if (!ref) return
      const { hostId, page, row, col } = ref
      if (!desired.has(hostId)) desired.set(hostId, new Map())
      const key = `${page}/${row}/${col}`
      const existing = desired.get(hostId)!.get(key) ?? 0
      // MAX: wenn mehrere Elemente denselben Button referenzieren, höchste Auflösung nehmen
      desired.get(hostId)!.set(key, Math.max(existing, bitmapSize))
    }

    for (const panel of settings.panels) {
      for (const el of panel.elements) {
        if (el.type === 'companionButton') {
          addRef(el.ref, el.render?.bitmapSize ?? 72)
        } else if (el.type === 'channelStrip') {
          addRef(el.refs.button.ref, 72)
          addRef(el.refs.solo, 72)
          addRef(el.refs.pan, 72)
        }
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
        ...(this.realSubSizes.get(hostId)?.keys() ?? []),
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
        ws.send(JSON.stringify({ t: 'sessionStatus', hostId, status: client.getStatus() }))
        // Version-Info senden falls bereits bekannt (nach erstem BEGIN)
        const { companionVersion, apiVersion } = client.getVersionInfo()
        if (companionVersion) {
          ws.send(JSON.stringify({ t: 'hostInfo', hostId, companionVersion, apiVersion }))
        }
      }
    }
  }
}

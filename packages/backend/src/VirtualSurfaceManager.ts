/**
 * VirtualSurfaceManager.ts
 *
 * Verwaltet alle VirtualSurfaceSession-Instanzen (eine pro virtualCompanionDeck-Element).
 *
 * Aufgaben:
 *  - sync(settings): Diff gegen aktive Sessions — neue starten, entfernte stoppen
 *  - KEY-STATE-Events weiterleiten → StateStore → vDelta an Frontend broadcasen
 *  - Status-Events → vSessionStatus an Frontend broadcasen
 *  - getSnapshot(deviceId): vSnapshot-Daten aus StateStore lesen (für neue WS-Clients)
 */
import { Settings, VirtualCompanionDeckElement, VDeltaMessage, VDeltaBatchMessage, VSessionStatusMessage } from '@cwp/shared'
import { VirtualSurfaceSession } from './satellite/VirtualSurfaceSession'
import type { VirtualSurfaceStatus } from './satellite/VirtualSurfaceSession'
import { StateStore } from './state/StateStore'

type BroadcastFn = (msg: VDeltaBatchMessage | VSessionStatusMessage) => void

/**
 * Orchestriert VirtualSurfaceSession-Instanzen.
 * Eine Session pro virtualCompanionDeck-Element (identifiziert über deviceId).
 */
/** Batch-Fenster in ms: alle vDelta-Events in diesem Zeitraum werden gebündelt gesendet */
const BATCH_WINDOW_MS = 30

export class VirtualSurfaceManager {
  private sessions = new Map<string, VirtualSurfaceSession>()
  /** Speichert Grid-Parameter + Host pro Session für Änderungs-Erkennung */
  private sessionGrids = new Map<string, { cols: number; rows: number; hostId: string }>()
  private store: StateStore
  private broadcast: BroadcastFn

  /** Puffer für noch nicht gesendete vDelta-Nachrichten */
  private deltaBuffer: VDeltaMessage[] = []
  /** Timer-Handle für den laufenden Batch-Flush */
  private batchTimer: NodeJS.Timeout | null = null

  constructor(store: StateStore, broadcast: BroadcastFn) {
    this.store = store
    this.broadcast = broadcast
  }

  /**
   * Synchronisiert Sessions mit dem aktuellen Settings-Stand.
   * Neue virtualCompanionDeck-Elemente bekommen eine Session, entfernte werden gestoppt.
   * Wird nach jedem Settings-Save und beim Start aufgerufen.
   */
  sync(settings: Settings): void {
    // Alle virtualCompanionDeck-Elemente aus allen Panels sammeln
    const desired = new Map<string, VirtualCompanionDeckElement>()
    for (const panel of settings.panels) {
      for (const el of panel.elements) {
        if (el.type === 'virtualCompanionDeck') {
          desired.set(el.deviceId, el)
        }
      }
    }

    // Entfernte Sessions stoppen
    for (const [deviceId, session] of this.sessions) {
      if (!desired.has(deviceId)) {
        session.stop().catch(() => {})
        this.store.clearVirtualKeys(deviceId)
        this.sessions.delete(deviceId)
        this.sessionGrids.delete(deviceId)
      }
    }

    // Neue Sessions starten — oder bestehende neu starten wenn Grid/Host geändert wurde
    for (const [deviceId, el] of desired) {
      if (this.sessions.has(deviceId)) {
        // Prüfen ob Grid oder Host geändert — dann Session neu starten
        const oldGrid = this.sessionGrids.get(deviceId)
        const gridChanged = !oldGrid
          || oldGrid.cols !== el.grid.cols
          || oldGrid.rows !== el.grid.rows
          || oldGrid.hostId !== el.hostId
        if (gridChanged) {
          this.sessions.get(deviceId)!.stop().catch(() => {})
          this.store.clearVirtualKeys(deviceId)
          this.sessions.delete(deviceId)
          this.sessionGrids.delete(deviceId)
          this.createSession(el, settings)
        }
      } else {
        this.createSession(el, settings)
      }
    }
  }

  /**
   * Liefert Snapshot-Daten für einen neuen Frontend-Client.
   * Gibt alle aktiven deviceIds + deren Key-States zurück.
   */
  getAllSnapshots(): Array<{ deviceId: string; keys: Record<string, import('@cwp/shared').KeyState> }> {
    const result = []
    for (const deviceId of this.sessions.keys()) {
      result.push({ deviceId, keys: this.store.getVirtualSnapshot(deviceId) })
    }
    return result
  }

  /**
   * Leitet KEY-PRESS vom Frontend an die richtige Session weiter.
   */
  handleVPress(deviceId: string, keyIndex: number, pressed: boolean): void {
    const session = this.sessions.get(deviceId)
    if (!session) {
      console.warn(`[VirtualSurfaceManager] Kein Session für deviceId "${deviceId}"`)
      return
    }
    session.sendKeyPress(keyIndex, pressed)
  }

  /**
   * Liefert aktuellen Status aller Sessions (für neue Frontend-Clients).
   */
  getAllStatuses(): Array<{ deviceId: string; status: VirtualSurfaceStatus }> {
    return [...this.sessions.entries()].map(([deviceId, session]) => ({
      deviceId,
      status: session.getStatus(),
    }))
  }

  /**
   * Stoppt alle Sessions (Graceful Shutdown).
   */
  async stop(): Promise<void> {
    // Laufenden Batch-Timer abbrechen — kein Flush nötig, Frontend trennt sich sowieso
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    this.deltaBuffer = []
    await Promise.all([...this.sessions.values()].map(s => s.stop()))
    this.sessions.clear()
    this.sessionGrids.clear()
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  /**
   * Sendet alle gepufferten Deltas als ein vDeltaBatch an das Frontend.
   * Wird nach BATCH_WINDOW_MS ausgelöst.
   */
  private flushBatch(): void {
    this.batchTimer = null
    if (this.deltaBuffer.length === 0) return
    const deltas = this.deltaBuffer
    this.deltaBuffer = []
    this.broadcast({ t: 'vDeltaBatch', deltas })
  }

  private createSession(el: VirtualCompanionDeckElement, settings: Settings): void {
    const host = settings.hosts.find(h => h.id === el.hostId)
    if (!host) {
      console.warn(`[VirtualSurfaceManager] Host "${el.hostId}" nicht in Settings — Session nicht gestartet`)
      return
    }

    const session = new VirtualSurfaceSession(
      el.deviceId,
      el.surfaceName,
      el.grid.cols,
      el.grid.rows,
      host.host,
      host.satellite.wsPort,
    )

    session.on('keyState', (keyIndex: number, state: Partial<import('@cwp/shared').KeyState>) => {
      const delta = this.store.setVirtualKey(el.deviceId, keyIndex, state)
      if (delta) {
        // Delta in Puffer legen — nach BATCH_WINDOW_MS gebündelt senden
        this.deltaBuffer.push({ t: 'vDelta', deviceId: el.deviceId, keyIndex, ...delta })
        if (!this.batchTimer) {
          this.batchTimer = setTimeout(() => this.flushBatch(), BATCH_WINDOW_MS)
        }
      }
    })

    session.on('status', (status: VirtualSurfaceStatus) => {
      this.broadcast({ t: 'vSessionStatus', deviceId: el.deviceId, status })
    })

    this.sessions.set(el.deviceId, session)
    // Grid-Parameter für spätere Änderungs-Erkennung merken
    this.sessionGrids.set(el.deviceId, { cols: el.grid.cols, rows: el.grid.rows, hostId: el.hostId })
    session.start()
  }
}

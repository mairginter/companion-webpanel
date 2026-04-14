/**
 * StateStore.ts
 *
 * In-Memory-Cache für alle aktuellen Button-Zustände aller aktiven
 * Satellite-Subscriptions.
 *
 * Aufgaben:
 *  - Aktuellen Zustand jedes Buttons (bgColor, textColor, text, bitmap) halten
 *  - Delta-Vergleich: eingehende SUB-STATE-Updates mit gecachtem Wert vergleichen
 *    und nur tatsächlich geänderte Felder als DeltaMessage zurückgeben
 *  - Snapshot-Abfrage: kompletten Zustand einer (hostId, page) Session liefern
 *  - Session-Clear: alle Buttons eines Hosts löschen (bei Disconnect)
 *
 * Key-Format: "hostId:page:row:col" — direkt aus CompanionRef abgeleitet,
 * kein keysPerRow-Mapping mehr nötig (Subscription API liefert row/col direkt).
 */
import { KeyState, DeltaMessage, pageKey } from '@cwp/shared'

/**
 * In-Memory State Store für alle Button-Zustände aller Satellite-Subscriptions.
 * Führt Delta-Vergleich durch: nur tatsächlich geänderte Felder werden zurückgegeben.
 */
export class StateStore {
  // key: "hostId:page:row:col"
  private store = new Map<string, KeyState>()

  private stateKey(hostId: string, page: number, row: number, col: number): string {
    return `${pageKey(hostId, page)}:${row}:${col}`
  }

  /**
   * Aktualisiert den State für einen Button (row/col statt keyIndex).
   * Gibt ein DeltaMessage zurück wenn sich etwas geändert hat, sonst null.
   */
  update(
    hostId: string,
    page: number,
    row: number,
    col: number,
    incoming: Partial<KeyState>,
  ): DeltaMessage | null {
    const k = this.stateKey(hostId, page, row, col)
    const current = this.store.get(k) ?? {}

    const changed: Partial<KeyState> = {}
    let hasChange = false

    for (const field of ['bgColor', 'textColor', 'text', 'bitmap'] as const) {
      const newVal = incoming[field]
      if (newVal !== undefined && newVal !== current[field]) {
        changed[field] = newVal
        hasChange = true
      }
    }

    if (!hasChange) return null

    this.store.set(k, { ...current, ...changed })

    return {
      t: 'delta',
      hostId,
      page,
      row,
      col,
      ...changed,
    }
  }

  /**
   * Gibt alle Keys einer (hostId, page) Session zurück.
   * Key-Format im Result: "row:col" → KeyState
   * Wird beim ersten Connect eines Frontend-Clients als Snapshot gesendet.
   */
  getAll(hostId: string, page: number): Record<string, KeyState> {
    const prefix = `${pageKey(hostId, page)}:`
    const result: Record<string, KeyState> = {}
    for (const [k, state] of this.store) {
      if (k.startsWith(prefix)) {
        // k = "hostId:page:row:col" → slice prefix → "row:col"
        const rowCol = k.slice(prefix.length)
        result[rowCol] = state
      }
    }
    return result
  }

  /**
   * Entfernt alle Keys eines Hosts (z.B. bei Disconnect).
   */
  clearHost(hostId: string): void {
    const prefix = `${hostId}:`
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k)
    }
  }

  // ─── Virtual Keys (virtualCompanionDeck-Elemente) ─────────────────────────
  // key: "deviceId:keyIndex"
  private virtualStore = new Map<string, KeyState>()

  /**
   * Aktualisiert den State für einen Virtual-Key.
   * Gibt nur geänderte Felder zurück (Delta), oder null wenn kein Unterschied.
   */
  setVirtualKey(deviceId: string, keyIndex: number, incoming: Partial<KeyState>): Partial<KeyState> | null {
    const k = `${deviceId}:${keyIndex}`
    const current = this.virtualStore.get(k) ?? {}
    const changed: Partial<KeyState> = {}
    let hasChange = false
    for (const field of ['bgColor', 'textColor', 'text', 'bitmap'] as const) {
      const newVal = incoming[field]
      if (newVal !== undefined && newVal !== current[field]) {
        changed[field] = newVal
        hasChange = true
      }
    }
    if (!hasChange) return null
    this.virtualStore.set(k, { ...current, ...changed })
    return changed
  }

  /**
   * Gibt alle Virtual-Keys eines Devices zurück (keyIndex als String-Key → KeyState).
   * Wird beim Connect eines neuen Frontend-Clients als vSnapshot gesendet.
   */
  getVirtualSnapshot(deviceId: string): Record<string, KeyState> {
    const prefix = `${deviceId}:`
    const result: Record<string, KeyState> = {}
    for (const [k, state] of this.virtualStore) {
      if (k.startsWith(prefix)) {
        const keyIndex = k.slice(prefix.length)
        result[keyIndex] = state
      }
    }
    return result
  }

  /**
   * Löscht alle Virtual-Keys eines Devices (bei Session-Stop oder Element-Löschen).
   */
  clearVirtualKeys(deviceId: string): void {
    const prefix = `${deviceId}:`
    for (const k of this.virtualStore.keys()) {
      if (k.startsWith(prefix)) this.virtualStore.delete(k)
    }
  }
}

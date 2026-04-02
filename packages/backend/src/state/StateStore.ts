/**
 * StateStore.ts
 *
 * In-Memory-Cache für alle aktuellen Button-Zustände (KEY-STATEs) aller
 * aktiven Satellite-Sessions.
 *
 * Aufgaben:
 *  - Aktuellen Zustand jedes Buttons (bgColor, textColor, text, bitmap) halten
 *  - Delta-Vergleich: eingehende KEY-STATE-Updates mit gecachtem Wert vergleichen
 *    und nur tatsächlich geänderte Felder als DeltaMessage zurückgeben —
 *    verhindert unnötige WS-Nachrichten ans Frontend
 *  - Snapshot-Abfrage: kompletten Zustand einer Session liefern (bei neuem Client-Connect)
 *  - Session-Clear: alle Buttons einer Session löschen (bei Disconnect/KEYS-CLEAR)
 */
import { KeyState, DeltaMessage, pageKey } from '@cwp/shared'

/**
 * In-Memory State Store für alle KEY-STATEs aller Satellite-Sessions.
 * Führt Delta-Vergleich durch: nur tatsächlich geänderte Felder werden zurückgegeben.
 */
export class StateStore {
  // key: "hostId:page:keyIndex"
  private store = new Map<string, KeyState>()

  private stateKey(hostId: string, page: number, keyIndex: number): string {
    return `${pageKey(hostId, page)}:${keyIndex}`
  }

  /**
   * Aktualisiert den State für einen Key.
   * Gibt ein DeltaMessage zurück wenn sich etwas geändert hat, sonst null.
   */
  update(
    hostId: string,
    page: number,
    keyIndex: number,
    incoming: Partial<KeyState>,
  ): DeltaMessage | null {
    const k = this.stateKey(hostId, page, keyIndex)
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
      key: keyIndex,
      ...changed,
    }
  }

  /**
   * Gibt alle Keys einer (hostId, page) Session zurück.
   * Wird beim ersten Connect eines Frontend-Clients als Snapshot gesendet.
   */
  getAll(hostId: string, page: number): Record<number, KeyState> {
    const prefix = `${pageKey(hostId, page)}:`
    const result: Record<number, KeyState> = {}
    for (const [k, state] of this.store) {
      if (k.startsWith(prefix)) {
        const keyIndex = parseInt(k.slice(prefix.length), 10)
        if (!isNaN(keyIndex)) {
          result[keyIndex] = state
        }
      }
    }
    return result
  }

  /**
   * Entfernt alle Keys einer Session (z.B. bei Disconnect).
   */
  clearSession(hostId: string, page: number): void {
    const prefix = `${pageKey(hostId, page)}:`
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k)
    }
  }
}

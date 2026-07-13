/**
 * pageNames.ts
 *
 * Seitennamen-Proxy: liest Page-Namen aus der allgemeinen Companion-HTTP-API
 * (Admin-Port, Default 8000) — die Satellite API bietet dafür keine Message.
 *
 *   GET http://<host>:<httpPort>/api/variable/internal/page_number_<N>_name/value
 *
 * Der Proxy läuft im Backend (vermeidet CORS, Frontend bleibt stateless).
 * Kleiner In-Memory-Cache mit TTL, damit das Picker-Dropdown beim Durchblättern
 * nicht pro Klick einen HTTP-Roundtrip zum Companion-Host auslöst.
 *
 * Fehlerverhalten: 403 (http_api_enabled aus), 404, Timeout, Conn-Fehler →
 * leerer Name (graceful degradation, Picker zeigt dann nur die Seitennummer).
 * Auch leere Ergebnisse werden gecached — sonst hämmert jeder Dropdown-Klick
 * gegen einen nicht erreichbaren Host in den Timeout.
 */

export const PAGE_NAME_TTL_MS = 30_000
export const PAGE_NAME_TIMEOUT_MS = 1500

interface CacheEntry {
  name: string
  expires: number
}

/** Löst Seitennamen über die Companion-HTTP-API auf, mit TTL-Cache. */
export class PageNameResolver {
  private cache = new Map<string, CacheEntry>()

  // fetchImpl/now injizierbar für Tests (echtes fetch bzw. Date.now im Betrieb)
  constructor(
    private fetchImpl: typeof fetch = fetch,
    private now: () => number = Date.now,
  ) {}

  async resolve(hostAddr: string, httpPort: number, page: number): Promise<string> {
    const key = `${hostAddr}:${httpPort}:${page}`
    const hit = this.cache.get(key)
    if (hit && hit.expires > this.now()) return hit.name

    let name = ''
    try {
      const res = await this.fetchImpl(
        `http://${hostAddr}:${httpPort}/api/variable/internal/page_number_${page}_name/value`,
        { signal: AbortSignal.timeout(PAGE_NAME_TIMEOUT_MS) },
      )
      if (res.status === 200) name = (await res.text()).trim()
      // ≠200 (403/404/…) → leer lassen
    } catch {
      // Timeout / Host nicht erreichbar (Firewall am Companion-Host?) → leer
    }

    this.cache.set(key, { name, expires: this.now() + PAGE_NAME_TTL_MS })
    return name
  }
}

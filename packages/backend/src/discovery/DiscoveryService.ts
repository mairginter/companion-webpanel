/**
 * DiscoveryService.ts
 *
 * mDNS-Auto-Discovery für Companion-Instanzen im lokalen Netz.
 * Companion 5.0+ announced sich via Bonjour als `_companion-satellite-ws._tcp`
 * (Port 16623) mit TXT-Record `protocolVersion` = Satellite-API-Version.
 *
 * Lifecycle: Browse-on-demand — wird nur gestartet solange das HostManagerModal
 * offen ist (POST /api/discovery/start|stop). Das vermeidet Dauer-Multicast und
 * verschiebt den Windows-Firewall-Prompt (UDP 5353) auf den Moment aktiver Nutzung.
 * Ein Watchdog stoppt den Browse automatisch nach 5 Minuten, falls das Frontend
 * das Stop-Signal nie sendet (Tab geschlossen, Browser-Crash).
 *
 * Events:
 *  'update' (hosts: DiscoveredHost[]) — bei jeder Änderung der Host-Liste
 */
import { EventEmitter } from 'events'
import { Bonjour, Browser, DiscoveredService } from '@julusian/bonjour-service'
import { DiscoveredHost } from '@cwp/shared'

// Companion announced diesen Service-Typ (ohne führenden Unterstrich in bonjour-service)
const SERVICE_TYPE = 'companion-satellite-ws'

// mDNS-Antworten können verloren gehen — periodischer Re-Query hält die Liste frisch
const UPDATE_INTERVAL_MS = 10_000

// Auto-Stop falls das Frontend nie /api/discovery/stop sendet
const WATCHDOG_MS = 5 * 60_000

/** Wählt die erste brauchbare IPv4 (kein IPv6, kein link-local 169.254.x.x). */
function pickIPv4(addresses: string[] | undefined): string | null {
  for (const addr of addresses ?? []) {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(addr) && !addr.startsWith('169.254.')) return addr
  }
  return null
}

/**
 * Browst das LAN nach Companion-Instanzen. 1 Instanz pro Backend,
 * start()/stop() beliebig oft aufrufbar (idempotent).
 */
export class DiscoveryService extends EventEmitter {
  private bonjour: Bonjour | null = null
  private browser: Browser | null = null
  private updateTimer: NodeJS.Timeout | null = null
  private watchdogTimer: NodeJS.Timeout | null = null

  // Dedupe per fqdn — mDNS kann denselben Service mehrfach melden
  private hosts = new Map<string, DiscoveredHost>()

  start(): void {
    if (this.browser) {
      // Bereits aktiv — nur den Watchdog neu aufziehen (Modal wurde erneut geöffnet)
      this.armWatchdog()
      return
    }

    // errorCallback verhindert einen Crash wenn z.B. UDP 5353 blockiert ist
    this.bonjour = new Bonjour(undefined, (err: Error) => {
      console.error(`[Discovery] mDNS-Fehler: ${err.message}`)
    })
    this.browser = this.bonjour.find({ type: SERVICE_TYPE })

    this.browser.on('up', (svc: DiscoveredService) => this.handleUp(svc))
    this.browser.on('down', (svc: DiscoveredService) => this.handleDown(svc))

    this.updateTimer = setInterval(() => this.browser?.update(), UPDATE_INTERVAL_MS)
    this.armWatchdog()
    console.log('[Discovery] mDNS-Browse gestartet')
  }

  stop(): void {
    if (!this.bonjour && !this.browser) return
    if (this.updateTimer) { clearInterval(this.updateTimer); this.updateTimer = null }
    if (this.watchdogTimer) { clearTimeout(this.watchdogTimer); this.watchdogTimer = null }
    try { this.browser?.stop() } catch { /* Socket evtl. schon zu */ }
    try { this.bonjour?.destroy() } catch { /* dito */ }
    this.browser = null
    this.bonjour = null
    this.hosts.clear()
    this.emit('update', this.getHosts())
    console.log('[Discovery] mDNS-Browse gestoppt')
  }

  getHosts(): DiscoveredHost[] {
    return Array.from(this.hosts.values())
  }

  // ─── Intern ────────────────────────────────────────────────────────────────

  private handleUp(svc: DiscoveredService): void {
    const address = pickIPv4(svc.addresses)
    if (!address) return // ohne erreichbare IPv4 nicht anbieten

    // TXT-Key-Casing tolerant lesen (Companion sendet `protocolVersion`)
    const txt = svc.txt ?? {}
    const apiVersion = txt['protocolVersion'] ?? txt['protocolversion']

    this.hosts.set(svc.fqdn, {
      id: svc.fqdn,
      name: svc.name,
      address,
      port: svc.port,
      ...(apiVersion !== undefined ? { apiVersion } : {}),
    })
    this.emit('update', this.getHosts())
  }

  private handleDown(svc: DiscoveredService): void {
    if (this.hosts.delete(svc.fqdn)) {
      this.emit('update', this.getHosts())
    }
  }

  private armWatchdog(): void {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer)
    this.watchdogTimer = setTimeout(() => {
      console.warn('[Discovery] Watchdog: kein Stop empfangen — beende mDNS-Browse')
      this.stop()
    }, WATCHDOG_MS)
  }
}

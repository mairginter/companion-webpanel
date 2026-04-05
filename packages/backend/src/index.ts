/**
 * index.ts — Backend Entry Point
 *
 * Startet das Companion Webpanel Backend:
 *  1. Settings laden aus CompanionWebpannelSettings.json (oder SETTINGS_PATH env)
 *  2. StateStore, ClientServer und HostManager initialisieren
 *  3. Button-Subscriptions aus Panel-Elementen starten (Verbindungen zu Companion)
 *  4. Graceful Shutdown bei SIGINT/SIGTERM:
 *     - REMOVE-SUB an alle Companion-Instanzen senden
 *     - Alle Frontend-Clients trennen
 *     - HTTP-Server schließen, Port freigeben
 *
 * Umgebungsvariablen:
 *  SETTINGS_PATH   Pfad zur Settings-JSON (default: ../../CompanionWebpannelSettings.json)
 *  CLIENT_WS_PORT  Port für Frontend-WS und HTTP-API (default: 8080)
 */
import * as fs from 'fs'
import * as path from 'path'
import { Settings } from '@cwp/shared'
import { StateStore } from './state/StateStore'
import { ClientServer } from './server/ClientServer'
import { HostManager } from './HostManager'

// ─── Config ────────────────────────────────────────────────────────────────

const SETTINGS_PATH =
  process.env.SETTINGS_PATH ??
  path.resolve(process.cwd(), '../../CompanionWebpannelSettings.json')

const CLIENT_WS_PORT = parseInt(process.env.CLIENT_WS_PORT ?? '8080', 10)

// ─── Boot ──────────────────────────────────────────────────────────────────

function loadSettings(): Settings {
  if (!fs.existsSync(SETTINGS_PATH)) {
    console.error(`[Boot] Settings-Datei nicht gefunden: ${SETTINGS_PATH}`)
    console.error('[Boot] Erstelle CompanionWebpannelSettings.json im Projekt-Root.')
    process.exit(1)
  }

  const raw = fs.readFileSync(SETTINGS_PATH, 'utf8')
  const settings = JSON.parse(raw) as Settings

  if (settings.version !== '1.3.0') {
    console.warn(`[Boot] Unbekannte Settings-Version: ${settings.version} (erwartet: 1.3.0)`)
  }

  console.log(`[Boot] Settings geladen: ${settings.hosts.length} Host(s), ${settings.panels.length} Panel(s)`)
  return settings
}

async function main(): Promise<void> {
  const settings = loadSettings()

  const store = new StateStore()

  // HostManager muss vor ClientServer existieren — forward reference via Closure
  let manager: HostManager

  const clientServer = new ClientServer(
    CLIENT_WS_PORT,
    settings,
    SETTINGS_PATH,
    // onPress: Button-Press vom Frontend weiterleiten
    (hostId, page, row, col, pressed) => manager.handlePress(hostId, page, row, col, pressed),
    // onSettingsUpdate: neue Subscriptions nach Ctrl+S synchronisieren
    (updatedSettings) => manager.syncSubscriptions(updatedSettings),
    // onPreviewPageAdd: temporäre Picker-Subscriptions starten
    (hostId, page, keysPerRow, rows) => manager.addPickerSubscriptions(hostId, page, keysPerRow, rows),
    // onPreviewPageRemove: temporäre Picker-Subscriptions beenden
    (hostId, page) => manager.removePickerSubscriptions(hostId, page),
  )

  manager = new HostManager(store, clientServer)
  manager.start(settings)

  // ─── Graceful Shutdown ─────────────────────────────────────────────────

  let shuttingDown = false

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`\n[Boot] ${signal} empfangen — fahre herunter...`)

    try {
      await manager!.stop()
      await clientServer.close()
      console.log('[Boot] Sauber beendet.')
    } catch (err) {
      console.error('[Boot] Fehler beim Herunterfahren:', err)
    }

    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  console.log('[Boot] Companion Webpanel Backend läuft.')
  console.log(`[Boot] Frontend-WS: ws://localhost:${CLIENT_WS_PORT}`)
  console.log('[Boot] Ctrl+C zum Beenden.')
}

main().catch((err) => {
  console.error('[Boot] Unbehandelter Fehler:', err)
  process.exit(1)
})

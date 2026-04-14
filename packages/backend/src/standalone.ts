/**
 * standalone.ts — Standalone Backend Entry Point (npm start / npm run dev)
 *
 * Lädt Settings aus CompanionWebpannelSettings.json und startet das Backend.
 * Nicht für Electron — dort wird createBackend() aus index.ts verwendet.
 *
 * Umgebungsvariablen:
 *  SETTINGS_PATH   Pfad zur Settings-JSON (default: ../../CompanionWebpannelSettings.json)
 *  CLIENT_WS_PORT  Port für Frontend-WS und HTTP-API (default: 8080)
 */
import * as fs from 'fs'
import * as path from 'path'
import { Settings } from '@cwp/shared'
import { createBackend } from './index'

const SETTINGS_PATH =
  process.env.SETTINGS_PATH ??
  path.resolve(process.cwd(), '../../CompanionWebpannelSettings.json')

const CLIENT_WS_PORT = parseInt(process.env.CLIENT_WS_PORT ?? '8080', 10)

function loadSettings(): Settings {
  let raw: string
  try {
    raw = fs.readFileSync(SETTINGS_PATH, 'utf8')
  } catch {
    console.error(`[Boot] Settings-Datei nicht gefunden: ${SETTINGS_PATH}`)
    console.error('[Boot] Erstelle CompanionWebpannelSettings.json im Projekt-Root.')
    process.exit(1)
  }

  const settings = JSON.parse(raw!) as Settings
  const expectedVersion: Settings['version'] = '1.4.0'
  if (settings.version !== expectedVersion) {
    console.warn(`[Boot] Unbekannte Settings-Version: ${settings.version} (erwartet: ${expectedVersion})`)
  }

  console.log(`[Boot] Settings geladen: ${settings.hosts.length} Host(s), ${settings.panels.length} Panel(s)`)
  return settings
}

async function main(): Promise<void> {
  const settings = loadSettings()

  const backend = await createBackend(settings, CLIENT_WS_PORT, SETTINGS_PATH)

  let shuttingDown = false

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`\n[Boot] ${signal} empfangen — fahre herunter...`)

    try {
      await backend.stop()
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

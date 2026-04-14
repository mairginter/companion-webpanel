/**
 * settingsHelper.ts — Settings laden/speichern für Electron
 *
 * Verwaltet CompanionWebpanel-Settings im User-Daten-Verzeichnis.
 * userDataPath wird von außen injiziert (app.getPath('userData')) —
 * dadurch ohne Electron vollständig testbar.
 */
import * as fs from 'fs'
import * as path from 'path'
import type { Settings } from '@cwp/shared'

export function getSettingsPath(userDataPath: string): string {
  return path.join(userDataPath, 'settings.json')
}

/** Gibt leere Default-Settings zurück (keine Hosts, kein Panel). */
export function getDefaultSettings(): Settings {
  return {
    version: '1.4.0',
    server: { port: 8080 },
    activeHostId: '',
    hosts: [],
    panels: [],
  }
}

/**
 * Lädt Settings aus userDataPath/settings.json.
 * Legt Default-Settings an wenn Datei nicht existiert.
 * Migriert v1.2.0-Settings (fehlender server-Block) automatisch.
 */
export function loadSettings(userDataPath: string): Settings {
  const filePath = getSettingsPath(userDataPath)

  if (!fs.existsSync(filePath)) {
    const defaults = getDefaultSettings()
    fs.mkdirSync(userDataPath, { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(defaults, null, 2), 'utf8')
    return defaults
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  const settings = JSON.parse(raw) as Settings

  let migrated = false

  // Migration: v1.2.0 hat keinen server-Block
  if (!settings.server) {
    settings.server = { port: 8080 }
    settings.version = '1.3.0'
    migrated = true
  }

  // Migration: v1.3.0 → v1.4.0 (VirtualCompanionDeck-Feature)
  if (settings.version === '1.3.0') {
    settings.version = '1.4.0'
    migrated = true
  }

  if (migrated) {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8')
  }

  return settings
}

/** Schreibt Settings in userDataPath/settings.json. */
export function saveSettings(userDataPath: string, settings: Settings): void {
  const filePath = getSettingsPath(userDataPath)
  fs.mkdirSync(userDataPath, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8')
}

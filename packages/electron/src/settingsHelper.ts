/**
 * settingsHelper.ts — Settings laden/speichern für Electron
 *
 * Verwaltet CompanionWebpanel-Settings.
 * userDataPath wird von außen injiziert (app.getPath('userData')) —
 * dadurch ohne Electron vollständig testbar.
 *
 * loadSettingsFile(filePath) — lädt aus explizitem Pfad; Datei muss existieren.
 * Nie auto-create: fehlt die Datei, muss der Aufrufer das behandeln.
 */
import * as fs from 'fs'
import * as path from 'path'
import type { Settings } from '@cwp/shared'

/** Default-Dateiname für neue Installationen. Bestehende settings.json werden nicht umbenannt. */
export function getSettingsPath(userDataPath: string): string {
  return path.join(userDataPath, 'companionwebpanel.json')
}

/** Gibt leere Default-Settings zurück (keine Hosts, kein Panel). */
export function getDefaultSettings(): Settings {
  return {
    version: '1.7.0',
    server: { port: 8080 },
    activeHostId: '',
    hosts: [],
    panels: [],
  }
}

/** Migriert Settings von alter Version auf aktuelle. Gibt true zurück wenn migriert. */
function migrateSettings(settings: Record<string, unknown>): boolean {
  let migrated = false

  // Migration: v1.2.0 hat keinen server-Block
  if (!settings.server) {
    settings.server = { port: 8080 }
    settings.version = '1.3.0'
    migrated = true
  }

  // Migration: v1.3.0 → v1.4.0 (VirtualCompanionDeck-Feature)
  if (settings.version === '1.3.0') { settings.version = '1.4.0'; migrated = true }

  // Migration: v1.4.0 → v1.5.0 (maxPages + pageNames in HostProfile)
  if (settings.version === '1.4.0') { settings.version = '1.5.0'; migrated = true }

  // Migration: v1.5.0 → v1.6.0 (language field — optional, no default needed)
  if (settings.version === '1.5.0') { settings.version = '1.6.0'; migrated = true }

  // Migration: v1.6.0 → v1.7.0 (both new fields are optional, no defaults needed)
  if (settings.version === '1.6.0') { settings.version = '1.7.0'; migrated = true }

  return migrated
}

/**
 * Lädt Settings aus einem expliziten Dateipfad.
 * Datei muss existieren — kein Auto-Create.
 * Migriert ältere Versionen automatisch.
 */
export function loadSettingsFile(filePath: string): Settings {
  const raw = fs.readFileSync(filePath, 'utf8')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = JSON.parse(raw) as any

  if (migrateSettings(settings)) {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8')
  }

  return settings as Settings
}

/** Schreibt Settings in einen expliziten Dateipfad. */
export function saveSettingsFile(filePath: string, settings: Settings): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8')
}

/** Schreibt Settings in <userDataPath>/companionwebpanel.json. */
export function saveSettings(userDataPath: string, settings: Settings): void {
  saveSettingsFile(getSettingsPath(userDataPath), settings)
}

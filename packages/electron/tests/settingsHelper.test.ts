// packages/electron/tests/settingsHelper.test.ts
//
// Settings-Loader: Defaults, Pfade, Speichern, Migration (Schema v1.8.0).
// Wichtig: loadSettingsFile erstellt NIE automatisch eine Datei (seit v1.3.3) —
// fehlt sie, wirft readFileSync und der Aufrufer (main.ts) behandelt configMissing.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  loadSettingsFile,
  saveSettings,
  saveSettingsFile,
  getDefaultSettings,
  getSettingsPath,
} from '../src/settingsHelper'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cwp-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('getDefaultSettings', () => {
  it('returns valid settings with version 1.8.0 and port 8080', () => {
    const s = getDefaultSettings()
    expect(s.version).toBe('1.8.0')
    expect(s.server?.port).toBe(8080)
    expect(s.hosts).toHaveLength(0)
    expect(s.panels).toHaveLength(0)
  })
})

describe('getSettingsPath', () => {
  it('returns path ending in companionwebpanel.json within given dir', () => {
    const p = getSettingsPath(path.join('some', 'dir'))
    expect(p).toBe(path.join('some', 'dir', 'companionwebpanel.json'))
  })
})

describe('loadSettingsFile', () => {
  it('wirft wenn die Datei fehlt — nie auto-create (v1.3.3-Verhalten)', () => {
    expect(() => loadSettingsFile(path.join(tmpDir, 'missing.json'))).toThrow()
  })

  it('loads existing file at explicit path', () => {
    const filePath = path.join(tmpDir, 'my-settings.json')
    const settings = getDefaultSettings()
    settings.server = { port: 7777 }
    fs.writeFileSync(filePath, JSON.stringify(settings))
    const loaded = loadSettingsFile(filePath)
    expect(loaded.server?.port).toBe(7777)
  })

  it('lässt aktuelle 1.8.0-Settings unverändert (kein Rewrite)', () => {
    const filePath = path.join(tmpDir, 'settings.json')
    fs.writeFileSync(filePath, JSON.stringify({
      version: '1.8.0',
      server: { port: 8080 },
      activeHostId: 'h1',
      hosts: [{ id: 'h1', name: 'Studio', host: '10.0.0.1', satellite: { wsPort: 16623 }, httpPort: 8000 }],
      panels: [],
    }))
    const before = fs.statSync(filePath).mtimeMs
    const loaded = loadSettingsFile(filePath)
    expect(loaded.version).toBe('1.8.0')
    expect(loaded.hosts[0].httpPort).toBe(8000)
    expect(fs.statSync(filePath).mtimeMs).toBe(before) // nicht neu geschrieben
  })
})

describe('saveSettings / saveSettingsFile', () => {
  it('saveSettings writes companionwebpanel.json', () => {
    const s = getDefaultSettings()
    s.server = { port: 1234 }
    saveSettings(tmpDir, s)
    const raw = fs.readFileSync(path.join(tmpDir, 'companionwebpanel.json'), 'utf8')
    expect(JSON.parse(raw).server.port).toBe(1234)
  })

  it('saveSettingsFile writes to explicit path', () => {
    const filePath = path.join(tmpDir, 'explicit.json')
    const s = getDefaultSettings()
    s.server = { port: 5555 }
    saveSettingsFile(filePath, s)
    const raw = fs.readFileSync(filePath, 'utf8')
    expect(JSON.parse(raw).server.port).toBe(5555)
  })
})

describe('migration', () => {
  it('migriert 1.7.0 → 1.8.0 (httpPort optional, Host-Daten unangetastet, Datei persistiert)', () => {
    const filePath = path.join(tmpDir, 'settings.json')
    fs.writeFileSync(filePath, JSON.stringify({
      version: '1.7.0',
      server: { port: 8080 },
      activeHostId: 'h1',
      hosts: [{ id: 'h1', name: 'Studio', host: '10.0.0.1', satellite: { wsPort: 16623 } }],
      panels: [],
    }))
    const loaded = loadSettingsFile(filePath)
    expect(loaded.version).toBe('1.8.0')
    expect(loaded.hosts[0].host).toBe('10.0.0.1')
    expect(loaded.hosts[0].httpPort).toBeUndefined()
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8')).version).toBe('1.8.0')
  })

  it('migrates v1.2.0 settings all the way to v1.8.0', () => {
    const filePath = path.join(tmpDir, 'companionwebpanel.json')
    fs.writeFileSync(filePath, JSON.stringify({ version: '1.2.0', activeHostId: '', hosts: [], panels: [] }))
    const loaded = loadSettingsFile(filePath)
    expect(loaded.version).toBe('1.8.0')
    expect(loaded.server?.port).toBe(8080)
  })
})

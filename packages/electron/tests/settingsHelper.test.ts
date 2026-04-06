import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { loadSettings, saveSettings, getDefaultSettings, getSettingsPath } from '../src/settingsHelper'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cwp-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('getDefaultSettings', () => {
  it('returns valid settings with version 1.3.0 and port 8080', () => {
    const s = getDefaultSettings()
    expect(s.version).toBe('1.3.0')
    expect(s.server?.port).toBe(8080)
    expect(s.hosts).toHaveLength(0)
    expect(s.panels).toHaveLength(0)
  })
})

describe('loadSettings', () => {
  it('creates default settings if file does not exist', () => {
    const s = loadSettings(tmpDir)
    expect(s.version).toBe('1.3.0')
    expect(fs.existsSync(path.join(tmpDir, 'settings.json'))).toBe(true)
  })

  it('loads existing settings from file', () => {
    const settings = getDefaultSettings()
    settings.server = { port: 9090 }
    fs.writeFileSync(
      path.join(tmpDir, 'settings.json'),
      JSON.stringify(settings)
    )
    const loaded = loadSettings(tmpDir)
    expect(loaded.server?.port).toBe(9090)
  })

  it('migrates v1.2.0 settings by adding server block', () => {
    const old = {
      version: '1.2.0',
      activeHostId: '',
      hosts: [],
      panels: [],
    }
    fs.writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify(old))
    const loaded = loadSettings(tmpDir)
    expect(loaded.server?.port).toBe(8080)
  })
})

describe('saveSettings', () => {
  it('writes settings to file', () => {
    const s = getDefaultSettings()
    s.server = { port: 7777 }
    saveSettings(tmpDir, s)
    const raw = fs.readFileSync(path.join(tmpDir, 'settings.json'), 'utf8')
    expect(JSON.parse(raw).server.port).toBe(7777)
  })
})

describe('getSettingsPath', () => {
  it('returns path ending in settings.json within given dir', () => {
    const p = getSettingsPath(path.join('some', 'dir'))
    expect(p).toBe(path.join('some', 'dir', 'settings.json'))
  })
})

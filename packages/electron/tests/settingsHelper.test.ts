import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  loadSettings,
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
  it('returns valid settings with version 1.7.0 and port 8080', () => {
    const s = getDefaultSettings()
    expect(s.version).toBe('1.7.0')
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

describe('loadSettings (dir-based)', () => {
  it('creates companionwebpanel.json if no file exists', () => {
    const s = loadSettings(tmpDir)
    expect(s.version).toBe('1.7.0')
    expect(fs.existsSync(path.join(tmpDir, 'companionwebpanel.json'))).toBe(true)
  })

  it('loads existing companionwebpanel.json', () => {
    const settings = getDefaultSettings()
    settings.server = { port: 9090 }
    fs.writeFileSync(
      path.join(tmpDir, 'companionwebpanel.json'),
      JSON.stringify(settings),
    )
    const loaded = loadSettings(tmpDir)
    expect(loaded.server?.port).toBe(9090)
  })
})

describe('loadSettingsFile (path-based)', () => {
  it('creates file at explicit path if not exists', () => {
    const filePath = path.join(tmpDir, 'custom-name.json')
    const s = loadSettingsFile(filePath)
    expect(s.version).toBe('1.7.0')
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('loads existing file at explicit path', () => {
    const filePath = path.join(tmpDir, 'my-settings.json')
    const settings = getDefaultSettings()
    settings.server = { port: 7777 }
    fs.writeFileSync(filePath, JSON.stringify(settings))
    const loaded = loadSettingsFile(filePath)
    expect(loaded.server?.port).toBe(7777)
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
  it('migrates v1.2.0 settings all the way to v1.7.0', () => {
    const old = { version: '1.2.0', activeHostId: '', hosts: [], panels: [] }
    fs.writeFileSync(path.join(tmpDir, 'companionwebpanel.json'), JSON.stringify(old))
    const loaded = loadSettings(tmpDir)
    expect(loaded.version).toBe('1.7.0')
    expect(loaded.server?.port).toBe(8080)
  })
})

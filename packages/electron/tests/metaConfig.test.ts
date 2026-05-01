import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { normalizePath, expandPath, loadMeta, saveMeta } from '../src/metaConfig'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cwp-meta-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('normalizePath / expandPath', () => {
  it('replaces homedir with ~ and expands back', () => {
    const home = os.homedir()
    const abs = path.join(home, 'Documents', 'cwp', 'companionwebpanel.json')
    const norm = normalizePath(abs)
    expect(norm.startsWith('~')).toBe(true)
    expect(norm).not.toContain(home)
    expect(expandPath(norm)).toBe(abs)
  })

  it('leaves paths outside homedir unchanged', () => {
    // Use a path that can never be inside homedir
    const outside = path.isAbsolute('/tmp/other.json') ? '/tmp/other.json' : 'C:\\other\\file.json'
    const norm = normalizePath(outside)
    expect(norm).toBe(outside)
    expect(expandPath(norm)).toBe(outside)
  })

  it('round-trips correctly on current platform', () => {
    const abs = path.join(os.homedir(), 'test', 'settings.json')
    expect(expandPath(normalizePath(abs))).toBe(abs)
  })
})

describe('loadMeta / saveMeta', () => {
  it('returns empty object when meta.json does not exist', () => {
    const meta = loadMeta(tmpDir)
    expect(meta).toEqual({})
  })

  it('saves and loads settingsPath', () => {
    saveMeta(tmpDir, { settingsPath: '~/Documents/cwp.json' })
    const meta = loadMeta(tmpDir)
    expect(meta.settingsPath).toBe('~/Documents/cwp.json')
  })

  it('overwrites previous meta', () => {
    saveMeta(tmpDir, { settingsPath: '~/old.json' })
    saveMeta(tmpDir, { settingsPath: '~/new.json' })
    expect(loadMeta(tmpDir).settingsPath).toBe('~/new.json')
  })
})

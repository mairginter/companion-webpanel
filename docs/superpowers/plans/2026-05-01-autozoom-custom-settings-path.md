# Auto-Zoom + Custom Settings Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-panel auto-zoom (fit-to-window) and custom settings file path support with a schema bump to v1.7.0.

**Architecture:** Schema bump first as shared foundation, then frontend-only auto-zoom (store + ZoomControl + Canvas ResizeObserver), then Electron-only custom settings path (metaConfig.ts + main.ts path resolution + IPC + startup.html UI).

**Tech Stack:** React + Zustand (frontend), Electron IPC + Node.js fs (backend), vitest (tests), TypeScript throughout.

**Spec:** `docs/superpowers/specs/2026-05-01-autozoom-custom-settings-path-design.md`

---

## File Map

| File | Change |
|---|---|
| `packages/shared/src/types.ts` | `Settings.settingsPath?`, `Panel.autoZoom?`, version `'1.7.0'` |
| `CompanionWebpannelSettings.schema.json` | version pattern + 2 new fields |
| `CompanionWebpannelSettings.json` | version bump |
| `packages/backend/src/standalone.ts` | expectedVersion `'1.7.0'` |
| `packages/backend/src/server/ClientServer.ts` | version check `'1.7.0'` |
| `packages/electron/src/settingsHelper.ts` | default filename, `loadSettingsFile`, `saveSettingsFile`, migration stub, tests updated |
| `packages/electron/tests/settingsHelper.test.ts` | update expectations for new filename + version |
| `packages/electron/src/metaConfig.ts` | NEW — MetaConfig, loadMeta, saveMeta, normalizePath, expandPath |
| `packages/electron/tests/metaConfig.test.ts` | NEW — unit tests for pure path functions |
| `packages/frontend/src/store/useAppStore.ts` | `setAutoZoom` action |
| `packages/frontend/src/store/useAppStore.test.ts` | `makeSettings` version + setAutoZoom test |
| `packages/frontend/src/components/Toolbar/ZoomControl.tsx` | Fit button + `autoZoom` props |
| `packages/frontend/src/components/Toolbar/Toolbar.tsx` | wire `autoZoom` + `onAutoZoomChange` |
| `packages/frontend/src/components/Canvas/Canvas.tsx` | ResizeObserver + Ctrl+Scroll integration |
| `packages/electron/src/main.ts` | startup path resolution + 3 IPC handlers |
| `packages/electron/src/preload.ts` | 3 new API methods |
| `packages/electron/src/startupWindow.ts` | height 240 → 270 |
| `packages/electron/renderer/startup.html` | preference file row + JS logic |
| `packages/shared/locales/de.json` | `startup.loadPreferenceFile` |
| `packages/shared/locales/en.json` | `startup.loadPreferenceFile` |

---

## Task 1: Schema bump — shared types + schema.json + backend

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `CompanionWebpannelSettings.schema.json`
- Modify: `CompanionWebpannelSettings.json`
- Modify: `packages/backend/src/standalone.ts:33`
- Modify: `packages/backend/src/server/ClientServer.ts:136`

- [ ] **Step 1.1 — Update `types.ts`**

In `packages/shared/src/types.ts`, make these changes:

```typescript
// Line 3 — change version literal:
export interface Settings {
  version: '1.7.0'
  /** UI language code (e.g. 'de', 'en'). Applied to all clients without a per-device override. */
  language?: string
  /** Custom path to this settings file (~-normalized). Stored so cloud-synced copies can self-identify. */
  settingsPath?: string
  activeHostId: string
  hosts: HostProfile[]
  panels: Panel[]
  /** Backend-Server-Konfiguration (optional — default port: 8080) */
  server?: { port?: number }
}
```

```typescript
// Panel interface — add autoZoom after the zoom field:
export interface Panel {
  id: string
  name: string
  zoom: number
  /** When true, zoom is auto-calculated to fit the window. Stored per-panel. */
  autoZoom?: boolean
  defaultMode: 'view' | 'edit'
  grid: { enabled: boolean; size: number; snap: boolean }
  canvas?: { width?: number; height?: number; background?: string; texture?: string }
  elements: AnyElement[]
}
```

- [ ] **Step 1.2 — Update `schema.json`**

In `CompanionWebpannelSettings.schema.json`:

```json
// Line 16-17 — change version pattern:
"version": {
  "type": "string",
  "pattern": "^1\\.7\\.0$"
},
```

After the `"language"` property block (around line 53), add:

```json
"settingsPath": {
  "type": "string",
  "description": "Custom path to this file (~-normalized). Machine-specific; set by main process."
},
```

In the Panel `$def`, find the `"zoom"` property and add after it:

```json
"autoZoom": {
  "type": "boolean",
  "description": "When true, zoom is auto-calculated to fit the window."
},
```

- [ ] **Step 1.3 — Update `CompanionWebpannelSettings.json`**

Change `"version": "1.6.0"` → `"version": "1.7.0"` in the root settings file.

- [ ] **Step 1.4 — Update backend standalone.ts**

In `packages/backend/src/standalone.ts` line 33:
```typescript
  const expectedVersion: Settings['version'] = '1.7.0'
```

- [ ] **Step 1.5 — Update ClientServer.ts**

In `packages/backend/src/server/ClientServer.ts` at the line containing `'1.6.0'`:
```typescript
            if (incoming.version !== '1.7.0') {
```

- [ ] **Step 1.6 — Build shared package**

```bash
npm run build -w @cwp/shared
```

Expected: no errors. The compiled output updates so backend and electron compile against the new types.

- [ ] **Step 1.7 — Commit**

```bash
git add packages/shared/src/types.ts CompanionWebpannelSettings.schema.json CompanionWebpannelSettings.json packages/backend/src/standalone.ts packages/backend/src/server/ClientServer.ts
git commit -m "feat: schema bump v1.6.0 → v1.7.0 (autoZoom + settingsPath)"
```

---

## Task 2: settingsHelper.ts — default filename + migration + file-path helpers

**Files:**
- Modify: `packages/electron/src/settingsHelper.ts`
- Modify: `packages/electron/tests/settingsHelper.test.ts`

- [ ] **Step 2.1 — Write failing tests first**

Replace the entire contents of `packages/electron/tests/settingsHelper.test.ts`:

```typescript
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
```

- [ ] **Step 2.2 — Run tests to verify they fail**

```bash
npx vitest run packages/electron/tests/settingsHelper.test.ts
```

Expected: multiple failures (version mismatch, wrong filename, missing functions).

- [ ] **Step 2.3 — Rewrite `settingsHelper.ts`**

Replace the entire contents of `packages/electron/src/settingsHelper.ts`:

```typescript
/**
 * settingsHelper.ts — Settings laden/speichern für Electron
 *
 * Verwaltet CompanionWebpanel-Settings.
 * userDataPath wird von außen injiziert (app.getPath('userData')) —
 * dadurch ohne Electron vollständig testbar.
 *
 * Zwei Ladewege:
 *   loadSettings(userDataPath)       — lädt aus <userDataPath>/companionwebpanel.json
 *   loadSettingsFile(filePath)       — lädt aus explizitem Pfad (Custom Settings Path Feature)
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

  if (!settings.server) {
    settings.server = { port: 8080 }
    settings.version = '1.3.0'
    migrated = true
  }
  if (settings.version === '1.3.0') { settings.version = '1.4.0'; migrated = true }
  if (settings.version === '1.4.0') { settings.version = '1.5.0'; migrated = true }
  if (settings.version === '1.5.0') { settings.version = '1.6.0'; migrated = true }
  if (settings.version === '1.6.0') { settings.version = '1.7.0'; migrated = true }

  return migrated
}

/**
 * Lädt Settings aus einem expliziten Dateipfad.
 * Legt Default-Settings an wenn Datei nicht existiert.
 * Migriert ältere Versionen automatisch.
 */
export function loadSettingsFile(filePath: string): Settings {
  if (!fs.existsSync(filePath)) {
    const defaults = getDefaultSettings()
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(defaults, null, 2), 'utf8')
    return defaults
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = JSON.parse(raw) as any

  if (migrateSettings(settings)) {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8')
  }

  return settings as Settings
}

/**
 * Lädt Settings aus <userDataPath>/companionwebpanel.json.
 * Legt Default-Settings an wenn Datei nicht existiert.
 */
export function loadSettings(userDataPath: string): Settings {
  return loadSettingsFile(getSettingsPath(userDataPath))
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
```

- [ ] **Step 2.4 — Run tests to verify they pass**

```bash
npx vitest run packages/electron/tests/settingsHelper.test.ts
```

Expected: all tests pass.

- [ ] **Step 2.5 — Commit**

```bash
git add packages/electron/src/settingsHelper.ts packages/electron/tests/settingsHelper.test.ts
git commit -m "feat: settingsHelper — new default filename + loadSettingsFile/saveSettingsFile + v1.7.0 migration"
```

---

## Task 3: metaConfig.ts — machine-local path config

**Files:**
- Create: `packages/electron/src/metaConfig.ts`
- Create: `packages/electron/tests/metaConfig.test.ts`

- [ ] **Step 3.1 — Write failing tests**

Create `packages/electron/tests/metaConfig.test.ts`:

```typescript
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
    // Use a path guaranteed to be outside homedir
    const abs = path.isAbsolute('/tmp/other.json') ? '/tmp/other.json' : 'C:\\other\\file.json'
    const norm = normalizePath(abs)
    expect(norm).toBe(abs)
    expect(expandPath(norm)).toBe(abs)
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
```

- [ ] **Step 3.2 — Run to verify failure**

```bash
npx vitest run packages/electron/tests/metaConfig.test.ts
```

Expected: FAIL — cannot find module `../src/metaConfig`.

- [ ] **Step 3.3 — Create `metaConfig.ts`**

Create `packages/electron/src/metaConfig.ts`:

```typescript
/**
 * metaConfig.ts — Machine-local meta configuration
 *
 * Stores machine-specific data that must NOT be synced to cloud.
 * Currently: the path to the active settings file (custom or default).
 *
 * Path: userData/meta.json
 * Format: { settingsPath?: string }  (normalized with ~, expanded on read)
 */
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface MetaConfig {
  /** ~-normalized path to the active settings file. Machine-specific. */
  settingsPath?: string
}

/** Replaces os.homedir() prefix with ~ for portable storage. */
export function normalizePath(abs: string): string {
  const home = os.homedir()
  if (abs.startsWith(home + path.sep) || abs === home) {
    return '~' + abs.slice(home.length)
  }
  return abs
}

/** Expands leading ~ back to os.homedir(). */
export function expandPath(norm: string): string {
  if (norm === '~') return os.homedir()
  if (norm.startsWith('~' + path.sep) || norm.startsWith('~/')) {
    return path.join(os.homedir(), norm.slice(2))
  }
  return norm
}

function metaPath(userDataPath: string): string {
  return path.join(userDataPath, 'meta.json')
}

/** Loads meta config from userData/meta.json. Returns {} if file missing or malformed. */
export function loadMeta(userDataPath: string): MetaConfig {
  const p = metaPath(userDataPath)
  if (!fs.existsSync(p)) return {}
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as MetaConfig
  } catch {
    return {}
  }
}

/** Saves meta config to userData/meta.json. */
export function saveMeta(userDataPath: string, meta: MetaConfig): void {
  fs.mkdirSync(userDataPath, { recursive: true })
  fs.writeFileSync(metaPath(userDataPath), JSON.stringify(meta, null, 2), 'utf8')
}
```

- [ ] **Step 3.4 — Run tests to verify they pass**

```bash
npx vitest run packages/electron/tests/metaConfig.test.ts
```

Expected: all tests pass.

- [ ] **Step 3.5 — Commit**

```bash
git add packages/electron/src/metaConfig.ts packages/electron/tests/metaConfig.test.ts
git commit -m "feat: add metaConfig.ts — machine-local meta.json with path normalization"
```

---

## Task 4: Store — setAutoZoom action

**Files:**
- Modify: `packages/frontend/src/store/useAppStore.ts`
- Modify: `packages/frontend/src/store/useAppStore.test.ts`

- [ ] **Step 4.1 — Update makeSettings + add setAutoZoom test**

In `packages/frontend/src/store/useAppStore.test.ts`:

Change line 6:
```typescript
  version: '1.7.0',
```

Add after the existing `describe('clearSelection', ...)` block:

```typescript
describe('setZoom', () => {
  it('setzt Zoom-Faktor für ein Panel', () => {
    useAppStore.getState().setZoom('panel-1', 1.5)
    expect(useAppStore.getState().getActivePanel()?.zoom).toBe(1.5)
  })

  it('klemmt Zoom auf [0.2, 2.0]', () => {
    useAppStore.getState().setZoom('panel-1', 5.0)
    expect(useAppStore.getState().getActivePanel()?.zoom).toBe(2.0)
    useAppStore.getState().setZoom('panel-1', 0.01)
    expect(useAppStore.getState().getActivePanel()?.zoom).toBe(0.2)
  })
})

describe('setAutoZoom', () => {
  it('setzt autoZoom auf true für ein Panel', () => {
    useAppStore.getState().setAutoZoom('panel-1', true)
    expect(useAppStore.getState().getActivePanel()?.autoZoom).toBe(true)
  })

  it('setzt autoZoom auf false für ein Panel', () => {
    useAppStore.getState().setAutoZoom('panel-1', true)
    useAppStore.getState().setAutoZoom('panel-1', false)
    expect(useAppStore.getState().getActivePanel()?.autoZoom).toBe(false)
  })

  it('verändert anderen Panels autoZoom nicht', () => {
    // panel-1 ist aktiv; setAutoZoom auf nicht-existentes Panel ändert nichts
    useAppStore.getState().setAutoZoom('other-panel', true)
    expect(useAppStore.getState().getActivePanel()?.autoZoom).toBeUndefined()
  })
})
```

- [ ] **Step 4.2 — Run tests to see the new ones fail**

```bash
npx vitest run packages/frontend/src/store/useAppStore.test.ts
```

Expected: `setAutoZoom` tests fail (method does not exist), version test fails.

- [ ] **Step 4.3 — Add setAutoZoom to the store interface**

In `packages/frontend/src/store/useAppStore.ts`, find the line with `setZoom`:
```typescript
  /** Setzt den Zoom-Faktor eines Panels. Klemmt auf [0.2, 2.0]. */
  setZoom: (panelId: string, zoom: number) => void
```

Add directly below it:
```typescript
  /** Aktiviert/Deaktiviert Auto-Zoom (Fit-to-Window) für ein Panel. */
  setAutoZoom: (panelId: string, value: boolean) => void
```

- [ ] **Step 4.4 — Add setAutoZoom implementation**

In `packages/frontend/src/store/useAppStore.ts`, find the `setZoom` implementation (around line 353):
```typescript
  setZoom: (panelId, zoom) =>
    set((s) => {
      if (!s.settings) return s
      const clamped = Math.max(0.2, Math.min(2.0, zoom))
      return {
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p) =>
            p.id !== panelId ? p : { ...p, zoom: clamped },
          ),
        },
      }
    }),
```

Add directly after it:
```typescript
  setAutoZoom: (panelId, value) =>
    set((s) => {
      if (!s.settings) return s
      return {
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p) =>
            p.id !== panelId ? p : { ...p, autoZoom: value },
          ),
        },
      }
    }),
```

- [ ] **Step 4.5 — Run tests to verify all pass**

```bash
npx vitest run packages/frontend/src/store/useAppStore.test.ts
```

Expected: all tests pass including the new setAutoZoom tests.

- [ ] **Step 4.6 — Commit**

```bash
git add packages/frontend/src/store/useAppStore.ts packages/frontend/src/store/useAppStore.test.ts
git commit -m "feat: add setAutoZoom store action + tests (v1.7.0 fixture)"
```

---

## Task 5: ZoomControl — Fit button

**Files:**
- Modify: `packages/frontend/src/components/Toolbar/ZoomControl.tsx`

- [ ] **Step 5.1 — Update ZoomControl with new props and Fit button**

Replace the entire contents of `packages/frontend/src/components/Toolbar/ZoomControl.tsx`:

```typescript
/**
 * ZoomControl.tsx
 *
 * Toolbar-Button mit Zoom-Popover.
 * Klick auf den Button öffnet Slider (20–200%, Step 5%), 100%-Reset und Fit-Button.
 * Bei Zoom ≠ 100% oder autoZoom: blauer Tint.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'

interface ZoomControlProps {
  zoom: number
  onZoomChange: (zoom: number) => void
  autoZoom: boolean
  onAutoZoomChange: (value: boolean) => void
}

export function ZoomControl({ zoom, onZoomChange, autoZoom, onAutoZoomChange }: ZoomControlProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pct = Math.round(zoom * 100)
  const isScaled = Math.abs(zoom - 1.0) > 0.01
  const isActive = isScaled || autoZoom || open

  const handleSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onZoomChange(parseInt(e.target.value, 10) / 100)
    },
    [onZoomChange],
  )

  const handleReset = useCallback(() => {
    onAutoZoomChange(false)
    onZoomChange(1.0)
  }, [onZoomChange, onAutoZoomChange])

  const handleFitToggle = useCallback(() => {
    onAutoZoomChange(!autoZoom)
  }, [autoZoom, onAutoZoomChange])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Icon-Button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Zoom (Ctrl+Scroll)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          height: 32,
          padding: '0 8px',
          borderRadius: 6,
          border: `1px solid ${isActive ? '#4a9eff' : '#2a3344'}`,
          background: isActive ? 'rgba(74,158,255,0.12)' : '#1a2030',
          color: isActive ? '#4a9eff' : '#8896aa',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          transition: 'all 0.15s',
        }}
      >
        <span className="material-icons" style={{ fontSize: 16 }}>
          {autoZoom ? 'fit_screen' : 'zoom_in'}
        </span>
        <span style={{ minWidth: 36, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
          {autoZoom ? 'Fit' : `${pct}%`}
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: '#1a2030',
            border: '1px solid #2a3344',
            borderRadius: 8,
            padding: '10px 12px',
            width: 220,
            zIndex: 500,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Slider-Zeile — deaktiviert wenn autoZoom aktiv */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min={20}
              max={200}
              step={5}
              value={pct}
              onChange={handleSlider}
              disabled={autoZoom}
              style={{
                flex: 1,
                accentColor: '#4a9eff',
                cursor: autoZoom ? 'not-allowed' : 'pointer',
                opacity: autoZoom ? 0.4 : 1,
              }}
            />
            <span
              style={{
                fontSize: 13,
                color: autoZoom ? '#4a5568' : '#e9edf2',
                minWidth: 38,
                textAlign: 'right',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {pct}%
            </span>
          </div>

          {/* Button-Zeile: 100% | Fit */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleReset}
              style={{
                padding: '3px 10px',
                borderRadius: 5,
                border: '1px solid #2a3344',
                background: 'transparent',
                color: '#8896aa',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              100%
            </button>
            <button
              onClick={handleFitToggle}
              title="Fit to Window — passt Zoom automatisch ans Fenster an"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                borderRadius: 5,
                border: `1px solid ${autoZoom ? '#4a9eff' : '#2a3344'}`,
                background: autoZoom ? 'rgba(74,158,255,0.12)' : 'transparent',
                color: autoZoom ? '#4a9eff' : '#8896aa',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>fit_screen</span>
              Fit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5.2 — TypeScript check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: error on `Toolbar.tsx` — ZoomControl now requires `autoZoom` and `onAutoZoomChange` props. Fix in next task.

- [ ] **Step 5.3 — Commit (pre-fix, TS error expected in Toolbar)**

```bash
git add packages/frontend/src/components/Toolbar/ZoomControl.tsx
git commit -m "feat: ZoomControl — add Fit button + autoZoom props"
```

---

## Task 6: Toolbar — wire autoZoom

**Files:**
- Modify: `packages/frontend/src/components/Toolbar/Toolbar.tsx`

- [ ] **Step 6.1 — Update Toolbar to read autoZoom from store and pass to ZoomControl**

In `packages/frontend/src/components/Toolbar/Toolbar.tsx`:

Find these lines (around 114–116):
```typescript
  const activePanel = panels.find((p) => p.id === activePanelId)
  const setZoom = useAppStore((s) => s.setZoom)
  const zoom = activePanel?.zoom ?? 1
```

Replace with:
```typescript
  const activePanel = panels.find((p) => p.id === activePanelId)
  const setZoom = useAppStore((s) => s.setZoom)
  const setAutoZoom = useAppStore((s) => s.setAutoZoom)
  const zoom = activePanel?.zoom ?? 1
  const autoZoom = activePanel?.autoZoom ?? false
```

Find the ZoomControl usage (around line 386–391):
```typescript
      <ZoomControl
        zoom={zoom}
        onZoomChange={(z) => {
          if (activePanel) setZoom(activePanel.id, z)
        }}
      />
```

Replace with:
```typescript
      <ZoomControl
        zoom={zoom}
        onZoomChange={(z) => {
          if (activePanel) setZoom(activePanel.id, z)
        }}
        autoZoom={autoZoom}
        onAutoZoomChange={(v) => {
          if (activePanel) setAutoZoom(activePanel.id, v)
        }}
      />
```

- [ ] **Step 6.2 — TypeScript check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors.

- [ ] **Step 6.3 — Commit**

```bash
git add packages/frontend/src/components/Toolbar/Toolbar.tsx
git commit -m "feat: Toolbar — wire autoZoom + onAutoZoomChange to ZoomControl"
```

---

## Task 7: Canvas — ResizeObserver + autoZoom logic

**Files:**
- Modify: `packages/frontend/src/components/Canvas/Canvas.tsx`

- [ ] **Step 7.1 — Add autoZoom ResizeObserver**

In `packages/frontend/src/components/Canvas/Canvas.tsx`, find these lines (around 55–57):

```typescript
  const setZoom = useAppStore((s) => s.setZoom)
  const zoom = panel?.zoom ?? 1
  const scrollWrapperRef = useRef<HTMLDivElement>(null)
```

Replace with:
```typescript
  const setZoom = useAppStore((s) => s.setZoom)
  const setAutoZoom = useAppStore((s) => s.setAutoZoom)
  const zoom = panel?.zoom ?? 1
  const autoZoom = panel?.autoZoom ?? false
  const scrollWrapperRef = useRef<HTMLDivElement>(null)
```

After the existing Ctrl+Scroll `useEffect` (after line 98), add:

```typescript
  // Auto-zoom: ResizeObserver passt Zoom ans Fenster an wenn panel.autoZoom aktiv
  useEffect(() => {
    if (!autoZoom || !scrollWrapperRef.current || !panel) return

    const canvasW = panel.canvas?.width ?? 1920
    const canvasH = panel.canvas?.height ?? 1080

    let debounceTimer: ReturnType<typeof setTimeout>

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        const fitZoom = Math.min(width / canvasW, height / canvasH)
        const currentPanel = useAppStore.getState().getActivePanel()
        if (currentPanel) setZoom(currentPanel.id, fitZoom)
      }, 50)
    })

    observer.observe(scrollWrapperRef.current)
    return () => {
      observer.disconnect()
      clearTimeout(debounceTimer)
    }
  }, [autoZoom, panel?.id, panel?.canvas?.width, panel?.canvas?.height, setZoom])
```

- [ ] **Step 7.2 — Ctrl+Scroll disables autoZoom**

Find the existing Ctrl+Scroll handler (around line 84–98):

```typescript
  useEffect(() => {
    const el = scrollWrapperRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.05 : -0.05
      const currentPanel = useAppStore.getState().getActivePanel()
      if (!currentPanel) return
      const newZoom = Math.max(0.2, Math.min(2.0, (currentPanel.zoom ?? 1) + delta))
      setZoom(currentPanel.id, newZoom)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [setZoom])
```

Replace with:
```typescript
  useEffect(() => {
    const el = scrollWrapperRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.05 : -0.05
      const currentPanel = useAppStore.getState().getActivePanel()
      if (!currentPanel) return
      // Ctrl+Scroll schaltet autoZoom aus — User übernimmt manuelle Kontrolle
      if (currentPanel.autoZoom) setAutoZoom(currentPanel.id, false)
      const newZoom = Math.max(0.2, Math.min(2.0, (currentPanel.zoom ?? 1) + delta))
      setZoom(currentPanel.id, newZoom)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [setZoom, setAutoZoom])
```

- [ ] **Step 7.3 — TypeScript check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

Expected: no errors.

- [ ] **Step 7.4 — Commit**

```bash
git add packages/frontend/src/components/Canvas/Canvas.tsx
git commit -m "feat: Canvas — ResizeObserver for autoZoom + Ctrl+Scroll disables autoZoom"
```

---

## Task 8: main.ts — startup path resolution

**Files:**
- Modify: `packages/electron/src/main.ts`

- [ ] **Step 8.1 — Add imports for metaConfig and new settingsHelper exports**

In `packages/electron/src/main.ts`, find the existing import line:
```typescript
import { loadSettings, saveSettings, getSettingsPath } from './settingsHelper'
```

Replace with:
```typescript
import { loadSettingsFile, saveSettingsFile, getSettingsPath, getDefaultSettings } from './settingsHelper'
import { loadMeta, saveMeta, normalizePath, expandPath } from './metaConfig'
```

- [ ] **Step 8.2 — Replace startup settings loading with path-resolution logic**

Find this block in `main.ts` (around lines 40–46):

```typescript
  const userDataPath = app.getPath('userData')
  const settings = loadSettings(userDataPath)

  // Initialise Electron i18n with the language from settings (fallback: 'de')
  await initElectronI18n(settings.language ?? 'de')

  const settingsPath = getSettingsPath(userDataPath)
```

Replace with:
```typescript
  const userDataPath = app.getPath('userData')

  // ─── Settings-Pfad auflösen (meta.json → settings.settingsPath → Backwards-Compat) ─
  const meta = loadMeta(userDataPath)
  const defaultSettingsPath = getSettingsPath(userDataPath)
  // Backwards-Compat: bestehende settings.json beim Upgrade erhalten
  const legacyPath = require('path').join(userDataPath, 'settings.json')
  const fs_mod = require('fs')

  let activeSettingsPath: string
  if (meta.settingsPath) {
    activeSettingsPath = expandPath(meta.settingsPath)
  } else if (fs_mod.existsSync(legacyPath)) {
    activeSettingsPath = legacyPath
  } else {
    activeSettingsPath = defaultSettingsPath
  }

  let settings = loadSettingsFile(activeSettingsPath)

  // Settings-Vorrang: wenn settings.settingsPath auf anderen Pfad zeigt → redirect
  if (settings.settingsPath) {
    const fromSettings = expandPath(settings.settingsPath)
    if (fromSettings !== activeSettingsPath) {
      activeSettingsPath = fromSettings
      settings = loadSettingsFile(activeSettingsPath)
      saveMeta(userDataPath, { settingsPath: normalizePath(activeSettingsPath) })
    }
  }

  // Initialise Electron i18n with the language from settings (fallback: 'de')
  await initElectronI18n(settings.language ?? 'de')

  const settingsPath = activeSettingsPath
```

- [ ] **Step 8.3 — Fix saveSettings call at the end of change-port handler**

In `main.ts`, find the `change-port` IPC handler. It calls `saveSettings(userDataPath, settings)`. Replace with:

```typescript
    saveSettingsFile(activeSettingsPath, settings)
```

(Search for `saveSettings(userDataPath` — there should be one occurrence in `change-port`.)

- [ ] **Step 8.4 — TypeScript check for electron package**

```bash
npx tsc --noEmit -p packages/electron/tsconfig.json
```

Expected: no errors.

- [ ] **Step 8.5 — Commit**

```bash
git add packages/electron/src/main.ts
git commit -m "feat: main.ts — settings path resolution via meta.json with backwards-compat"
```

---

## Task 9: IPC handlers + preload

**Files:**
- Modify: `packages/electron/src/main.ts`
- Modify: `packages/electron/src/preload.ts`

- [ ] **Step 9.1 — Add 3 IPC handlers to main.ts**

In `packages/electron/src/main.ts`, find the existing IPC handlers section. After the `'open-settings-folder'` handler, add:

```typescript
  ipcMain.handle('get-settings-path', () => normalizePath(activeSettingsPath))

  ipcMain.handle('choose-settings-path', async () => {
    const result = await dialog.showOpenDialog({
      defaultPath: require('path').dirname(activeSettingsPath),
      filters: [{ name: 'JSON Settings', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return normalizePath(result.filePaths[0])
  })

  ipcMain.handle('apply-settings-path', async (_event, normalizedNewPath: string) => {
    const newAbsPath = expandPath(normalizedNewPath)
    // Aktuellen Settings-Inhalt in neue Datei übernehmen (falls noch nicht dort)
    const fs_apply = require('fs')
    if (!fs_apply.existsSync(newAbsPath)) {
      saveSettingsFile(newAbsPath, settings)
    }
    // settingsPath-Feld in aktuelle Settings-Datei schreiben
    settings.settingsPath = normalizedNewPath
    saveSettingsFile(activeSettingsPath, settings)
    // meta.json auf neuen Pfad setzen
    saveMeta(userDataPath, { settingsPath: normalizedNewPath })
    // App neu starten
    app.relaunch()
    app.quit()
  })
```

- [ ] **Step 9.2 — Extend preload.ts**

In `packages/electron/src/preload.ts`, find the `contextBridge.exposeInMainWorld('cwpApi', {` block. Add these three methods before the closing `})`:

```typescript
  getSettingsPath: (): Promise<string> =>
    ipcRenderer.invoke('get-settings-path'),

  chooseSettingsPath: (): Promise<string | null> =>
    ipcRenderer.invoke('choose-settings-path'),

  applySettingsPath: (path: string): Promise<void> =>
    ipcRenderer.invoke('apply-settings-path', path),
```

Also update the JSDoc comment at the top of preload.ts to include the new methods:
```typescript
 *   getSettingsPath()        → current settings file path (~-normalized)
 *   chooseSettingsPath()     → opens file picker, returns chosen path or null
 *   applySettingsPath(path)  → saves new path + relaunches app
```

- [ ] **Step 9.3 — TypeScript check**

```bash
npx tsc --noEmit -p packages/electron/tsconfig.json
```

Expected: no errors.

- [ ] **Step 9.4 — Commit**

```bash
git add packages/electron/src/main.ts packages/electron/src/preload.ts
git commit -m "feat: IPC — get/choose/apply settings path + preload API"
```

---

## Task 10: i18n + startup.html UI + window height

**Files:**
- Modify: `packages/shared/locales/de.json`
- Modify: `packages/shared/locales/en.json`
- Modify: `packages/electron/src/main.ts`
- Modify: `packages/electron/src/startupWindow.ts`
- Modify: `packages/electron/renderer/startup.html`

- [ ] **Step 10.1 — Add i18n string to de.json**

In `packages/shared/locales/de.json`, find the `"startup"` section:
```json
  "startup": {
    "panelRunsOn": "Panel läuft auf:",
    ...
    "apply": "Apply"
  },
```

Add `"loadPreferenceFile"` and `"preferenceFile"` at the end of the startup block:
```json
  "startup": {
    "panelRunsOn": "Panel läuft auf:",
    "noPortAvailable": "⚠ Kein Port verfügbar (8080–8089). Port manuell eingeben und Enter drücken.",
    "waitingForConnection": "Warte auf Verbindung…",
    "noHostsConfigured": "Keine Hosts konfiguriert",
    "openInApp": "Open in App",
    "openInBrowser": "Open in Browser",
    "hide": "Hide",
    "quit": "Quit",
    "apply": "Apply",
    "loadPreferenceFile": "Preference File laden…",
    "preferenceFile": "Preference File"
  },
```

- [ ] **Step 10.2 — Add i18n string to en.json**

In `packages/shared/locales/en.json`, make the same change to the `"startup"` block:
```json
    "apply": "Apply",
    "loadPreferenceFile": "Load Preference File…",
    "preferenceFile": "Preference File"
```

- [ ] **Step 10.3 — Expose new strings in get-i18n-strings IPC handler**

In `packages/electron/src/main.ts`, find the `get-i18n-strings` handler:
```typescript
  ipcMain.handle('get-i18n-strings', () => ({
    panelRunsOn:          t('startup.panelRunsOn'),
    ...
    apply:                t('startup.apply'),
  }))
```

Add two new lines before the closing `})`:
```typescript
    loadPreferenceFile:   t('startup.loadPreferenceFile'),
    preferenceFile:       t('startup.preferenceFile'),
```

- [ ] **Step 10.4 — Increase startup window height**

In `packages/electron/src/startupWindow.ts`, find line 35:
```typescript
      height: 240,
```

Change to:
```typescript
      height: 270,
```

- [ ] **Step 10.5 — Add preference file row to startup.html**

In `packages/electron/renderer/startup.html`:

**CSS:** After the `.port-auto-badge` block (around line 100), add:

```css
    /* Preference-File-Zeile */
    .preffile-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .preffile-label {
      font-size: 11px;
      color: #4a5568;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .preffile-name {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #8896aa;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
```

**HTML:** After the port-row `<div>` and before the error-banner `<div>`, add:

```html
    <!-- Preference-File-Zeile -->
    <div class="preffile-row">
      <span class="preffile-label" id="prefFileLabel">…</span>
      <span class="preffile-name" id="prefFileName">…</span>
      <button class="port-apply" id="btnLoadPref">…</button>
    </div>
```

**JavaScript:** In the `api.getI18nStrings().then(...)` callback, add after the existing string assignments:

```javascript
      document.getElementById('prefFileLabel').textContent = s.preferenceFile + ':'
      document.getElementById('btnLoadPref').textContent = s.loadPreferenceFile
      window._i18n = s
```

After the port-change JavaScript block (after the `btnApplyPort` listener), add:

```javascript
    // ─── Preference File ─────────────────────────────────────────────────────

    api.getSettingsPath().then((normalizedPath) => {
      // Nur Dateiname anzeigen — path-Modul nicht verfügbar, daher string-split
      const filename = normalizedPath.replace(/\\/g, '/').split('/').pop() ?? normalizedPath
      document.getElementById('prefFileName').textContent = filename
      document.getElementById('prefFileName').title = normalizedPath
    })

    document.getElementById('btnLoadPref').addEventListener('click', async () => {
      const chosen = await api.chooseSettingsPath()
      if (!chosen) return
      await api.applySettingsPath(chosen)
      // applySettingsPath löst app.relaunch() aus — kein weiterer Code nötig
    })
```

- [ ] **Step 10.6 — TypeScript check**

```bash
npx tsc --noEmit -p packages/electron/tsconfig.json
```

Expected: no errors.

- [ ] **Step 10.7 — Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 10.8 — Commit**

```bash
git add packages/shared/locales/de.json packages/shared/locales/en.json packages/electron/src/main.ts packages/electron/src/startupWindow.ts packages/electron/renderer/startup.html
git commit -m "feat: startup UI — preference file row + i18n + window height 270px"
```

---

## Task 11: Build + manual verification

- [ ] **Step 11.1 — Full frontend build**

```bash
npm run build -w @cwp/frontend
```

Expected: build completes without errors.

- [ ] **Step 11.2 — Electron build**

```bash
cd packages/electron && node build.mjs
```

Expected: build completes without errors.

- [ ] **Step 11.3 — Start Electron and verify Auto-Zoom**

```bash
npm run electron:dev
```

Verify:
1. Zoom flyout öffnen → "Fit"-Button ist neben "100%"-Button sichtbar
2. "Fit" klicken → Button wird blau, Slider wird halbdurchsichtig, Canvas passt sich ans Fenster an
3. Fenster verkleinern → Zoom passt sich automatisch an
4. Ctrl+Scroll → Auto-Zoom schaltet sich aus, Zoom-Wert bleibt an der aktuellen Position
5. Panel wechseln → jedes Panel behält seinen eigenen autoZoom-State

- [ ] **Step 11.4 — Verify Custom Settings Path in startup window**

1. Startup-Fenster öffnen (Tray → Show Window)
2. "Preference File"-Zeile ist sichtbar, zeigt `companionwebpanel.json` (oder `settings.json` bei Upgrade)
3. "Load Preference File…" klicken → Datei-Dialog öffnet im aktuellen Settings-Ordner
4. Eine `.json`-Datei auswählen → App startet neu, Startup-Fenster zeigt neuen Dateinamen

- [ ] **Step 11.5 — Verify backwards compatibility**

In einem frischen `userData`-Ordner mit bestehender `settings.json` testen:
1. App starten
2. Settings werden aus `settings.json` geladen (kein Datenverlust)
3. Startup-Fenster zeigt `settings.json` als aktiven Dateinamen

- [ ] **Step 11.6 — Final commit**

```bash
git add -A
git commit -m "feat: v1.7.0 — Auto-Zoom per Panel + Custom Settings Path (companionwebpanel.json default)"
```

---

## Self-Review Checklist

- [x] Schema bump in 6 Pflichtdateien (CLAUDE.md Gotcha)
- [x] `makeSettings()` in Test-Fixture auf `version: '1.7.0'` aktualisiert
- [x] `setAutoZoom` Signatur in Interface + Implementierung konsistent
- [x] `loadSettingsFile` / `saveSettingsFile` in allen Callers korrekt verwendet
- [x] Backwards-Compat: `settings.json` bei Upgrade erhalten (kein Rename)
- [x] `normalizePath`/`expandPath` Round-Trip getestet
- [x] `app.relaunch()` + `app.quit()` — korrekte Reihenfolge (relaunch vor quit)
- [x] ResizeObserver cleanup via `disconnect()` im useEffect-Return
- [x] Debounce in ResizeObserver mit `clearTimeout` im Cleanup
- [x] Ctrl+Scroll deaktiviert autoZoom — `setAutoZoom` im Dependency-Array des useEffect
- [x] `path.basename` ersetzt durch string-split (kein Node.js in startup.html Renderer)
- [x] i18n-Strings in de.json + en.json + IPC `get-i18n-strings` Handler alle konsistent

# Electron Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the Companion Webpanel backend in an Electron app with a startup window, system tray, configurable ports, and auto port-fallback.

**Architecture:** Electron main process imports and runs backend modules directly (same Node.js process, no child process). A small BrowserWindow (~400×240px) shows on startup (port info + 2 buttons), then hides to system tray. The frontend PWA is served by the backend HTTP server and accessed via browser/tablet. esbuild bundles the electron main + backend into a single `dist/main.js` for packaging.

**Tech Stack:** Electron 33, electron-builder 25, esbuild, TypeScript, vitest, existing `@cwp/backend` + `@cwp/shared` workspaces.

---

## File Map

**New files:**
- `packages/electron/src/types.ts` — AppStatus interface (IPC payload)
- `packages/electron/src/portCheck.ts` — isPortFree() + findFreePort()
- `packages/electron/src/settingsHelper.ts` — load/save/default settings from user data dir
- `packages/electron/src/preload.ts` — contextBridge: exposes cwpApi to renderer
- `packages/electron/src/startupWindow.ts` — BrowserWindow lifecycle (show/hide)
- `packages/electron/src/tray.ts` — Tray icon + context menu, status-aware icon
- `packages/electron/src/main.ts` — Electron entry: boot sequence + IPC handlers
- `packages/electron/renderer/startup.html` — Startup window UI (inline CSS/JS)
- `packages/electron/build.mjs` — esbuild script for bundling
- `packages/electron/tsconfig.json`
- `packages/electron/package.json`
- `electron-builder.yml` (root)
- `packages/electron/tests/portCheck.test.ts`
- `packages/electron/tests/settingsHelper.test.ts`
- `packages/electron/assets/README.md` — icon placeholder instructions

**Modified files:**
- `packages/shared/src/types.ts` — Settings: add `server?: { port: number }`, version union
- `CompanionWebpannelSettings.schema.json` — v1.3.0 + server block
- `CompanionWebpannelSettings.json` — add `"server": { "port": 8080 }`
- `packages/backend/src/server/ClientServer.ts` — optional `staticDir` param → serve frontend HTML/JS/CSS
- `packages/backend/src/HostManager.ts` — add `onStatusChange` callback to constructor
- `packages/backend/src/index.ts` — export `createBackend()` factory + accept `staticDir`; fix version check for 1.3.0; keep `main()` for standalone
- `package.json` (root) — add electron workspace, build:electron + release scripts, electron-builder devDep

---

## Task 1: Settings v1.3.0 — add server.port

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `CompanionWebpannelSettings.schema.json`
- Modify: `CompanionWebpannelSettings.json`
- Modify: `packages/backend/src/index.ts` (version check update)

- [ ] **Step 1: Update Settings type**

In `packages/shared/src/types.ts`, change the Settings interface (lines 3–8):

```typescript
export interface Settings {
  version: '1.2.0' | '1.3.0'
  server?: { port: number }   // Backend HTTP/WS port (default: 8080)
  activeHostId: string
  hosts: HostProfile[]
  panels: Panel[]
}
```

- [ ] **Step 2: Update backend version check**

In `packages/backend/src/index.ts`, update the version check in `loadSettings()`:

```typescript
if (settings.version !== '1.2.0' && settings.version !== '1.3.0') {
  console.warn(`[Boot] Unbekannte Settings-Version: ${settings.version} (erwartet: 1.2.0 oder 1.3.0)`)
}
```

Also fix the version validation in `packages/backend/src/server/ClientServer.ts` (line ~94):

```typescript
// Alt:
if (incoming.version !== '1.2.0') {
// Neu:
if (incoming.version !== '1.2.0' && incoming.version !== '1.3.0') {
```

- [ ] **Step 3: Update schema JSON**

In `CompanionWebpannelSettings.schema.json`, change the top-level `version` enum and add `server` to `properties`:

Change:
```json
"version": { "type": "string", "enum": ["1.2.0"] }
```
To:
```json
"version": { "type": "string", "enum": ["1.2.0", "1.3.0"] }
```

Add to `properties` (before `"activeHostId"`):
```json
"server": {
  "type": "object",
  "properties": {
    "port": { "type": "integer", "minimum": 1024, "maximum": 65535, "default": 8080 }
  },
  "required": ["port"],
  "additionalProperties": false
},
```

- [ ] **Step 4: Update example settings file**

In `CompanionWebpannelSettings.json`, change `"version"` and add `"server"`:

```json
{
  "version": "1.3.0",
  "server": { "port": 8080 },
  "activeHostId": "LiveStudio-PC1",
  ...
}
```

- [ ] **Step 5: Rebuild shared + verify backend compiles**

```bash
npm run build -w @cwp/shared && npm run build -w @cwp/backend
```

Expected: both compile with no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types.ts CompanionWebpannelSettings.schema.json CompanionWebpannelSettings.json packages/backend/src/index.ts
git commit -m "feat: settings v1.3.0 — add server.port"
```

---

## Task 1.5: ClientServer — static file serving (für pakettierten Build)

**Files:**
- Modify: `packages/backend/src/server/ClientServer.ts`

Der ClientServer serviert aktuell nur `/api/*`-Routen und sendet 404 für alles andere.
Im pakettierten Electron-Build muss er das Frontend (HTML/JS/CSS) ausliefern —
sonst kann `localhost:8080` keine Webseite laden.

Im Dev-Betrieb (Vite läuft auf :5173) bleibt alles wie bisher — `staticDir` ist dann `undefined`.

- [ ] **Step 1: Add staticDir parameter to ClientServer constructor**

In `packages/backend/src/server/ClientServer.ts`, add `staticDir?: string` to constructor:

```typescript
// Neue private Felder (nach settingsPath, Zeile ~52):
private staticDir?: string

// Konstruktor-Signatur erweitern:
constructor(
  port: number,
  settings: Settings,
  settingsPath: string,
  onPress: PressHandler,
  onSettingsUpdate?: (s: Settings) => void,
  onPreviewPageAdd?: PreviewPageHandler,
  onPreviewPageRemove?: PreviewPageRemoveHandler,
  staticDir?: string,            // ← neu
) {
  // ... bestehende Zuweisungen ...
  this.staticDir = staticDir
```

- [ ] **Step 2: Replace 404-Fallback mit Static-File-Handler**

Ersetze den bestehenden `else`-Block (Zeile ~155–158) in `ClientServer.ts`:

```typescript
} else {
  // Static file serving (für pakettierten Electron-Build)
  if (this.staticDir && req.method === 'GET') {
    this.serveStatic(req.url ?? '/', res)
  } else {
    res.writeHead(404)
    res.end()
  }
}
```

- [ ] **Step 3: Add serveStatic() private method**

Füge am Ende der Klasse (vor der letzten `}`) hinzu:

```typescript
/**
 * Serviert statische Dateien aus this.staticDir.
 * Fallback: index.html für SPA-Routing (alle nicht-gefundenen Pfade → index.html).
 */
private serveStatic(urlPath: string, res: http.ServerResponse): void {
  const staticDir = this.staticDir!
  // URL-Pfad normalisieren (query-string entfernen, path-traversal verhindern)
  const safePath = urlPath.split('?')[0].replace(/\.\./g, '')
  const filePath = safePath === '/' || safePath === ''
    ? path.join(staticDir, 'index.html')
    : path.join(staticDir, safePath)

  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.png':  'image/png',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.json': 'application/json',
    '.woff2': 'font/woff2',
    '.woff':  'font/woff',
  }

  const ext = path.extname(filePath)
  const mime = mimeTypes[ext] ?? 'application/octet-stream'

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { 'Content-Type': mime })
    fs.createReadStream(filePath).pipe(res)
  } else {
    // SPA-Fallback: index.html für alle unbekannten Pfade
    const indexPath = path.join(staticDir, 'index.html')
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      fs.createReadStream(indexPath).pipe(res)
    } else {
      res.writeHead(404)
      res.end()
    }
  }
}
```

Außerdem `path` importieren (falls noch nicht vorhanden) am Anfang von ClientServer.ts:

```typescript
import * as path from 'path'
```

- [ ] **Step 4: Update createBackend() in index.ts to accept staticDir**

In Task 2 wird `createBackend()` exportiert. Dort muss `staticDir` durchgereicht werden:

```typescript
export async function createBackend(
  settings: Settings,
  port: number,
  settingsPath: string,
  onStatusChange?: (hostId: string, status: string) => void,
  staticDir?: string,            // ← neu
): Promise<{ stop: () => Promise<void> }> {
  // ...
  const clientServer = new ClientServer(
    port, settings, settingsPath,
    ...,
    staticDir,                   // ← als letztes Argument
  )
```

- [ ] **Step 5: Build backend**

```bash
npm run build -w @cwp/backend
```

Expected: keine Fehler.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/server/ClientServer.ts
git commit -m "feat: ClientServer — optional staticDir für Frontend-Serving im Electron-Build"
```

---

## Task 2: HostManager status callback + createBackend() export

**Files:**
- Modify: `packages/backend/src/HostManager.ts`
- Modify: `packages/backend/src/index.ts`

- [ ] **Step 1: Add onStatusChange callback to HostManager**

In `packages/backend/src/HostManager.ts`, modify the constructor signature and `createClient` method:

```typescript
// Add private field after clientServer:
private onStatusChange?: (hostId: string, status: ClientStatus) => void

// Change constructor signature (line ~39):
constructor(
  store: StateStore,
  clientServer: ClientServer,
  onStatusChange?: (hostId: string, status: ClientStatus) => void
) {
  this.store = store
  this.clientServer = clientServer
  this.onStatusChange = onStatusChange
  clientServer.onNewClient((ws) => this.sendAllSnapshotsToClient(ws))
}
```

In `createClient`, extend the existing `client.on('status', ...)` handler:

```typescript
client.on('status', (status: ClientStatus) => {
  this.clientServer.broadcast({ t: 'sessionStatus', hostId, status })
  this.onStatusChange?.(hostId, status)   // ← add this line
})
```

- [ ] **Step 2: Export createBackend() from backend/index.ts**

Add this export to `packages/backend/src/index.ts` (after the imports, before `const SETTINGS_PATH`):

```typescript
/**
 * createBackend — Factory für Electron und Tests.
 * Startet Backend ohne process.exit() und ohne SIGINT/SIGTERM-Handler.
 * Gibt ein Objekt zurück mit stop() für graceful shutdown.
 */
export async function createBackend(
  settings: Settings,
  port: number,
  settingsPath: string,
  onStatusChange?: (hostId: string, status: string) => void
): Promise<{ stop: () => Promise<void> }> {
  const store = new StateStore()
  let manager: HostManager

  const clientServer = new ClientServer(
    port,
    settings,
    settingsPath,
    (hostId, page, row, col, pressed) => manager.handlePress(hostId, page, row, col, pressed),
    (updatedSettings) => manager.syncSubscriptions(updatedSettings),
    (hostId, page, keysPerRow, rows) => manager.addPickerSubscriptions(hostId, page, keysPerRow, rows),
    (hostId, page) => manager.removePickerSubscriptions(hostId, page),
  )

  manager = new HostManager(store, clientServer, onStatusChange)
  manager.start(settings)

  return {
    stop: async () => {
      await manager.stop()
      await clientServer.close()
    },
  }
}
```

- [ ] **Step 3: Rebuild backend**

```bash
npm run build -w @cwp/backend
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/HostManager.ts packages/backend/src/index.ts
git commit -m "feat: backend — createBackend() factory + HostManager status callback"
```

---

## Task 3: Electron package scaffolding

**Files:**
- Create: `packages/electron/package.json`
- Create: `packages/electron/tsconfig.json`
- Create: `packages/electron/build.mjs`
- Create: `packages/electron/assets/README.md`
- Modify: `package.json` (root)

- [ ] **Step 1: Create packages/electron/package.json**

```json
{
  "name": "@cwp/electron",
  "version": "1.0.0",
  "private": true,
  "main": "dist/main.js",
  "scripts": {
    "dev": "npm run build && electron .",
    "build": "node build.mjs",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "electron": "^33.0.0",
    "esbuild": "^0.21.0",
    "typescript": "^5.4.5",
    "vitest": "^4.1.2"
  }
}
```

- [ ] **Step 2: Create packages/electron/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@cwp/shared": ["../shared/src"],
      "@cwp/backend": ["../backend/src"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create packages/electron/build.mjs**

```js
// build.mjs — esbuild bundler für Electron main + preload
// Kopiert auch das fertig gebaute Frontend in dist/frontend/
import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')

const sharedConfig = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  external: ['electron'],  // electron ist immer extern (vom Runtime geliefert)
  sourcemap: true,
}

// Main process bundle (enthält backend-Code direkt)
await esbuild.build({
  ...sharedConfig,
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  // @cwp/* über relative Pfade auflösen
  alias: {
    '@cwp/shared': path.join(root, 'packages/shared/src/index.ts'),
    '@cwp/backend': path.join(root, 'packages/backend/src/index.ts'),
  },
})

// Preload script (separates Bundle, kein Zugriff auf Backend-Code)
await esbuild.build({
  ...sharedConfig,
  entryPoints: ['src/preload.ts'],
  outfile: 'dist/preload.js',
})

// Frontend dist in packages/electron/frontend/ kopieren (für Packaging)
const frontendSrc = path.join(root, 'packages/frontend/dist')
const frontendDst = path.join(__dirname, 'frontend')

if (fs.existsSync(frontendSrc)) {
  fs.rmSync(frontendDst, { recursive: true, force: true })
  fs.cpSync(frontendSrc, frontendDst, { recursive: true })
  console.log('Frontend dist kopiert → packages/electron/frontend/')
} else {
  console.warn('WARNUNG: packages/frontend/dist nicht gefunden — zuerst npm run build -w @cwp/frontend ausführen')
}

console.log('Electron build complete.')
```

- [ ] **Step 4: Create assets placeholder README**

Create `packages/electron/assets/README.md`:

```markdown
# Tray Icons

Benötigte Dateien (PNG, 16×16 und 32×32 für HiDPI):

- `tray-connected.png`  — grüner Punkt (alle Hosts verbunden)
- `tray-partial.png`    — orangener Punkt (mindestens 1 Host nicht verbunden)
- `tray-error.png`      — roter Punkt (alle Hosts disconnected/error)
- `icon.ico`            — App-Icon für Windows (256×256 empfohlen)
- `icon.icns`           — App-Icon für macOS

Für Entwicklung: Platzhalter-PNGs mit einem beliebigen 16×16-Bild benennen.
Online-Generatoren: https://icon.kitchen oder https://www.icoconverter.com
```

- [ ] **Step 5: Add electron workspace + scripts to root package.json**

In `package.json` (root), update:

```json
{
  "name": "companion-webpanel",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "concurrently -n backend,frontend -c cyan,magenta \"npm run dev -w @cwp/backend\" \"npm run dev -w @cwp/frontend\"",
    "build": "npm run build -w @cwp/shared && npm run build -w @cwp/backend && npm run build -w @cwp/frontend",
    "build:electron": "npm run build && npm run build -w @cwp/electron",
    "electron:dev": "npm run build:electron && electron packages/electron",
    "release": "npm run build:electron && electron-builder --config electron-builder.yml"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "electron-builder": "^25.0.0",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 6: Install dependencies**

```bash
npm install
```

Expected: `node_modules/@cwp/electron` symlink erscheint, electron + esbuild installiert.

- [ ] **Step 7: Commit**

```bash
git add packages/electron/ package.json package-lock.json
git commit -m "feat: electron package scaffolding (package.json, tsconfig, build script)"
```

---

## Task 4: portCheck.ts (TDD)

**Files:**
- Create: `packages/electron/src/portCheck.ts`
- Create: `packages/electron/tests/portCheck.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/electron/tests/portCheck.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import * as net from 'net'
import { isPortFree, findFreePort } from '../src/portCheck'

// Hilfsfunktion: Server auf Port binden und Promise zurückgeben
function bindServer(port: number): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.once('error', reject)
    s.listen(port, '127.0.0.1', () => resolve(s))
  })
}

function closeServer(s: net.Server): Promise<void> {
  return new Promise((resolve) => s.close(() => resolve()))
}

describe('isPortFree', () => {
  it('returns true for a free port', async () => {
    const result = await isPortFree(19990)
    expect(result).toBe(true)
  })

  it('returns false for a busy port', async () => {
    const s = await bindServer(19991)
    try {
      const result = await isPortFree(19991)
      expect(result).toBe(false)
    } finally {
      await closeServer(s)
    }
  })
})

describe('findFreePort', () => {
  it('returns the start port when it is free', async () => {
    const port = await findFreePort(19992)
    expect(port).toBe(19992)
  })

  it('skips busy ports and returns next free one', async () => {
    const s = await bindServer(19993)
    try {
      const port = await findFreePort(19993)
      expect(port).toBe(19994)
    } finally {
      await closeServer(s)
    }
  })

  it('returns null when all ports in range are busy', async () => {
    const servers: net.Server[] = []
    for (let i = 0; i < 5; i++) {
      servers.push(await bindServer(19970 + i))
    }
    try {
      const port = await findFreePort(19970, 5)
      expect(port).toBeNull()
    } finally {
      await Promise.all(servers.map(closeServer))
    }
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run --project packages/electron 2>&1 | head -20
```

Expected: `Cannot find module '../src/portCheck'`

- [ ] **Step 3: Implement portCheck.ts**

Create `packages/electron/src/portCheck.ts`:

```typescript
/**
 * portCheck.ts — Port-Verfügbarkeit prüfen
 *
 * Testet ob ein TCP-Port frei ist und sucht ggf. den nächsten freien Port.
 * Reine Node.js-Logik (kein Electron) — vollständig testbar.
 */
import * as net from 'net'

/**
 * Prüft ob ein Port auf 127.0.0.1 frei ist.
 * Versucht kurz zu binden — gibt true zurück wenn erfolgreich.
 */
export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '127.0.0.1')
  })
}

/**
 * Sucht den ersten freien Port ab startPort.
 * Gibt null zurück wenn in maxAttempts keine freier Port gefunden wurde.
 */
export async function findFreePort(
  startPort: number,
  maxAttempts = 10
): Promise<number | null> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isPortFree(startPort + i)) return startPort + i
  }
  return null
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd packages/electron && npx vitest run
```

Expected:
```
✓ portCheck.test.ts (5 tests)
Test Files  1 passed
```

- [ ] **Step 5: Commit**

```bash
git add packages/electron/src/portCheck.ts packages/electron/tests/portCheck.test.ts
git commit -m "feat: portCheck — isPortFree + findFreePort (TDD)"
```

---

## Task 5: settingsHelper.ts (TDD)

**Files:**
- Create: `packages/electron/src/settingsHelper.ts`
- Create: `packages/electron/tests/settingsHelper.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/electron/tests/settingsHelper.test.ts`:

```typescript
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
    // Datei sollte jetzt existieren
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
    const p = getSettingsPath('/some/dir')
    expect(p).toBe('/some/dir/settings.json')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd packages/electron && npx vitest run
```

Expected: `Cannot find module '../src/settingsHelper'`

- [ ] **Step 3: Implement settingsHelper.ts**

Create `packages/electron/src/settingsHelper.ts`:

```typescript
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
    version: '1.3.0',
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

  // Migration: v1.2.0 hat keinen server-Block
  if (!settings.server) {
    settings.server = { port: 8080 }
    settings.version = '1.3.0'
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd packages/electron && npx vitest run
```

Expected:
```
✓ portCheck.test.ts (5 tests)
✓ settingsHelper.test.ts (6 tests)
Test Files  2 passed
```

- [ ] **Step 5: Commit**

```bash
git add packages/electron/src/settingsHelper.ts packages/electron/tests/settingsHelper.test.ts
git commit -m "feat: settingsHelper — load/save/migrate settings (TDD)"
```

---

## Task 6: AppStatus type

**Files:**
- Create: `packages/electron/src/types.ts`

- [ ] **Step 1: Create types.ts**

Create `packages/electron/src/types.ts`:

```typescript
/**
 * types.ts — Electron-interne Typen
 *
 * AppStatus: IPC-Payload vom Main Process an den Startup-Renderer.
 * Wird über contextBridge als window.cwpApi.getStatus() zurückgegeben
 * und als 'status-update' Event gepusht.
 */

export interface HostStatus {
  id: string
  name: string
  status: 'connecting' | 'connected' | 'stale' | 'error'
}

export interface AppStatus {
  /** Tatsächlich verwendeter Port (kann vom konfigurierten abweichen) */
  port: number
  /** true wenn Port automatisch gewählt wurde (konfigurierter war belegt) */
  portAuto: boolean
  /** Status pro Host */
  hosts: HostStatus[]
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/electron/src/types.ts
git commit -m "feat: electron types — AppStatus + HostStatus IPC payload"
```

---

## Task 7: startup.html — Renderer UI

**Files:**
- Create: `packages/electron/renderer/startup.html`

- [ ] **Step 1: Create startup.html**

Create `packages/electron/renderer/startup.html`:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Companion Webpanel</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0f141a;
      color: #e9edf2;
      height: 100vh;
      display: flex;
      flex-direction: column;
      user-select: none;
      overflow: hidden;
    }

    /* Drag-Handle: obere Leiste (kein nativer Rahmen) */
    .titlebar {
      -webkit-app-region: drag;
      background: #121821;
      padding: 12px 16px 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #2a3344;
    }

    .titlebar-icon { font-size: 18px; }

    .titlebar-title {
      font-size: 14px;
      font-weight: 600;
      color: #e9edf2;
    }

    .titlebar-version {
      font-size: 11px;
      color: #4a5568;
      margin-left: auto;
      font-family: 'JetBrains Mono', monospace;
      -webkit-app-region: no-drag;
    }

    .content {
      flex: 1;
      padding: 20px 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Port-Zeile */
    .port-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .port-label {
      font-size: 12px;
      color: #8896aa;
      white-space: nowrap;
    }

    .port-url {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: #4a9eff;
    }

    .port-input {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      width: 60px;
      background: #1a2030;
      border: 1px solid #2a3344;
      border-radius: 4px;
      color: #e9edf2;
      padding: 3px 6px;
      outline: none;
    }

    .port-input:focus { border-color: #4a9eff; }

    .port-auto-badge {
      font-size: 10px;
      background: #ff8a3d22;
      color: #ff8a3d;
      border: 1px solid #ff8a3d44;
      border-radius: 3px;
      padding: 1px 5px;
    }

    /* Fehler-Banner */
    .error-banner {
      display: none;
      background: #ff5a5f22;
      border: 1px solid #ff5a5f44;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      color: #ff5a5f;
    }

    /* Host-Status-Liste */
    .hosts {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .host-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }

    .host-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .dot-connecting { background: #ff8a3d; animation: pulse 1.2s ease-in-out infinite; }
    .dot-connected  { background: #21d07a; }
    .dot-stale      { background: #ff8a3d; }
    .dot-error      { background: #ff5a5f; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    .host-name { color: #8896aa; }

    .host-status-text {
      margin-left: auto;
      font-size: 11px;
      color: #4a5568;
    }

    /* Buttons */
    .actions {
      display: flex;
      gap: 8px;
      margin-top: auto;
    }

    button {
      flex: 1;
      padding: 9px 12px;
      border-radius: 6px;
      border: none;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 0.15s;
    }

    button:hover { opacity: 0.85; }

    .btn-primary {
      background: #4a9eff;
      color: #0f141a;
    }

    .btn-secondary {
      background: #1a2030;
      color: #8896aa;
      border: 1px solid #2a3344;
    }

    /* Kein-Host-Hinweis */
    .no-hosts {
      font-size: 12px;
      color: #4a5568;
      text-align: center;
      padding: 8px 0;
    }
  </style>
</head>
<body>
  <div class="titlebar">
    <span class="titlebar-icon">🎛</span>
    <span class="titlebar-title">Companion Webpanel</span>
    <span class="titlebar-version" id="version">v1.0.0</span>
  </div>

  <div class="content">
    <!-- Port-Zeile -->
    <div class="port-row">
      <span class="port-label">Panel läuft auf:</span>
      <span class="port-url">http://localhost:</span>
      <input
        class="port-input"
        id="portInput"
        type="number"
        min="1024"
        max="65535"
        value="8080"
        title="Port ändern und Enter drücken"
      />
      <span class="port-auto-badge" id="autoBadge" style="display:none">auto</span>
    </div>

    <!-- Fehler-Banner (nur sichtbar wenn kein Port gefunden) -->
    <div class="error-banner" id="errorBanner">
      ⚠ Kein Port verfügbar (8080–8089). Port manuell eingeben und Enter drücken.
    </div>

    <!-- Host-Status -->
    <div class="hosts" id="hosts">
      <div class="no-hosts">Warte auf Verbindung…</div>
    </div>

    <!-- Aktions-Buttons -->
    <div class="actions">
      <button class="btn-primary" id="btnOpen">Open Panel</button>
      <button class="btn-secondary" id="btnQuit">Quit</button>
    </div>
  </div>

  <script>
    const api = window.cwpApi

    // ─── Status rendern ──────────────────────────────────────────────────────

    function renderStatus(status) {
      // Port
      document.getElementById('portInput').value = status.port
      const autoBadge = document.getElementById('autoBadge')
      autoBadge.style.display = status.portAuto ? 'inline' : 'none'

      // Fehler-Banner (port === 0 = kein Port gefunden)
      const errorBanner = document.getElementById('errorBanner')
      errorBanner.style.display = status.port === 0 ? 'block' : 'none'

      // Hosts
      const hostsEl = document.getElementById('hosts')
      if (!status.hosts || status.hosts.length === 0) {
        hostsEl.innerHTML = '<div class="no-hosts">Keine Hosts konfiguriert</div>'
        return
      }

      hostsEl.innerHTML = status.hosts.map(h => `
        <div class="host-row">
          <div class="host-dot dot-${h.status}"></div>
          <span class="host-name">${h.name || h.id}</span>
          <span class="host-status-text">${h.status}</span>
        </div>
      `).join('')
    }

    // ─── Init ────────────────────────────────────────────────────────────────

    api.getStatus().then(renderStatus)

    api.onStatusUpdate(renderStatus)

    // ─── Port-Änderung ───────────────────────────────────────────────────────

    const portInput = document.getElementById('portInput')
    portInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      const port = parseInt(portInput.value, 10)
      if (isNaN(port) || port < 1024 || port > 65535) return
      api.changePort(port)
    })

    // ─── Buttons ─────────────────────────────────────────────────────────────

    document.getElementById('btnOpen').addEventListener('click', () => api.openPanel())
    document.getElementById('btnQuit').addEventListener('click', () => api.quit())
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add packages/electron/renderer/startup.html
git commit -m "feat: startup window HTML — port display, host status, open/quit buttons"
```

---

## Task 8: preload.ts — contextBridge

**Files:**
- Create: `packages/electron/src/preload.ts`

- [ ] **Step 1: Create preload.ts**

Create `packages/electron/src/preload.ts`:

```typescript
/**
 * preload.ts — Electron Preload Script
 *
 * Stellt window.cwpApi im Startup-Renderer bereit (contextBridge).
 * Läuft in einem isolierten Kontext — kein direkter Node.js-Zugriff aus dem Renderer.
 *
 * Exposes:
 *   getStatus()          → AppStatus (einmalig beim Laden)
 *   onStatusUpdate(cb)   → registriert einen Listener für Push-Updates
 *   changePort(port)     → fordert Port-Änderung + Neustart an
 *   openPanel()          → öffnet localhost:<port> im Default-Browser
 *   quit()               → graceful shutdown
 */
import { contextBridge, ipcRenderer } from 'electron'
import type { AppStatus } from './types'

contextBridge.exposeInMainWorld('cwpApi', {
  getStatus: (): Promise<AppStatus> =>
    ipcRenderer.invoke('get-status'),

  onStatusUpdate: (cb: (status: AppStatus) => void): void => {
    ipcRenderer.on('status-update', (_event, status: AppStatus) => cb(status))
  },

  changePort: (port: number): Promise<void> =>
    ipcRenderer.invoke('change-port', port),

  openPanel: (): Promise<void> =>
    ipcRenderer.invoke('open-panel'),

  quit: (): void => {
    ipcRenderer.send('quit')
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add packages/electron/src/preload.ts
git commit -m "feat: preload — contextBridge cwpApi (get-status, open-panel, change-port, quit)"
```

---

## Task 9: startupWindow.ts

**Files:**
- Create: `packages/electron/src/startupWindow.ts`

- [ ] **Step 1: Create startupWindow.ts**

Create `packages/electron/src/startupWindow.ts`:

```typescript
/**
 * startupWindow.ts — Startup-Fenster Management
 *
 * Kleines Fenster (400×240px) das beim Start erscheint, Port + Host-Status zeigt,
 * und sich versteckt wenn der User "Open Panel" klickt oder das Fenster schließt.
 * Kann über show() wieder eingeblendet werden (z.B. aus dem Tray-Menü).
 */
import { BrowserWindow, ipcMain, app } from 'electron'
import * as path from 'path'
import type { AppStatus } from './types'

export class StartupWindow {
  private win: BrowserWindow | null = null
  private preloadPath: string
  private htmlPath: string

  constructor() {
    // Pfade relativ zur kompilierten dist/main.js
    this.preloadPath = path.join(__dirname, 'preload.js')
    this.htmlPath = path.join(__dirname, '..', 'renderer', 'startup.html')
  }

  /** Erstellt und zeigt das Startup-Fenster. */
  create(): void {
    if (this.win) {
      this.win.show()
      this.win.focus()
      return
    }

    this.win = new BrowserWindow({
      width: 400,
      height: 240,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      frame: false,         // Kein nativer Rahmen (wir haben eigene Titelleiste)
      titleBarStyle: 'hidden',
      backgroundColor: '#0f141a',
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    this.win.loadFile(this.htmlPath)

    // Fenster schließen → nur verstecken, nicht beenden
    this.win.on('close', (e) => {
      e.preventDefault()
      this.win?.hide()
    })

    // Aufräumen wenn Fenster zerstört wird (z.B. beim App-Quit)
    this.win.on('closed', () => {
      this.win = null
    })
  }

  /** Zeigt das Fenster (falls versteckt). */
  show(): void {
    if (this.win) {
      this.win.show()
      this.win.focus()
    } else {
      this.create()
    }
  }

  /** Versteckt das Fenster (nicht zerstören). */
  hide(): void {
    this.win?.hide()
  }

  /**
   * Sendet einen Status-Update an den Renderer.
   * Wird aufgerufen wenn sich Port oder Host-Status ändert.
   */
  sendStatusUpdate(status: AppStatus): void {
    if (this.win?.webContents && !this.win.webContents.isDestroyed()) {
      this.win.webContents.send('status-update', status)
    }
  }

  /** Zerstört das Fenster (nur beim echten App-Quit). */
  destroy(): void {
    if (this.win) {
      this.win.removeAllListeners('close')
      this.win.destroy()
      this.win = null
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/electron/src/startupWindow.ts
git commit -m "feat: startupWindow — BrowserWindow lifecycle (create/show/hide/sendStatus)"
```

---

## Task 10: tray.ts

**Files:**
- Create: `packages/electron/src/tray.ts`

- [ ] **Step 1: Create tray.ts**

Create `packages/electron/src/tray.ts`:

```typescript
/**
 * tray.ts — System-Tray Management
 *
 * Erstellt ein Tray-Icon mit Kontextmenü.
 * Icon wechselt je nach Host-Verbindungsstatus:
 *   Alle connected  → tray-connected.png (grün)
 *   Mind. 1 error   → tray-partial.png   (orange)
 *   Alle error      → tray-error.png     (rot)
 *
 * Menü-Einträge: Open Panel, Open Settings, [Host-Status-Liste], Show Window, Quit.
 */
import { Tray, Menu, shell, nativeImage } from 'electron'
import * as path from 'path'
import type { AppStatus, HostStatus } from './types'

export class AppTray {
  private tray: Tray | null = null
  private currentStatus: AppStatus = { port: 8080, portAuto: false, hosts: [] }
  private onShowWindow: () => void
  private onQuit: () => void
  private assetsPath: string

  constructor(onShowWindow: () => void, onQuit: () => void) {
    this.onShowWindow = onShowWindow
    this.onQuit = onQuit
    this.assetsPath = path.join(__dirname, '..', 'assets')
  }

  /** Erstellt das Tray-Icon. Muss nach app.whenReady() aufgerufen werden. */
  create(): void {
    const icon = this.getIcon(this.currentStatus)
    this.tray = new Tray(icon)
    this.tray.setToolTip('Companion Webpanel')
    this.rebuildMenu()

    // Doppelklick auf Tray-Icon → Fenster zeigen (Windows/Linux)
    this.tray.on('double-click', () => this.onShowWindow())
  }

  /** Aktualisiert Status und baut Menü neu. */
  updateStatus(status: AppStatus): void {
    this.currentStatus = status
    if (this.tray) {
      this.tray.setImage(this.getIcon(status))
      this.rebuildMenu()
    }
  }

  /** Zerstört das Tray-Icon. */
  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private rebuildMenu(): void {
    const { port, hosts } = this.currentStatus

    const hostItems = hosts.length > 0
      ? hosts.map((h) => ({
          label: `${this.statusIcon(h.status)} ${h.name || h.id}`,
          enabled: false,
        }))
      : [{ label: 'Keine Hosts konfiguriert', enabled: false }]

    const menu = Menu.buildFromTemplate([
      {
        label: 'Open Panel',
        click: () => shell.openExternal(`http://localhost:${port}`),
      },
      {
        label: 'Open Settings',
        click: () => shell.openExternal(`http://localhost:${port}/#settings`),
      },
      { type: 'separator' },
      ...hostItems,
      { type: 'separator' },
      {
        label: 'Show Window',
        click: () => this.onShowWindow(),
      },
      {
        label: 'Quit',
        click: () => this.onQuit(),
      },
    ])

    this.tray?.setContextMenu(menu)
  }

  private getIcon(status: AppStatus): Electron.NativeImage {
    const allConnected = status.hosts.length > 0 &&
      status.hosts.every((h) => h.status === 'connected')
    const allError = status.hosts.length === 0 ||
      status.hosts.every((h) => h.status === 'error')

    let iconFile: string
    if (allConnected) {
      iconFile = 'tray-connected.png'
    } else if (allError) {
      iconFile = 'tray-error.png'
    } else {
      iconFile = 'tray-partial.png'
    }

    const iconPath = path.join(this.assetsPath, iconFile)
    // Fallback auf leeres Icon wenn Datei nicht existiert (z.B. in Dev ohne Assets)
    try {
      return nativeImage.createFromPath(iconPath)
    } catch {
      return nativeImage.createEmpty()
    }
  }

  private statusIcon(status: HostStatus['status']): string {
    switch (status) {
      case 'connected':  return '●'
      case 'connecting': return '◌'
      case 'stale':      return '◑'
      case 'error':      return '○'
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/electron/src/tray.ts
git commit -m "feat: tray — context menu + status-aware icon + host list"
```

---

## Task 11: main.ts — Boot-Sequenz + IPC

**Files:**
- Create: `packages/electron/src/main.ts`

- [ ] **Step 1: Create main.ts**

Create `packages/electron/src/main.ts`:

```typescript
/**
 * main.ts — Electron Entry Point
 *
 * Boot-Sequenz:
 *  1. app.whenReady()
 *  2. Settings laden (aus userData)
 *  3. Freien Port ermitteln (portCheck)
 *  4. Startup-Fenster anzeigen
 *  5. Backend starten (createBackend aus @cwp/backend)
 *  6. Tray anlegen
 *  7. IPC-Handler registrieren
 *  8. app.on('window-all-closed') → nicht beenden (Tray-App)
 */
import { app, ipcMain, shell } from 'electron'
import * as path from 'path'
import { createBackend } from '@cwp/backend'
import { loadSettings, saveSettings, getSettingsPath } from './settingsHelper'
import { findFreePort } from './portCheck'
import { StartupWindow } from './startupWindow'
import { AppTray } from './tray'
import type { AppStatus } from './types'

// Verhindert mehrere App-Instanzen
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

async function main(): Promise<void> {
  await app.whenReady()

  const userDataPath = app.getPath('userData')
  const settings = loadSettings(userDataPath)
  const settingsPath = getSettingsPath(userDataPath)
  const configuredPort = settings.server?.port ?? 8080

  // ─── Port-Check ────────────────────────────────────────────────────────────

  const actualPort = await findFreePort(configuredPort)
  const portAuto = actualPort !== null && actualPort !== configuredPort

  // ─── Status-State ──────────────────────────────────────────────────────────

  const appStatus: AppStatus = {
    port: actualPort ?? 0,
    portAuto,
    hosts: settings.hosts.map((h) => ({
      id: h.id,
      name: h.name,
      status: 'connecting',
    })),
  }

  // ─── Startup-Fenster ───────────────────────────────────────────────────────

  const startupWindow = new StartupWindow()
  startupWindow.create()

  // ─── Backend starten ───────────────────────────────────────────────────────

  let backendInstance: { stop: () => Promise<void> } | null = null

  // Frontend-Static-Dir: im pakettierten Build liegt es neben dist/
  // In dev (npm run dev) ist staticDir undefined → Vite serviert auf :5173
  const staticDir = app.isPackaged
    ? path.join(app.getAppPath(), 'frontend')
    : undefined

  if (actualPort !== null) {
    backendInstance = await createBackend(
      settings,
      actualPort,
      settingsPath,
      (hostId, status) => {
        // Host-Status im appStatus aktualisieren
        const host = appStatus.hosts.find((h) => h.id === hostId)
        if (host) {
          host.status = status as AppStatus['hosts'][0]['status']
          startupWindow.sendStatusUpdate({ ...appStatus })
          tray.updateStatus({ ...appStatus })
        }
      },
      staticDir,
    )
  }

  // ─── Tray ──────────────────────────────────────────────────────────────────

  const tray = new AppTray(
    () => startupWindow.show(),
    () => shutdown()
  )
  tray.create()
  tray.updateStatus(appStatus)
  startupWindow.sendStatusUpdate(appStatus)

  // ─── IPC-Handler ───────────────────────────────────────────────────────────

  ipcMain.handle('get-status', () => appStatus)

  ipcMain.handle('open-panel', () => {
    shell.openExternal(`http://localhost:${appStatus.port}`)
    startupWindow.hide()
  })

  ipcMain.handle('change-port', async (_event, newPort: number) => {
    // Settings updaten
    settings.server = { port: newPort }
    saveSettings(userDataPath, settings)

    // Backend neu starten mit neuem Port
    if (backendInstance) await backendInstance.stop()
    backendInstance = await createBackend(
      settings,
      newPort,
      settingsPath,
      (hostId, status) => {
        const host = appStatus.hosts.find((h) => h.id === hostId)
        if (host) {
          host.status = status as AppStatus['hosts'][0]['status']
          startupWindow.sendStatusUpdate({ ...appStatus })
          tray.updateStatus({ ...appStatus })
        }
      }
    )
    appStatus.port = newPort
    appStatus.portAuto = false
    startupWindow.sendStatusUpdate({ ...appStatus })
    tray.updateStatus({ ...appStatus })
  })

  ipcMain.on('quit', () => shutdown())

  // ─── App-Lifecycle ─────────────────────────────────────────────────────────

  // Tray-App: nicht beenden wenn alle Fenster geschlossen
  app.on('window-all-closed', (e: Event) => e.preventDefault())

  // macOS: Klick auf Dock-Icon → Fenster zeigen
  app.on('activate', () => startupWindow.show())

  // Zweite Instanz → Fenster fokussieren
  app.on('second-instance', () => startupWindow.show())

  // ─── Graceful Shutdown ─────────────────────────────────────────────────────

  let shuttingDown = false

  async function shutdown(): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true

    startupWindow.destroy()
    tray.destroy()

    try {
      await backendInstance?.stop()
    } catch (err) {
      console.error('[Electron] Fehler beim Backend-Stop:', err)
    }

    app.exit(0)
  }

  // process.on('exit') als Fallback für Windows (SIGTERM kommt nicht immer an)
  process.on('exit', () => {
    if (!shuttingDown) backendInstance?.stop().catch(() => {})
  })
}

main().catch((err) => {
  console.error('[Electron] Unbehandelter Fehler:', err)
  app.exit(1)
})
```

- [ ] **Step 2: Build electron package**

```bash
cd packages/electron && npm run build
```

Expected: `dist/main.js` und `dist/preload.js` erstellt, keine Fehler.

- [ ] **Step 3: Run electron in dev**

```bash
cd packages/electron && npx electron .
```

Expected: Startup-Fenster erscheint, Tray-Icon erscheint in Taskleiste. Keine Crashes im Terminal.

- [ ] **Step 4: Commit**

```bash
git add packages/electron/src/main.ts
git commit -m "feat: electron main — boot sequence, IPC handlers, graceful shutdown"
```

---

## Task 12: electron-builder Config + Build Scripts

**Files:**
- Create: `electron-builder.yml` (root)
- Create: `packages/electron/assets/tray-connected.png` (Platzhalter)
- Create: `packages/electron/assets/tray-partial.png` (Platzhalter)
- Create: `packages/electron/assets/tray-error.png` (Platzhalter)

- [ ] **Step 1: Create electron-builder.yml at root**

Create `electron-builder.yml`:

```yaml
appId: com.companionwebpanel.app
productName: CompanionWebpanel
copyright: "Copyright © 2026"

# electron-builder verwendet packages/electron als App-Root
# (wo package.json mit main: "dist/main.js" liegt)
directories:
  app: packages/electron
  output: release
  buildResources: packages/electron/assets

# Dateien die in das Package kommen (relativ zu packages/electron/)
# build.mjs kopiert frontend/dist → packages/electron/frontend/ vor dem Packaging
files:
  - dist/**          # kompilierter Electron-Code (main.js, preload.js)
  - renderer/**      # startup.html
  - frontend/**      # Frontend PWA (von build.mjs kopiert)
  # node_modules: electron-builder löst sie automatisch auf

# Windows
win:
  target:
    - target: nsis
      arch: [x64]
  icon: packages/electron/assets/icon.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  installerIcon: packages/electron/assets/icon.ico
  createDesktopShortcut: true
  createStartMenuShortcut: true

# macOS
mac:
  target:
    - target: dmg
      arch: [x64, arm64]
  icon: packages/electron/assets/icon.icns
  category: public.app-category.utilities

dmg:
  title: "Companion Webpanel ${version}"
```

> **Hinweis zu Icons:** Für den ersten Build können Platzhalter-PNGs verwendet werden. Für die finale Veröffentlichung `.ico` (Windows) und `.icns` (macOS) anlegen — siehe `packages/electron/assets/README.md`.

- [ ] **Step 2: Create placeholder tray icons**

Erstelle 3 kleine PNG-Platzhalter (16×16 px, einfarbig) als Tray-Icons:

```bash
# Node.js Script zum Erstellen einfacher Platzhalter-PNGs
node -e "
const { createCanvas } = require('canvas')
// Falls 'canvas' nicht installiert: einfach kleine PNG-Dateien aus dem Internet laden
// oder mit einem Bildeditor 3x 16x16 PNGs erstellen
console.log('Erstelle Platzhalter-Icons manuell unter packages/electron/assets/')
console.log('  tray-connected.png  (grün,  16x16)')
console.log('  tray-partial.png    (orange, 16x16)')
console.log('  tray-error.png      (rot,   16x16)')
"
```

**Alternativ:** Lade 3 beliebige 16×16 PNG-Dateien herunter und benenne sie entsprechend um. Die App funktioniert auch mit `nativeImage.createEmpty()` als Fallback (tray.ts, Zeile ~80).

- [ ] **Step 3: Update root package.json — add electron-builder**

Verify that `package.json` (root) has `electron-builder` in devDependencies (aus Task 3 bereits hinzugefügt). Falls nicht:

```bash
npm install --save-dev electron-builder@^25.0.0
```

- [ ] **Step 4: Build frontend + electron, then package**

```bash
# Alles bauen
npm run build:electron

# Windows-Package erstellen
npx electron-builder --win --config electron-builder.yml

# macOS-Package erstellen (nur auf macOS)
npx electron-builder --mac --config electron-builder.yml
```

Expected: `release/CompanionWebpanel Setup 1.0.0.exe` (Windows) bzw. `release/CompanionWebpanel-1.0.0.dmg` (macOS).

- [ ] **Step 5: Smoke-Test des Installers**

Auf Windows:
1. `release/CompanionWebpanel Setup 1.0.0.exe` ausführen → Installation abschließen
2. App starten → Startup-Fenster erscheint
3. `localhost:8080` im Browser öffnen → Frontend lädt
4. Fenster schließen → App im Tray sichtbar
5. Tray → "Open Panel" → Browser öffnet sich
6. Tray → "Quit" → App beendet sich sauber

- [ ] **Step 6: Final commit**

```bash
git add electron-builder.yml packages/electron/assets/
git commit -m "feat: electron-builder config + release scripts — Phase 6 complete"
```

---

## Zusammenfassung der Änderungen

| Komponente | Änderung |
|---|---|
| `shared/types.ts` | Settings v1.3.0, `server?: { port }` |
| `backend/HostManager.ts` | `onStatusChange` callback |
| `backend/index.ts` | `createBackend()` export |
| `packages/electron/` | komplettes neues Workspace |
| `electron-builder.yml` | Release-Config (Win + Mac) |
| Root `package.json` | build:electron + release scripts |

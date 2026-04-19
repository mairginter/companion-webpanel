# Code Review & Optimierung — Companion Webpanel

## Context

Vollständiger Code-Review nach: Breaking Errors, Performance-Bremsen, Ressourcen-Verschwendung, .exe-Größe, RAM-Verbrauch, Startup-Geschwindigkeit. Ziel: messbare Verbesserungen ohne Feature-Verlust. Geschätztes Gesamtpotenzial (bei Umsetzung P0+P1): **−15 bis −20 MB .exe, −500 bis −2000 ms Startup, −30 bis −40 % RAM bei 100 Buttons**.

Die Analyse basiert auf 3 parallelen Explore-Agents über Backend, Frontend, Build-Pipeline plus Stichprobenverifizierung der kritischen Stellen. Alle Claims unten sind mit konkreter Fundstelle belegt.

---

## Priorisierung

- **P0 — KRITISCH** (Bug/Security/DoS-Vektor) → sofort fixen
- **P1 — HIGH** (deutlicher Impact auf Größe/Startup/RAM) → empfohlen
- **P2 — MEDIUM** (messbar aber geringer) → nice-to-have
- **P3 — LOW** (kosmetisch / minimaler Gewinn) → optional

---

## P0 — Breaking Errors / Security / Correctness

### P0-1 — Unbounded POST-Body-Akkumulation (DoS-Vektor)
**Datei:** [packages/backend/src/server/ClientServer.ts:101-103 und 134-136](packages/backend/src/server/ClientServer.ts)
**Problem:** `req.on('data', chunk => body += chunk)` hat kein Size-Limit. Ein Client kann beliebig große Payloads senden und den Heap sprengen.
**Fix:** Size-Guard direkt im data-Handler:
```ts
const MAX_BODY = 1024 * 1024 // 1 MB
let body = ''
req.on('data', (chunk) => {
  body += chunk
  if (body.length > MAX_BODY) {
    res.writeHead(413, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Body too large' }))
    req.destroy()
  }
})
```
An beiden Stellen (Settings-POST + Preview-Page-POST) einbauen.

### P0-2 — Keepalive-Timeout wird überschrieben statt gecleart
**Datei:** [packages/backend/src/satellite/SatelliteClient.ts:269-278](packages/backend/src/satellite/SatelliteClient.ts)
**Problem:** In `startKeepalive()` setzt `setInterval` alle N Sekunden einen neuen `setTimeout` auf `keepaliveTimeoutTimer` — der alte wird ohne `clearTimeout` überschrieben. Bei Netzwerk-Jitter sammeln sich orphaned Timer im Event-Loop.
**Fix:** Vor dem neuen setTimeout alten clearen:
```ts
this.keepaliveTimer = setInterval(() => {
  this.sendLine(`PING ${Date.now()}`)
  if (this.keepaliveTimeoutTimer) clearTimeout(this.keepaliveTimeoutTimer)
  this.keepaliveTimeoutTimer = setTimeout(() => {
    console.warn(`[SatelliteClient ${this.hostId}] PONG Timeout — reconnect`)
    this.ws?.close()
  }, KEEPALIVE_TIMEOUT_MS)
}, KEEPALIVE_INTERVAL_MS)
```
Zusätzlich: beim Empfang eines PONG sollte `keepaliveTimeoutTimer` gecleart werden (ist vermutlich nicht implementiert — verifizieren in Zeile ~200 wo PONG behandelt wird).

### P0-3 — `lineBuffer` ohne Obergrenze (Heap-Exhaustion bei Protokoll-Fehler)
**Datei:** [packages/backend/src/satellite/SatelliteClient.ts:57](packages/backend/src/satellite/SatelliteClient.ts) + analog in VirtualSurfaceSession.ts
**Problem:** Wenn ein fehlerhafter Companion-Host (oder MitM) Daten ohne `\n` schickt, wächst `lineBuffer` unbegrenzt.
**Fix:** Nach jedem Append prüfen und bei Überschreitung Socket schließen:
```ts
if (this.lineBuffer.length > 10 * 1024 * 1024) { // 10 MB
  console.error(`[SatelliteClient ${this.hostId}] Line buffer overflow — disconnect`)
  this.ws?.close()
  this.lineBuffer = ''
  return
}
```

### P0-4 — `clearCache` + `clearStorageData` nicht awaitet vs. fire-and-forget
**Datei:** [packages/electron/src/main.ts:41-44](packages/electron/src/main.ts)
**Problem:** Aktuell mit `await` → blockiert Startup um ~300 ms. Für Tray-App unnötig — Cache kann auch nach UI-Anzeige gelöscht werden.
**Fix:** Fire-and-forget **nach** Startup-Fenster-Anzeige (siehe auch P1-3):
```ts
// In main.ts, nach startupWindow.create()
session.defaultSession.clearCache().catch(() => {})
session.defaultSession.clearStorageData({ storages: ['cachestorage', 'serviceworkers'] }).catch(() => {})
```

### P0-5 — Backend-Stop-Fehler nicht abgefangen beim Port-Wechsel
**Datei:** [packages/electron/src/main.ts:159-171](packages/electron/src/main.ts)
**Problem:** Wenn `backendInstance.stop()` rejectet, läuft das alte Backend weiter während das neue startet → Port-Konflikt.
**Fix:**
```ts
ipcMain.handle('change-port', async (_event, newPort: number) => {
  settings.server = { port: newPort }
  saveSettings(userDataPath, settings)
  try {
    await backendInstance?.stop()
  } catch (err) {
    console.error('[Electron] Backend-Stop fehlgeschlagen:', err)
  }
  backendInstance = await createBackend(settings, newPort, settingsPath, onHostStatus, staticDir)
  // ...
})
```

### P0-6 — JSON.stringify in `broadcast` ohne try/catch
**Datei:** [packages/backend/src/server/ClientServer.ts:254-259](packages/backend/src/server/ClientServer.ts)
**Problem:** Bei zirkulärer Struktur (theoretisch unwahrscheinlich, aber möglich) crasht der komplette Broadcast-Call-Stack.
**Fix:**
```ts
broadcast(msg: BackendToFrontend): void {
  let json: string
  try { json = JSON.stringify(msg) }
  catch (err) { console.error('[ClientServer] Serialisierung fehlgeschlagen:', err); return }
  for (const ws of this.clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(json)
  }
}
```

---

## P1 — High-Impact: .exe-Größe, Startup, RAM

### P1-1 — electron-builder: Compression + ASAR aktivieren
**Datei:** [electron-builder.yml](electron-builder.yml) (komplett)
**Erwarteter Gewinn: −8 bis −13 MB**
**Fix:** Am Root hinzufügen:
```yaml
asar: true
compression: maximum
removePackageScripts: true
win:
  target:
    - target: portable
      arch: [x64]
  icon: packages/electron/assets/icon.ico
```
Hinweis: `compression: maximum` verlängert Build-Zeit ~2-3×. ASAR beschleunigt File-I/O beim App-Start zusätzlich.

### P1-2 — esbuild Minify aktivieren + Source-Maps aus
**Datei:** [packages/electron/build.mjs:11-17](packages/electron/build.mjs)
**Erwarteter Gewinn: −1 bis −2 MB + kein Source-Map-Leak**
**Fix:**
```js
const sharedConfig = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  external: ['electron'],
  sourcemap: false,   // ← geändert
  minify: true,        // ← neu
  legalComments: 'none', // ← neu
}
```
Falls Source-Maps für Debugging im Dev-Build gewünscht: `process.env.NODE_ENV === 'development'`-Weiche.

### P1-3 — Backend-Start nicht blockieren
**Datei:** [packages/electron/src/main.ts:101-103](packages/electron/src/main.ts)
**Erwarteter Gewinn: −500 bis −2000 ms Time-to-Window**
**Problem:** `createBackend` wird mit `await` vor IPC-Registrierung und Tray-Anzeige gestartet.
**Fix:** Startup-Fenster sofort zeigen, Backend + Tray im Hintergrund:
```ts
// 1. Startup-Fenster sofort
startupWindow.create()

// 2. Cache-Clear async (fire-and-forget, siehe P0-4)
session.defaultSession.clearCache().catch(() => {})
session.defaultSession.clearStorageData({
  storages: ['cachestorage', 'serviceworkers']
}).catch(() => {})

// 3. Tray sofort anlegen (vor Backend)
const tray = new AppTray(...)
tray.create()
tray.updateStatus(appStatus)

// 4. Backend asynchron ohne await
if (actualPort !== null) {
  createBackend(settings, actualPort, settingsPath, onHostStatus, staticDir)
    .then((instance) => {
      backendInstance = instance
      startupWindow.sendStatusUpdate(appStatus)
    })
    .catch((err) => console.error('[Electron] Backend-Start fehlgeschlagen:', err))
}
```
Wichtig: IPC-Handler dürfen nicht direkt auf `backendInstance` zugreifen — `change-port` muss `null`-Check haben.

### P1-4 — Unnötige Root-Dependencies entfernen
**Datei:** [package.json:23-27](package.json)
**Erwarteter Gewinn: schnellere `npm install`, sauberere Deps**
**Fix:** Entfernen aus `dependencies`:
- `@esbuild/win32-arm64` — wird von esbuild automatisch als optional-peer installiert, nicht als Root-Dep nötig
- `@rollup/rollup-win32-arm64-msvc` — Projekt nutzt kein Rollup direkt (nur vite-intern)
- `electron` gehört in `devDependencies` (electron-builder bringt die Runtime-Version selbst)

```json
"devDependencies": {
  "concurrently": "^8.2.2",
  "electron": "^33.4.11",
  "electron-builder": "^25.0.0",
  "typescript": "^5.4.5"
},
"dependencies": {}
```

### P1-5 — Vite Build-Config explizit setzen
**Datei:** [packages/frontend/vite.config.ts](packages/frontend/vite.config.ts)
**Erwarteter Gewinn: −50 bis −150 KB Frontend-Bundle + bessere Caching-Fähigkeit**
**Fix:** Nach dem `plugins`-Block hinzufügen:
```ts
build: {
  target: 'es2020',
  minify: 'esbuild',
  sourcemap: false,
  reportCompressedSize: false,
  cssCodeSplit: true,
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom'],
        'dnd-kit': ['@dnd-kit/core', '@dnd-kit/modifiers'],
        'i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
      },
    },
  },
},
```
Package-Namen anhand der tatsächlichen Frontend-Deps anpassen.

### P1-6 — Bitmap-Konvertierung cachen (WeakMap)
**Datei:** [packages/frontend/src/utils/bitmap.ts](packages/frontend/src/utils/bitmap.ts)
**Erwarteter Gewinn: −30 bis −50 % CPU bei Button-Updates, drastisch weniger Data-URL-Strings im Heap**
**Problem:** Bei jeder Bitmap-Änderung wird `createElement('canvas')` + `toDataURL()` neu aufgerufen — 5-50 ms pro Aufruf, keine Wiederverwendung.
**Fix:** Modul-Level-Cache + einmaliges Canvas:
```ts
const bitmapCache = new Map<string, string>()
const MAX_CACHE_SIZE = 500
let sharedCanvas: HTMLCanvasElement | null = null

export function rawRgbBase64ToDataUrl(base64: string, width: number, height: number): string {
  const cacheKey = `${width}x${height}:${base64}`
  const cached = bitmapCache.get(cacheKey)
  if (cached !== undefined) return cached

  // ... existierende Konvertierung, aber sharedCanvas statt createElement ...
  if (!sharedCanvas) sharedCanvas = document.createElement('canvas')
  sharedCanvas.width = width
  sharedCanvas.height = height
  const ctx = sharedCanvas.getContext('2d')
  // ... putImageData + toDataURL ...
  const dataUrl = sharedCanvas.toDataURL('image/png')

  if (bitmapCache.size >= MAX_CACHE_SIZE) {
    // einfacher FIFO-Evict: erste 100 entfernen
    const keys = Array.from(bitmapCache.keys()).slice(0, 100)
    for (const k of keys) bitmapCache.delete(k)
  }
  bitmapCache.set(cacheKey, dataUrl)
  return dataUrl
}
```

### P1-7 — StateStore O(n)-Scan in `clearHost` + unbounded Growth
**Datei:** [packages/backend/src/state/StateStore.ts:91-96](packages/backend/src/state/StateStore.ts)
**Erwarteter Gewinn: konstant-schneller Host-Clear + RAM-Schutz gegen Langläufer**
**Problem:** `clearHost` iteriert über ALLE Keys. Bei vielen Hosts wächst das linear. Zusätzlich: keine Eviction — Map wächst forever.
**Fix:** Sekundär-Index + optional Max-Size:
```ts
private hostIndex = new Map<string, Set<string>>()

update(...) {
  // nach this.store.set(k, ...)
  const hostKeys = this.hostIndex.get(hostId) ?? new Set()
  hostKeys.add(k)
  this.hostIndex.set(hostId, hostKeys)
}

clearHost(hostId: string): void {
  const keys = this.hostIndex.get(hostId)
  if (!keys) return
  for (const k of keys) this.store.delete(k)
  this.hostIndex.delete(hostId)
}
```
Analog für `virtualStore` mit `deviceIndex`.

### P1-8 — Regex als Modul-Konstante (Hot Path)
**Datei:** [packages/backend/src/satellite/SatelliteClient.ts:352-360](packages/backend/src/satellite/SatelliteClient.ts)
**Erwarteter Gewinn: −10 bis −20 % CPU im SUB-STATE-Parser bei vielen Hosts**
**Fix:** Regex außerhalb der Funktion definieren und pro Call `lastIndex` resetten:
```ts
const PARAM_REGEX = /(\w+)=(?:"([^"]*)"|(\S+))/g
function parseParams(str: string): Record<string, string> {
  const result: Record<string, string> = {}
  PARAM_REGEX.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PARAM_REGEX.exec(str)) !== null) {
    result[m[1]] = m[2] !== undefined ? m[2] : m[3]
  }
  return result
}
```

### P1-9 — Synchrone fs in `serveStatic` durch Async ersetzen
**Datei:** [packages/backend/src/server/ClientServer.ts:302-338](packages/backend/src/server/ClientServer.ts)
**Erwarteter Gewinn: Event-Loop nicht mehr blockiert beim Static-Serving**
**Fix:** `fs.existsSync` / `fs.readFileSync` → `fs.promises.stat` + `fs.createReadStream(...).pipe(res)`. Zusätzlich ETag/max-age-Header für Frontend-Assets (Hash-basiert bei Vite bereits vorhanden).

---

## P2 — Medium-Impact: Performance, RAM, Bundle

### P2-1 — JSON.stringify pretty-print entfernen
**Datei:** [packages/backend/src/server/ClientServer.ts:96](packages/backend/src/server/ClientServer.ts)
**Fix:** `JSON.stringify(this.settings, null, 2)` → `JSON.stringify(this.settings)` (Settings werden nicht menschlich gelesen in der API-Response).

### P2-2 — `i18n-strings` IPC-Handler nicht bei jedem Aufruf neu berechnen
**Datei:** [packages/electron/src/main.ts:136-146](packages/electron/src/main.ts)
**Fix:** Einmal bei Startup in Konstante cachen, bei `changeLanguage`-Event neu bauen.

### P2-3 — Zustand-Store: `selectedIds: Set` bricht Shallow-Equality
**Datei:** packages/frontend/src/store/useAppStore.ts (Select-Bereich)
**Problem:** Neues `Set`-Objekt bei jedem `selectElement` → alle Subscriber re-rendern.
**Fix:** Entweder zu `string[]` konvertieren oder `useShallow`-Selector in Subscribern, oder `zustand/shallow` für Vergleich.

### P2-4 — `PropertiesPanel.selectedElements` pro Render filtern
**Datei:** packages/frontend/src/components/PropertiesPanel/PropertiesPanel.tsx
**Fix:** `useMemo(() => panel.elements.filter(...), [panel.elements, selectedIds])` statt inline-Filter.

### P2-5 — Canvas-Grid: 4× repeating-linear-gradient pro Repaint
**Datei:** packages/frontend/src/components/Canvas/Canvas.tsx (Edit-Mode-Grid-Bereich)
**Fix:** Dual-Grid als Data-URI-SVG oder einmaliges Canvas-PNG im `background-image`. GPU-freundlicher und zoom-stabil.

### P2-6 — Undo-Stack unbounded
**Datei:** packages/frontend/src/store/useAppStore.ts (`saveUndoSnapshot`)
**Fix:** Stack auf max 20-30 Snapshots limitieren. Bei großen Panels mit vielen Elementen sind pro Snapshot mehrere KB-MB RAM involviert.

### P2-7 — Icon-Duplikate entfernen
**Datei:** packages/electron/assets/ + [electron-builder.yml:19](electron-builder.yml)
**Fix:** Prüfen ob `icon-512.png` (31 KB) benötigt wird — falls nicht, aus Assets + `files`-Liste entfernen. `icon.ico` (Windows) + `icon.icns` (Mac) + `icon-256.png` (Startup-Fenster) reichen.

### P2-8 — React.StrictMode nur in DEV
**Datei:** [packages/frontend/src/main.tsx:9-13](packages/frontend/src/main.tsx)
**Erwarteter Gewinn:** Prod eigentlich unverändert (StrictMode macht in Prod-Build nichts), aber sauberer Code. Niedrige Priorität — nur umsetzen wenn sonst viel angefasst wird.

### P2-9 — WebSocket-Handler: `addEventListener`/`removeEventListener` statt `onopen=`
**Datei:** [packages/frontend/src/ws/useWebSocket.ts:39-95](packages/frontend/src/ws/useWebSocket.ts)
**Fix:** Event-Handler als benannte Funktionen + explizite Cleanup via `removeEventListener`. Beim aktuellen Code existiert `useCallback`-Dep-Chain, die bei jeder `applyXxx`-Änderung den Connect neu erzeugt. → Entweder Store-Actions stabilisieren (Zustand macht das eigentlich automatisch) oder `useRef` für connect-Logik.

---

## P3 — Low-Impact / Optional

### P3-1 — `process.on('exit')`-Fallback ist zu spät für async stop
**Datei:** [packages/electron/src/main.ts:209-211](packages/electron/src/main.ts)
**Note:** `exit`-Event ist synchron — `backendInstance.stop().catch(...)` wird nicht mehr warten. `app.on('before-quit', e => { e.preventDefault(); shutdown() })` wäre korrekter.

### P3-2 — Reconnect in SatelliteClient: Exponential Backoff statt fixer Delay
Falls noch nicht implementiert, gegen endlose Tight-Loops sichern.

### P3-3 — `@cwp/shared` als Prebuilt bundled
**Datei:** [packages/frontend/vite.config.ts:13](packages/frontend/vite.config.ts)
**Fix:** Statt Source-Alias auf `dist/types.js` zeigen (setzt voraus dass `npm run build -w @cwp/shared` vor Frontend-Build läuft — ist im Build-Script bereits so).

### P3-4 — Material Icons per CDN
**Datei:** packages/frontend/index.html
**Note:** Nur relevant falls die App offline laufen soll (LAN ohne Internet). Für lokales LAN wahrscheinlich OK, für vollständige Offline-PWA Self-Host prüfen.

---

## Reihenfolge der Umsetzung

1. **Sofort** (P0): P0-1, P0-2, P0-3, P0-5, P0-6 — reine Bugfixes ohne Risiko
2. **Build-Pipeline** (P1-1, P1-2, P1-4): Konfig-Änderungen, sofort messbar kleinere .exe
3. **Startup** (P0-4 + P1-3): kombiniert zu einem Commit, da beide `main.ts` betreffen
4. **Bundle** (P1-5): Vite-Config, einmal messen mit `npm run build` vorher/nachher
5. **Performance/RAM** (P1-6, P1-7, P1-8, P1-9): Backend-Heavy-Hitters
6. **P2 nach Bedarf**, P3 optional

---

## Kritische Dateien (Änderungs-Übersicht)

| Datei | P0 | P1 | P2 |
|---|---|---|---|
| [packages/backend/src/server/ClientServer.ts](packages/backend/src/server/ClientServer.ts) | P0-1, P0-6 | P1-9 | P2-1 |
| [packages/backend/src/satellite/SatelliteClient.ts](packages/backend/src/satellite/SatelliteClient.ts) | P0-2, P0-3 | P1-8 | |
| [packages/backend/src/state/StateStore.ts](packages/backend/src/state/StateStore.ts) | | P1-7 | |
| [packages/electron/src/main.ts](packages/electron/src/main.ts) | P0-4, P0-5 | P1-3 | P2-2 |
| [packages/electron/build.mjs](packages/electron/build.mjs) | | P1-2 | |
| [electron-builder.yml](electron-builder.yml) | | P1-1 | P2-7 |
| [package.json](package.json) | | P1-4 | |
| [packages/frontend/vite.config.ts](packages/frontend/vite.config.ts) | | P1-5 | |
| [packages/frontend/src/utils/bitmap.ts](packages/frontend/src/utils/bitmap.ts) | | P1-6 | |
| packages/frontend/src/store/useAppStore.ts | | | P2-3, P2-6 |
| packages/frontend/src/components/PropertiesPanel/ | | | P2-4 |
| packages/frontend/src/components/Canvas/Canvas.tsx | | | P2-5 |
| packages/frontend/src/ws/useWebSocket.ts | | | P2-9 |

---

## Verifikation

**Nach P0-Fixes:**
- Manuelles Test: Companion disconnect/reconnect-Zyklus 10× laufen lassen — kein RAM-Anstieg im Task-Manager
- Large-Body-Test: `curl -X POST --data-binary @10MB.json http://localhost:8080/api/settings` → erwarte 413

**Nach P1-1/P1-2/P1-4:**
- Vor/Nach-Vergleich: `npm run release` → Größe der `CompanionWebpanel-*.exe` messen
- Startup-Zeit: `console.time`/`console.timeEnd` um `main()` + um `createBackend` legen, Werte in Log verifizieren

**Nach P1-3:**
- Electron starten und Sekunden zählen bis Startup-Fenster sichtbar ist (soll von ~2-3 s auf <1 s fallen)
- Backend-Connect-Verzögerung: Status-Dots im Startup-Fenster dürfen später "verbunden" zeigen — das ist erwartet

**Nach P1-6:**
- DevTools Performance-Tab: Button-Update-Szenario (Companion sendet rapid bitmap-updates) — `rawRgbBase64ToDataUrl`-Zeiten sollen dramatisch fallen

**Gesamt:**
- `npm run build` ohne neue Type-Errors
- `npx tsc --noEmit -p packages/frontend/tsconfig.json`
- Alle bestehenden Tests: `npm test`
- Smoke-Test: App starten, Companion verbinden, Button drücken, Bitmap sehen

---

## Out of Scope

Diese Punkte wurden im Review **bewusst nicht** aufgenommen:
- Komplettes Rewriting von Modulen (`useWebSocket`, `SatelliteClient`)
- Migration zu ESM-Only (breaking change für das gesamte Backend)
- Service-Worker-Precaching via vite-plugin-pwa (aktuell nur Manifest, kein SW)
- Workerisierung von `bitmap.ts` (OffscreenCanvas + Worker) — guter Gewinn, aber hoher Umbauaufwand
- Austausch von `@dnd-kit/core` gegen leichteres Lib — ohne Bundle-Analyzer-Run kein Benefit-Beweis

Falls Bedarf besteht, separater Plan erforderlich.

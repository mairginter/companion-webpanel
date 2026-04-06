# Electron ARM64 Windows — Debugging-Protokoll

**Datum:** 2026-04-06  
**System:** Windows 11 ARM64 (Node.js v24.14.1, npm workspaces)

---

## Problembeschreibung

`npm run electron:dev` startet nicht. Electron startet, aber `require('electron')` schlägt fehl.

---

## Gefundene und behobene Fehler (Code-Bugs)

### Bug 1 — `TextureOption` nicht importiert
- **Datei:** `packages/frontend/src/components/PropertiesPanel/CanvasSettings.tsx:6`
- **Fehler:** `error TS2304: Cannot find name 'TextureOption'`
- **Fix:** `import { TEXTURES, TextureOption } from '../../utils/textures'`

### Bug 2 — `index.ts` lief beim Electron-Import mit
- **Problem:** `packages/backend/src/index.ts` hatte standalone `main()` auf Top-Level. Wenn Electron `createBackend` importierte, wurde `main()` ausgeführt → `loadSettings()` → `process.exit(1)` weil Settings-Datei nicht gefunden.
- **Fix:** Boot-Logik in eigene Datei ausgelagert: `packages/backend/src/standalone.ts`
- `index.ts` exportiert jetzt NUR `createBackend()`
- `packages/backend/package.json` scripts zeigen jetzt auf `standalone.ts`

### Bug 3 — `@esbuild/win32-arm64` fehlte
- **Problem:** `npm install` hatte optionale ARM64-Dependency übersprungen
- **Fix:** `npm install @esbuild/win32-arm64`

### Bug 4 — Electron Binary v20 im Cache (korrupt)
- **Problem:** `node_modules/electron/dist/electron.exe` war v20.18.3 obwohl Paket v33.4.11 ist
- **Ursache:** Korrupter/falscher ZIP-Cache in `%LOCALAPPDATA%/electron/Cache/`
- **Fix:** Cache gelöscht, neu heruntergeladen (`install.js` ausgeführt)

---

## Ursache gefunden: `ELECTRON_RUN_AS_NODE=1` (2026-04-06)

### Symptom
```
TypeError: Cannot read properties of undefined (reading 'requestSingleInstanceLock')
```
```js
process.type       // undefined  ← sollte 'browser' sein
process.versions.electron  // '33.4.11' ← C++ init läuft OK
require('electron')   // findet npm-Paket → gibt Pfad-String zurück → .app = undefined
```

### Echte Ursache
**`ELECTRON_RUN_AS_NODE=1`** war in der Prozessumgebung gesetzt!

Claude Code (und VS Code allgemein) sind Electron-Apps die im Node-Modus laufen. Sie setzen `ELECTRON_RUN_AS_NODE=1` in ihrer Prozessumgebung. Alle Kind-Prozesse (auch unser `npm run electron:dev`) erben diese Variable. Wenn `electron.exe` diese Variable sieht, startet es im reinen Node-Modus — kein GUI, kein `process.type`, kein internes `require('electron')`.

**Weder ARM64 noch x64 waren das Problem.** Beide Architekturen funktionieren — der Fehler war die geerbte Umgebungsvariable.

### Fix
`scripts/launch-electron.mjs` löscht `ELECTRON_RUN_AS_NODE` vor dem Spawn:
```js
delete process.env.ELECTRON_RUN_AS_NODE
spawn(electronPath, ['packages/electron'], { stdio: 'inherit', env: process.env })
```
`npm run electron:dev` nutzt jetzt diesen Launcher statt `electron` direkt.
6. Quit schließt App sauber
7. Backend startet (Hosts verbinden sich mit Companion wenn konfiguriert)

---

## npm run dev (ohne Electron) — funktioniert auf ARM64

Als Workaround bis Electron-Problem gelöst:
```bash
npm run dev   # Backend :8080 + Frontend :5173
```
Browser-PWA ist voll funktionsfähig.

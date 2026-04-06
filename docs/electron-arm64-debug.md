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

## Systemfehler (nicht durch Code behebbar)

### Electron JavaScript-Initialisierung schlägt fehl

**Symptom:**
```
TypeError: Cannot read properties of undefined (reading 'requestSingleInstanceLock')
```

**Diagnose:**
```js
process.type       // undefined  ← sollte 'browser' sein
process.versions.electron  // '28.3.3' ← C++ init läuft OK
require('electron')   // findet npm-Paket → gibt Pfad-String zurück → .app = undefined
```

**Test ohne npm-Paket:**
```
Error: Cannot find module 'electron'
```
→ Auch ohne npm-Paket findet Electron das interne Modul NICHT.

**Getestete Versionen:** v28.3.3, v32.x, v33.4.11  
**Getestete Architekturen:** win32-arm64 (nativ), win32-x64 (Emulation)  
**Ergebnis:** Alle identisch fehlerhaft

**Ursache (Theorie):**  
Electron's `lib/browser/init.ts` (JavaScript-Initialisierung) läuft nicht durch. Diese setzt `process.type = 'browser'` und registriert `require('electron')`. Das C++ läuft (`process.versions.electron` ist gesetzt), aber der JS-Init-Teil schlägt still fehl.

Stack-Trace zeigt: `c._load` (Electron's Module-Hook aus `node:electron/js2c/node_init`) wird aufgerufen, delegiert aber direkt an Node's Standard-`Module._load` weiter, ohne `'electron'` abzufangen — wahrscheinlich weil die Builtin-Module-Liste leer ist.

**Mögliche Systemursachen:**
- Windows Security Feature (Device Guard / Smart App Control)
- HVCI (Hypervisor Protected Code Integrity) blockiert V8-Initialisierung
- ARM64-spezifischer Bug in Electron (alle Versionen?)

**Status:** Auf x64-System testen

---

## Nächster Test (x64-System)

Checklist für Smoke-Test auf x64:
1. `npm run electron:dev` startet ohne Fehler
2. Startup-Fenster erscheint (400×240, frameless)
3. Tray-Icon erscheint (grün/orange/rot je nach Host-Status)
4. "Open Panel" öffnet Browser auf `localhost:8080`
5. Port-Änderung im Startup-Fenster funktioniert + speichert
6. Quit schließt App sauber
7. Backend startet (Hosts verbinden sich mit Companion wenn konfiguriert)

---

## npm run dev (ohne Electron) — funktioniert auf ARM64

Als Workaround bis Electron-Problem gelöst:
```bash
npm run dev   # Backend :8080 + Frontend :5173
```
Browser-PWA ist voll funktionsfähig.

# Spec: Electron Wrapper — Tray + Startup-Fenster + Port-Konfiguration

**Datum:** 2026-04-05  
**Status:** Approved  
**Scope:** Phase 6 — Electron Wrapper

---

## Ziel

Das Companion Webpanel soll als eigenständige Desktop-App ausgeliefert werden (Windows + Mac).  
Erlebnis ähnlich wie Bitfocus Companion selbst:
- Kleines Startup-Fenster zeigt Port und Status
- App versteckt sich in den System-Tray
- Tray-Menü für schnellen Zugriff (Open Panel, Open Settings, Status, Quit)

---

## Architektur

```
packages/
  shared/          ← unverändert
  backend/         ← unverändert (läuft direkt im Electron Main Process)
  frontend/        ← unverändert (PWA, build output wird mitgepackt)
  electron/        ← NEU
    src/
      main.ts          ← Electron Entry Point
      tray.ts          ← Tray-Icon + Menü-Logik
      startupWindow.ts ← Startup-BrowserWindow Management
      portCheck.ts     ← Port-Verfügbarkeit prüfen + Auto-Fallback
      preload.ts       ← Preload-Script (contextBridge für IPC)
    renderer/
      startup.html     ← Startup-Fenster UI (HTML + inline CSS/JS)
    package.json
    electron-builder.yml
```

### Prozess-Modell

- Backend (`ClientServer`, `HostManager`, `StateStore`) läuft **direkt im Electron Main Process**
- Kein Child-Process nötig — Electron bringt Node.js mit
- Frontend `dist/` wird von `ClientServer` als statische Dateien serviert (wie bisher)
- Electron öffnet **keinen** BrowserWindow für das Panel — User nutzt `localhost:<port>` im Browser oder Tablet

### Build-Output

```
electron-builder erzeugt:
  Windows: CompanionWebpanel-Setup.exe  (NSIS Installer)
  Mac:     CompanionWebpanel.dmg
```

Enthält: Electron Runtime + Backend (compiled JS) + Frontend dist/ + Default-Settings

### Settings-Datei (User-Daten, außerhalb des Installers)

| Plattform | Pfad |
|---|---|
| Windows | `%APPDATA%\CompanionWebpanel\settings.json` |
| Mac | `~/Library/Application Support/CompanionWebpanel/settings.json` |

Beim ersten Start wird eine Default-Settings angelegt falls keine existiert.

---

## Startup-Fenster

Größe: 400×240px, nicht resizable, kein Menübar, `alwaysOnTop: false`.

```
┌─────────────────────────────────────┐
│  🎛 Companion Webpanel   v1.0.0     │
│                                     │
│  Panel läuft auf:                   │
│  http://localhost: [8081] ✏         │
│                                     │
│  [  Open Panel  ]  [  Quit  ]       │
│                                     │
│  ● LiveStudio-PC1  connecting...    │
└─────────────────────────────────────┘
```

### Verhalten

| Aktion | Reaktion |
|---|---|
| "Open Panel" | `shell.openExternal('http://localhost:<port>')` → Fenster versteckt sich |
| "Quit" | Graceful Shutdown + `app.quit()` |
| Fenster schließen (X) | `win.hide()` — App läuft im Tray weiter |
| Port-Feld editieren + Enter | Backend-Neustart auf neuem Port, Settings speichern |

### Port-Fehler-Anzeige

Wenn kein freier Port in Range 8080–8089 gefunden:
```
┌─────────────────────────────────────┐
│  ⚠ Kein Port verfügbar (8080-8089)  │
│  Bitte Port manuell eingeben:       │
│  http://localhost: [____] ✏         │
│  [  Retry  ]  [  Quit  ]            │
└─────────────────────────────────────┘
```

### IPC: Backend → Startup-Fenster

```typescript
// Main → Renderer (Status-Updates)
ipcMain.handle('get-status', () => ({ port, hosts: [...] }))

// Renderer sendet:
ipcRenderer.invoke('change-port', newPort)   // Port-Änderung
ipcRenderer.invoke('open-panel')             // Open Panel Button
ipcRenderer.invoke('quit')                   // Quit Button
```

---

## Tray-Menü

```
[Icon] CompanionWebpanel
───────────────────────
  Open Panel             ← shell.openExternal(localhost:<port>)
  Open Settings          ← shell.openExternal(localhost:<port>/#settings)
───────────────────────
  ● LiveStudio-PC1  ✓    ← connected (grün)
  ● Home-Studio     ✗    ← error (rot)
───────────────────────
  Show Window            ← Startup-Fenster wieder einblenden
  Quit
```

### Tray-Icon Status

| Zustand | Icon |
|---|---|
| Alle Hosts connected | grün |
| Mindestens 1 Host connecting/error | orange |
| Alle Hosts disconnected/error | rot |

Icons: 3 PNG-Varianten (16×16 + Template für Mac), in `electron/assets/`.

### Status-Updates im Tray

- `HostManager` emittiert Status-Events → `tray.ts` rebuildet Kontextmenü
- Rebuild nur wenn sich Status ändert (kein Polling)

---

## Port-Konfiguration

### Settings-Schema v1.3.0

```json
{
  "version": "1.3.0",
  "server": {
    "port": 8080
  },
  "hosts": [...],
  "panels": [...]
}
```

`satellite.wsPort` pro Host bleibt unverändert (bereits implementiert).

### Port-Check Algorithmus (portCheck.ts)

```
1. Lese server.port aus Settings (default 8080)
2. Versuche Port zu binden (net.createServer().listen())
3. Frei → verwende diesen Port
4. EADDRINUSE → versuche port+1 (max 10 Versuche: 8080–8089)
5. Alle belegt → zeige Fehler im Startup-Fenster
6. Auto-gewählter Port wird NICHT in Settings gespeichert (nur für diese Session)
   → Port wird nur gespeichert wenn User ihn explizit im Edit-Feld ändert
```

### Was sich ändert

| Datei | Änderung |
|---|---|
| `shared/types.ts` | `Settings.server: { port: number }` hinzufügen |
| `CompanionWebpannelSettings.schema.json` | v1.3.0, `server`-Block |
| `backend/index.ts` | Port aus `settings.server.port` lesen; `CLIENT_WS_PORT` env als Override erhalten |
| `electron/portCheck.ts` | NEU — Port-Check vor Backend-Start |
| `electron/main.ts` | NEU — Entry Point, Boot-Sequenz |
| `electron/tray.ts` | NEU — Tray-Management |
| `electron/startupWindow.ts` | NEU — BrowserWindow für Startup |
| `electron/preload.ts` | NEU — contextBridge IPC-Exposition |
| `electron/renderer/startup.html` | NEU — Startup-UI |
| `packages/electron/package.json` | NEU — electron, electron-builder als deps |
| Root `package.json` | electron workspace hinzufügen, build-Skript |

---

## Boot-Sequenz (main.ts)

```
1. app.whenReady()
2. Settings laden (aus User-Daten-Pfad, default anlegen wenn nicht vorhanden)
3. portCheck() → freien Port ermitteln
4. Startup-Fenster anzeigen (Status: "Starte...")
5. Backend starten (StateStore, ClientServer, HostManager)
6. Startup-Fenster updaten (Port + Host-Status)
7. Tray-Icon erstellen
8. app.on('window-all-closed') → nicht beenden (nur hide)
```

---

## Dev-Workflow (unverändert)

```bash
npm run dev -w @cwp/backend    # Backend direkt (ohne Electron)
npm run dev -w @cwp/frontend   # Vite Dev Server

# Electron Dev:
npm run dev -w @cwp/electron   # electron . mit hot-reload
```

`CLIENT_WS_PORT` env-Variable bleibt als Override für Dev erhalten.

---

## Out of Scope (MVP)

- Auto-Update (electron-updater) — separater Schritt
- Windows Code-Signing / Mac Notarisierung — für interne Nutzung nicht nötig
- Mehrere Fenster / Dashboard im Electron-Fenster
- Deep-Link-Protokoll (`cwp://`)

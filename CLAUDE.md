# CLAUDE.md – Companion Webpanel Projekt

Einstiegspunkt für neue Sessions — lies zuerst dieses File, dann bei Bedarf die verlinkten Docs.

---

## Was wird gebaut

Ein **lokal laufendes Webpanel als PWA** für Bitfocus Companion, erreichbar im LAN (PC, Mac, Tablet).  
Es spiegelt Companion-Buttons in Echtzeit (Bitmap, Farbe, Text) und löst Button-Presses aus.

**Primärer Anwendungsfall:** Live-Produktion (Streaming/Broadcast) — der User steuert OBS/vMix/NDI-Workflows über ein frei gestaltbares Touch-Panel.

---

## Externe Referenz-Dokumente

| Dokument | Inhalt |
|---|---|
| [docs/decisions.md](docs/decisions.md) | Alle getroffenen Architektur- und UI-Entscheidungen (nicht mehr diskutieren) |
| [docs/ws-protocol.md](docs/ws-protocol.md) | Satellite API Kommandos + Backend↔Frontend WS-Protokoll + Companion API Quirks |
| [docs/design-system.md](docs/design-system.md) | Farben, Typografie, Keyboard Shortcuts, Button-States, Edit/View-Mode-Tabelle |
| [docs/phase-history.md](docs/phase-history.md) | Abgeschlossene Phasen 1–7 mit Commit-Referenzen |
| [docs/satellite-api-protocol.md](docs/satellite-api-protocol.md) | Vollständige Satellite API Protokoll-Referenz (v1.10 / Companion 4.3+) |
| [Webpanel-Architektur.md](Webpanel-Architektur.md) | Architektur-Doku (aktuell, v1.1) |
| [bitfocus-companion-module-sources.md](bitfocus-companion-module-sources.md) | API-Quellen / Docs-Links |

---

## Kritische Entscheidungen (Kurzfassung)

> Vollständige Liste: [docs/decisions.md](docs/decisions.md)

| Was | Wie |
|---|---|
| API | Companion Satellite API (WebSocket :16623) — kein TCP, kein Polling |
| Surface-Modell | Button Subscriptions API (seit Companion 4.3 / API 1.10) — kein ADD-DEVICE |
| Connections | 1 SatelliteClient pro Host, alle Subscriptions über eine WS-Verbindung |
| Schema-Version | **1.3.0** — Settings-Version bump braucht immer 5 Dateien (siehe Dev-Gotchas) |
| Multi-Agent | **NEIN** — immer sequenziell, nie parallele Agenten auf gleichen Dateien |
| Jede Codedatei | Kurz-Beschreibung + ausführliche Inline-Kommentare (festgelegt Session 3) |
| Companion-Mindestversion | 4.3.0+ — `satellite_subscriptions_enabled = true` in Companion Settings |

---

## Architektur

```
[Companion] ←→ WS:16623 ←→ [Node Backend] ←→ WS:8080 ←→ [React PWA / Browser]
                              SatelliteClient (1 pro Host)
                              └── ADD-SUB pro referenziertem Button
                              └── SUB-STATE → StateStore
                              └── SUB-PRESS / SUB-ROTATE ← Events vom Browser
                              StateStore (In-Memory, Key: hostId:page:row:col)
                              ClientServer (HTTP + WS auf :8080)
```

- Subscriptions **dynamisch**: neuer Button → sofort `ADD-SUB`, gelöscht → `REMOVE-SUB`
- Backend ist **State-Broker**: cached alle SUB-STATEs, sendet nur Deltas
- Frontend ist **stateless**: rendert nur was sich ändert

---

## Datenmodell (Kern)

```typescript
// CompanionRef — zeigt auf einen Companion-Button
{ hostId: string, page: number, row: number, col: number }

// Panel.defaultMode
"view" | "edit"
// view: Buttons lösen KEY-PRESS aus, kein Drag
// edit: Drag & Drop, Resize (min. = bitmapSize), kein KEY-PRESS
```

## Element-Typen

| Typ | Beschreibung |
|---|---|
| `companionButton` | Spiegelt einen Companion-Button (ref: hostId+page+row+col) |
| `shape` | Rechteck zur visuellen Gruppierung (fill, stroke, borderRadius) |
| `label` | Statischer Text (color, fontSize, fontFamily, align) |
| `channelStrip` | Audio-Mixer-Channel: Meter L/R, Fader, Mute, Solo, Pan |

Alle Elemente erben `BaseElement`: `id, type, x, y, w, h, z, locked`.

---

## Projekt-Dateien (Übersicht)

```
CompanionWebpannel/
├── CLAUDE.md                                     ← diese Datei
├── CompanionWebpannelSettings.schema.json        ← JSON-Schema v1.3.0
├── CompanionWebpannelSettings.json               ← Laufzeit-Konfiguration
├── electron-builder.yml                          ← Release-Config Win+Mac
├── package.json                                  ← npm workspaces root
├── scripts/launch-electron.mjs                   ← Electron-Launcher (löscht ELECTRON_RUN_AS_NODE)
├── docs/                                         ← Referenz-Dokumente (siehe oben)
└── packages/
    ├── shared/src/types.ts                       ← Alle TypeScript-Typen
    ├── backend/src/
    │   ├── satellite/SatelliteClient.ts          ← 1 pro Host, Button Subscriptions API, PING/PONG
    │   ├── state/StateStore.ts                   ← In-Memory State + Delta-Logik
    │   ├── server/ClientServer.ts                ← HTTP (/api/settings, /api/preview-page) + WS-Server
    │   ├── HostManager.ts                        ← Orchestrierung: 1 Client pro Host, Subscription-Diff
    │   ├── index.ts                              ← createBackend() Factory für Electron
    │   └── standalone.ts                         ← Standalone Entry Point (npm start/dev)
    ├── frontend/src/
    │   ├── store/useAppStore.ts                  ← Zustand-Store
    │   ├── ws/useWebSocket.ts                    ← WS-Hook mit Auto-Reconnect
    │   ├── utils/bitmap.ts                       ← Raw-RGB → Data-URL
    │   ├── utils/textures.ts                     ← Canvas-Texturen (8 Optionen)
    │   ├── utils/channelStrip.ts                 ← parseChannelStripText(), parsePanValue()
    │   ├── App.tsx + main.tsx                    ← App-Shell mit Keyboard-Shortcuts
    │   └── components/
    │       ├── Toolbar/                          ← Mode-Toggle, Panel-CRUD, ZoomControl, Status-Dots
    │       ├── HostManager/HostManagerModal.tsx  ← Host Add/Edit/Delete/Connect
    │       ├── Canvas/Canvas.tsx                 ← Element-Rendering + Textur-Layering + Zoom
    │       └── Elements/                         ← CompanionButtonElement, ShapeElement, LabelElement, ChannelStripElement
    └── electron/
        ├── src/main.ts                           ← Entry Point + IPC-Handler
        ├── src/preload.ts                        ← contextBridge (cwpApi)
        ├── src/startupWindow.ts                  ← 400×240 frameless Startup-Fenster
        ├── src/panelWindow.ts                    ← APP-Modus Panel (1280×720)
        ├── src/tray.ts                           ← Tray-Icon + Kontextmenü
        ├── src/portCheck.ts                      ← isPortFree() + findFreePort()
        ├── src/settingsHelper.ts                 ← load/save/migrate aus userData
        └── renderer/startup.html                 ← Startup-Fenster UI
```

---

## Nächste Session — Offene Aufgaben

### Electron
- ⬜ Host-Settings Live-Update im Tray ohne App-Neustart (File-Watcher auf settings.json)
- ⬜ macOS .icns Icon: `packages/electron/assets/icon-512.png` → cloudconvert.com → ICNS

### Edit-Mode
- ⬜ Ctrl+C / Ctrl+V (Copy/Paste wie Duplicate mit +75px Versatz)
- ⬜ Canvas Grid Snap für alle Elemente (Shape, Label — nicht nur CompanionButton)

### CompanionButton-Picker
- ⬜ Page-Name anzeigen — Companion sendet Page-Namen via Satellite API (prüfen ob `PAGE-NAME` verfügbar)

### Zukünftige Features (geplant)
- **Panel Export/Import** (~2–3h): `.cwp`-Datei (JSON) pro Panel; hostId-Mapping-Dialog beim Import
- **Host-ID Remapping** (~3–5h): alle Button-Referenzen von hostId A → B umschreiben
- **Virtual StreamDeck Element**: registriert sich als echtes Companion Surface (ADD-DEVICE), Grid-Element auf Canvas

---

## Dev-Gotchas

- **ELECTRON_RUN_AS_NODE** → Claude Code und VS Code setzen `ELECTRON_RUN_AS_NODE=1`. `npm run electron:dev` löscht es via `scripts/launch-electron.mjs`. Bei manuellem Aufruf: `ELECTRON_RUN_AS_NODE= electron packages/electron` oder separates Terminal.
- **Settings-Version bump** → immer **5 Stellen** anfassen: `schema.json` + `types.ts` + `backend/standalone.ts` + `backend/server/ClientServer.ts` + `CompanionWebpannelSettings.json`
- **shared neu bauen nach Typänderungen** → `npm run build -w @cwp/shared` — sonst kompiliert Backend gegen alten Stand
- **vitest/esbuild strippt TypeScript** → Type-Fehler nicht als Test-Failures sichtbar. TS-Check: `npx tsc --noEmit -p packages/frontend/tsconfig.json`
- **Test-Fixture-Version** → `makeSettings()` in `useAppStore.test.ts` verwendet `version: '1.3.0'` — bei Version-Bump anpassen
- **caps-disabled Status** → konsistent in 3 Stellen: `SessionStatusMessage['status']` (shared/types.ts) + `HostStatus.status` (electron/types.ts) + `tray.ts` switch-Statement
- **Alte Electron-Instanz** → `Get-Process electron | Stop-Process -Force` (PowerShell) — sonst blockiert Single-Instance-Lock
- **Electron frontend veraltet** → nach `npm run build -w @cwp/frontend` immer: `cd packages/electron && node build.mjs`
- **Lasso: lassoPointsRef synchron setzen** → direkt im Event-Handler, NICHT in `setLassoPoints(updater)` — React verarbeitet Updater asynchron
- **Lasso: lassoDidMove** → erst in `pointerDown` zurücksetzen, nicht in `pointerUp` — sonst löscht `onClick` die Selektion sofort
- **Zoom: @dnd-kit Transform ist screen-space** → `transform.x/y` durch `zoom` dividieren — sonst falsch skaliert
- **Zoom: Ctrl+Scroll** → nativen Listener mit `{ passive: false }`, `useAppStore.getState()` statt React-Closure

---

## Starten (Entwicklung)

```bash
# Settings anpassen: CompanionWebpannelSettings.json → hosts[0].host = deine Companion-IP

npm run dev                    # Backend :8080 + Frontend :5173 gleichzeitig
npm run dev -w @cwp/backend    # nur Backend
npm run dev -w @cwp/frontend   # nur Frontend

npm run electron:dev           # alles bauen + Electron starten
npm run release                # Release bauen (Win/Mac)

# Nach Änderungen an packages/shared/src/types.ts:
npm run build -w @cwp/shared
```

---

## Quellen

- Satellite API: `docs/satellite-api-protocol.md` (lokal, v1.10 / Companion 4.3+)  
  Update: `gh api "repos/bitfocus/website/contents/for-developers/Satellite-API.md" --jq '.content' | base64 -d > docs/satellite-api-protocol.md`
- companion-satellite Referenz-Impl.: https://github.com/bitfocus/companion-satellite
- Alle API-Quellen: `bitfocus-companion-module-sources.md`

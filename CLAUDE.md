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
| [docs/Webpanel-Architektur.md](docs/Webpanel-Architektur.md) | Architektur-Doku (aktuell, v1.1) |
| [docs/bitfocus-companion-module-sources.md](docs/bitfocus-companion-module-sources.md) | API-Quellen / Docs-Links |

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
    │       ├── Toolbar/                          ← Mode-Toggle, Panel-CRUD, ZoomControl, Status-Dots, Copy-to-Panel
    │       ├── HostManager/HostManagerModal.tsx  ← Host Add/Edit/Delete/Connect + HostEditModal (dediziertes Edit-Overlay)
    │       ├── Canvas/Canvas.tsx                 ← Element-Rendering + Textur-Layering + Zoom
    │       ├── PropertiesPanel/CompanionButtonMultiProps.tsx ← Batch-Edit für ≥2 selektierte CompanionButtons
    │       └── Elements/                         ← CompanionButtonElement, ShapeElement, LabelElement, ChannelStripElement, VirtualCompanionDeckElement
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
- ✅ **HostManagerModal UI-Überarbeitung** — Inline-Edit durch dediziertes `HostEditModal` ersetzt (560px, `maxHeight: 85vh`, scrollbar, z-Index 1300); kein Clipping mehr; Backdrop-Click schließt Modal; `editTarget: HostProfile | null | 'new'` State; handleEditSave via `s.hosts.some()` statt stale closure (Commit 1f5238e + c9b9bec, v1.3.1)
- ✅ macOS .icns Icon: `generate-app-icon.mjs` erzeugt `icon.icns` direkt (6 Größen, pure Node.js)
- ✅ Tray-Icons im Release-Build sichtbar — `assets/tray-*.png` fehlten in `electron-builder.yml` `files`-Liste (war nur in `buildResources`, nicht im App-Package)
- ✅ Version im Startup-Fenster — war hardcoded `v1.0.0`; jetzt `get-version` IPC → `app.getVersion()` → dynamisch aus `package.json` (Commit 4447d2d, v1.2.3)
- ✅ App-Icon im Startup-Fenster — `assets/icon-256.png` fehlte in `electron-builder.yml` `files`-Liste (Commit 4447d2d, v1.2.3)
- ✅ **Konfigurationsdatei nie auto-erstellen** — `configMissing = !fs.existsSync(activeSettingsPath)` deckt First-Run + verschobene Datei ab; kein Backend-Start wenn Missing; Startup-UI zeigt orangene Warnung; `apply-settings-path` schreibt nur meta.json + restartet (kein File-Copy mehr) (Commits f0205d4, 089eadb, v1.3.3)
- ✅ **Auto-Zoom springt auf 20% bei Wechsel View→Edit** — ResizeObserver Guard `if (width <= 0 || height <= 0) return` + `mode` in Deps-Array verhindert Phantom-Resize beim DndContext-Remount (Commit 15e8a26, v1.3.3)

### Toolbar / UI
- ✅ **"Copy to Panel" aus Toolbar ins PropertiesPanel** — Dropdown-Menü aus Toolbar entfernt; stattdessen im PropertiesPanel (unten, über Delete-Button) als aufklappbares Dropdown implementiert; `onSave` Callback via Canvas→App weitergereicht
- ✅ **App-Namen "Companion Webpanel" aus Toolbar entfernen** — `<span>` + nachfolgender Divider aus Toolbar entfernt
- ⬜ **KI-Antworten mit `help-me-KI-by_alex.md` testen** — prüfen ob ein KI-Agent mit dieser Datei als Kontext das Panel korrekt konfigurieren kann (ChannelStrip, Button-Mapping, Variablen etc.)
- ✅ **Copy/Paste-Style Icons vergrößern und verbessern** — ⎘/⎗ ersetzt durch `content_copy` / `content_paste` Material Icons (fontSize 20) im PropertiesPanel-Header
- ✅ **Link zur `settings.json` in HelpModal ergänzen** — neuer Abschnitt im KI-Tab: Titel + Beschreibung + `↗`-Link auf `/api/settings` (öffnet in neuem Tab)
- ✅ **HelpModal Settings → Ordner öffnen (Electron)** — `ipcMain.handle('open-settings-folder', () => shell.openPath(userDataPath))`; `openSettingsFolder` in `preload.ts` contextBridge; HelpModal zeigt Button wenn `cwpApi.openSettingsFolder` vorhanden (Electron), sonst `/api/settings`-Link (Browser) (v1.3.2)

### Edit-Mode
- ⬜ Ctrl+C / Ctrl+V (Copy/Paste wie Duplicate mit +75px Versatz)
- ✅ **Host-Label im Edit-Mode einblendbar** — `label`-Icon-Button in Toolbar (Edit-Mode); `showHostLabels` im Store (transient); CompanionButtonElement zeigt semi-transparentes Label (Host-Name, 8px, unten) wenn aktiv
- ✅ **Schrift-Skalierung bei kleinen Buttons** — `effectiveFontSize = Math.min(fontSize, Math.max(7, Math.floor(element.h * 0.22)))` in CompanionButtonElement; `overflow: 'hidden'` auf textStyle
- ✅ **Named Layer System** — 4 feste Layer: 0=Background, 1=Lower, 2=Main, 3=Overlay; `layer?: number` auf `BaseElement`; `defaultLayerFor(type)` exported aus `@cwp/shared`; PropertiesPanel zeigt 4 Layer-Buttons (Einzel- + Mehrfach-Selektion) + 2 Within-Layer-Pfeile (nur Einzel); `moveToLayer()` im Store; `EditableElement` zIndex-Formel korrigiert (`layer*1000+z+100`); Canvas-Sort auf Layer-Formel umgestellt (v1.3.2)
- ✅ Canvas-Größe manuell: Preset-Dropdown + custom W/H-Inputs + letzte 5 Größen in localStorage; DPI-Warnung + "Verfügbaren Bereich übernehmen"-Button
- ✅ Canvas Grid Snap für alle Elemente: Drag + Resize snappen auf `gridSize/4` (feines Raster)
- ✅ Resize Snap: `snapResizeGeo()` in `geometry.ts`, angewandt in `ResizeHandles.tsx` (nur gezogene Kante snappt)
- ✅ Edit-Mode Grid: Dual-Grid im `backgroundImage` des Canvas — Major-Linien bei `gridSize` (14% opacity), Minor bei `gridSize/4` (5% opacity); `minHeight: 100%` am Scale-Root-Div fixes dynamische Canvas-Größe

### CompanionButton
- ✅ **Physical Style** — opt-in `physicalStyle?: boolean` in render; aktiviert silber-metallischen Rahmen + kreisförmige konkave Dom-Fläche (CSS radial-gradients); Companion bgColor tönst Dom; Pressed-State skaliert Dom auf 0.97; `lightenHex`/`darkenHex`/`buildDomeBackground` als testbare Exports; Toggle-Checkbox in PropertiesPanel nach Border-Radius (Commits 0c0dafe–92b3373, Settings v1.5.0 — kein Bump nötig)
- ✅ **Host-Verbindungsfehler-Hinweis (caps-disabled)** — orangene Info-Box direkt unter Host-Card wenn `sessionStatus === 'caps-disabled'`; zeigt Companion-Pfad zur Einstellung; i18n-Keys `capsDisabledTitle` / `capsDisabledPath` (Commit 9d13acd + 0b3181c, v1.3.1)
- ✅ **Multi-Button Badge-Editing** — `CompanionButtonMultiProps` erscheint bei ≥2 selektierten CompanionButtons; Felder: hostId, showBgColor, showBitmap, showText, textAlign, borderRadius, physicalStyle, fontSize; mixed-state via `indeterminate` Checkbox + "—" Placeholder; `patchRender()` / `patchHostId()` überschreiben nur geänderte Felder (Commits 8d79165 + 6b206d9, v1.3.1)

### Panel-Workflow / Show-Vorbereitung
- ✅ **Buttons zwischen Panels kopieren** — Toolbar-Button (content_copy Icon) im Edit-Mode bei ≥1 Selektion; Dropdown listet alle anderen Panels; `copyElementsToPanel(src, tgt, ids)` kopiert mit neuen UUIDs + +75px Offset; `onSave?.()` danach (Commit 206d58e + 5f267ae, v1.3.1)
- ✅ **Panel duplizieren in Panel-Liste** — ⧉-Icon (content_copy) in Panel-Dropdown-Zeile zwischen ✎ und ✕; `duplicatePanel(id)` klont Panel + alle Elemente mit neuen UUIDs, Name `"<Name> Copy"`, wechselt automatisch zum neuen Panel (Commit 2d8cdde, v1.3.1)

### CompanionButton-Picker
- ⬜ Page-Name anzeigen — Companion sendet Page-Namen via Satellite API (prüfen ob `PAGE-NAME` verfügbar)

### ChannelStrip (nächste Iteration)
- ✅ **Fader per Touch/Maus bedienbar** — vertikaler Pointer-Drag → SUB-ROTATE; `setPointerCapture` für konsistentes Tracking
- ✅ **Drum Wheel ausblendbar** — `showWheel` Flag in `style` + Checkbox in PropertiesPanel
- ✅ **Solo-Button nur sichtbar wenn konfiguriert** — `hasSolo = !!refs.solo`, kein Grayout mehr
- ✅ **Pan-Section nur sichtbar wenn konfiguriert** — `{refs.pan && ...}`, Pan-Label entfernt
- ✅ **Clip-LED neu positioniert** — absolut über Name-Text, kein Platzverlust; blinkt nur beim Clipping
- ✅ **Helleres Grau Hintergrund** — `#3a3d46 → #2d3038`, Buttons inaktiv `#202226 → #16181c`
- ✅ **Fader-Knob gerippte 3D-Textur** — `repeating-linear-gradient` + weiße Mittellinie
- ✅ **Drum Wheel Mausrad-Optik** — `borderRadius:10`, dunkle Gummirippen, zylindrischer Lichtreflex
- ✅ **VirtualCompanionDeck Opacity-Fix** — `hexToRgba()` — Opacity gilt nur für Hintergrund, nicht Buttons
- ✅ **Per-Button Bitmap-Auflösung** — `render.bitmapSize` (72/100/144/200 px) in `CompanionButtonProps` (Select unter showBitmap) + `CompanionButtonMultiProps` (Batch mit Mixed-State); SatelliteClient `subscribe(…, bitmapSize)` übergibt `BITMAP=N` an ADD-SUB; HostManager `realSubSizes: Map<string,Map<string,number>>` erkennt Größenänderung → automatischer Re-Subscribe; mehrere Elemente auf gleichem Button → MAX-Auflösung (v1.3.5)
- ⬜ **Mute → Meter in Blautönen** — wenn Channel gemuted, Meter-Balken statt Grün/Gelb/Rot in verschiedenen Blautönen anzeigen (visuelles Feedback dass Channel stumm ist)

### Virtual Companion Deck (nächste Iteration)
- ✅ **Grid editierbar in PropertiesPanel** — cols + rows als NumericInput; Grid-Änderung triggert Backend-Session-Restart (Companion bekommt neue Dimensionen)
- ✅ **Button-Render-Settings angleichen an CompanionButtonElement** — showBgColor, scaleBitmap (konditionell), textAlign Dropdown, natives Color-Picker-Widget
- ✅ **Fallback-Buttonfarbe konfigurierbar** — `emptyButtonColor` in render-Objekt + PropertiesPanel Color-Picker
- ✅ **Status-Bug gefixt** — initialer `connecting`-Status wird jetzt emittet; neue Frontend-Clients bekommen `vSessionStatus` beim Connect
- ✅ **PropertiesPanel-Layout** — auf CompanionButtonProps-Niveau (lbl/row/sel-Style, 20px Checkboxen, grote Selects)

### Hilfe & KI-Dokumentation
- ✅ **HelpModal** — `?`-Button öffnet 3-Tab-Modal (KI / Shortcuts / Features) (Commit 5edc871)
- ✅ **`help-me-KI-by_alex.md`** — KI-optimierte Komplettbeschreibung als Download im HelpModal (Commit 6948519)

### Code Review v1.3.0 — Umgesetzt (Commit 885c7f4)
- ✅ **P0 Breaking-Fixes** — Body-Size-Guards auf POST-Endpoints (DoS-Schutz), Keepalive-Timer-Clear vor Überschreiben (SatelliteClient + VirtualSurfaceSession), lineBuffer-Overflow-Guards (10 MB), broadcast try/catch, Backend-Stop-Fehler abgefangen, Cache-Clear fire-and-forget
- ✅ **P1 Startup + Bundle** — Startup-Fenster sofort + Backend async im Hintergrund (−500…−2000 ms), electron-builder `asar` + `compression: maximum` + `removePackageScripts`, esbuild `minify` + `sourcemap: false` für Release, unused root-deps entfernt (`@esbuild/win32-arm64`, `@rollup/*-arm64-msvc`; `electron` → devDependency), Vite-Build mit `manualChunks` (react-vendor 142 KB, dnd-kit 37 KB, i18n 56 KB)
- ✅ **P1 Performance** — Bitmap-Cache (500-Entry FIFO + shared Canvas) in `utils/bitmap.ts`, StateStore Sekundär-Index (`hostIndex`/`deviceIndex`) macht `clearHost` O(k) statt O(n), `PARAM_REGEX` als Modul-Konstante, `serveStatic` async (`fs.promises.stat`)
- ✅ **P2-1 + P3-4** — Kompaktes JSON in `/api/settings` GET (kein pretty-print), Material Icons via `material-icons` npm-Paket lokal gebundled (Offline-fähige PWA, ~128 KB woff2)
- ✅ **Release v1.3.0** — `CompanionWebpanel-1.3.0.exe` 79 MB portable (Win x64), Tag `v1.3.0` lokal (nicht gepusht)
- ✅ **Release v1.3.1** — HostEditModal, caps-disabled Hinweis, Copy-to-Panel, Panel Duplicate, Multi-Button Editing; `CompanionWebpanel-1.3.1.exe` portable (Win x64), Tag `v1.3.1` lokal (nicht gepusht)
- ✅ **Release v1.3.2** — Named Layer System (4 Layer, Multi-Select, EditableElement/Canvas-Sort-Fix), HelpModal Settings-Ordner öffnen (Electron IPC); `CompanionWebpanel-1.3.2.exe` portable (Win x64), Tag `v1.3.2` lokal (nicht gepusht)
- ✅ **Release v1.3.3** — Config-file never auto-create (First-Run + verschobene Datei), Startup-UI Warnung, Auto-Zoom Fix (View→Edit); `CompanionWebpanel-1.3.3.exe` portable (Win x64), Tag `v1.3.3` lokal (nicht gepusht)
- ✅ **Release v1.3.4** — Satellite protocol fixes (parseParams für ApiVersion), version-error Status bei zu alter Companion-Version; `CompanionWebpanel-1.3.4.exe` portable (Win x64), Tag `v1.3.4` lokal (nicht gepusht)
- ✅ **Release v1.3.5** — Per-Button Bitmap-Auflösung (72/100/144/200 px): Select in CompanionButtonProps + MultiProps, SatelliteClient BITMAP=N per ADD-SUB, HostManager Re-Subscribe bei Größenänderung; VirtualSurfaceSession-Test-Fix (CAPS-Flow); `CompanionWebpanel-1.3.5.exe` portable (Win x64), Tag `v1.3.5` lokal (nicht gepusht)

### Code Review — Noch offen (P2/P3, nach Bedarf)
- ⬜ **P2-2** i18n-Strings IPC-Handler cachen (Zeile 136-146 `main.ts`), bei `changeLanguage` neu bauen
- ⬜ **P2-3** Zustand-Store `selectedIds: Set` bricht Shallow-Equality — zu `string[]` oder `useShallow` umstellen
- ⬜ **P2-4** `PropertiesPanel.selectedElements` per `useMemo` statt inline-Filter
- ⬜ **P2-5** Canvas-Grid: 4× `repeating-linear-gradient` pro Repaint → SVG-Pattern oder Canvas-PNG als `backgroundImage`
- ⬜ **P2-6** Undo-Stack unbounded — Limit auf 20-30 Snapshots (`saveUndoSnapshot` in `useAppStore.ts`)
- ⬜ **P2-7** `icon-512.png` prüfen und ggf. aus `packages/electron/assets/` + `electron-builder.yml` entfernen (~30 KB)
- ⬜ **P2-8** React.StrictMode nur in DEV (`main.tsx`) — Prod eh kein Effekt, aber sauberer
- ⬜ **P2-9** `useWebSocket`: `addEventListener`/`removeEventListener` + `useCallback`-Deps stabilisieren
- ⬜ **P3-1** `process.on('exit')` + async stop: durch `app.on('before-quit', e => { e.preventDefault(); shutdown() })` ersetzen
- ⬜ **P3-2** SatelliteClient Reconnect-Backoff prüfen — Exponential statt fester Delay
- ⬜ **P3-3** `@cwp/shared` Alias in `vite.config.ts` auf `dist/types.js` statt TS-Source zeigen lassen

Plan-Datei mit vollständigen Fix-Details: [docs/plans/2026-04-19-code-review-v1.3.0.md](docs/plans/2026-04-19-code-review-v1.3.0.md)

### Zukünftige Features (geplant)
- **Panel Export/Import** (~2–3h): `.cwp`-Datei (JSON) pro Panel; hostId-Mapping-Dialog beim Import
- **Host-ID Remapping** (~3–5h): alle Button-Referenzen von hostId A → B umschreiben

---

## Dev-Gotchas

- **ELECTRON_RUN_AS_NODE** → Claude Code und VS Code setzen `ELECTRON_RUN_AS_NODE=1`. `npm run electron:dev` löscht es via `scripts/launch-electron.mjs`. Bei manuellem Aufruf: `ELECTRON_RUN_AS_NODE= electron packages/electron` oder separates Terminal.
- **Settings-Version bump** → immer **6 Stellen** anfassen: `schema.json` + `types.ts` + `backend/standalone.ts` + `backend/server/ClientServer.ts` + `CompanionWebpannelSettings.json` + `electron/src/settingsHelper.ts` (getDefaultSettings + Migration)
- **shared neu bauen nach Typänderungen** → `npm run build -w @cwp/shared` — sonst kompiliert Backend gegen alten Stand
- **vitest/esbuild strippt TypeScript** → Type-Fehler nicht als Test-Failures sichtbar. TS-Check: `npx tsc --noEmit -p packages/frontend/tsconfig.json`
- **Test-Fixture-Version** → `makeSettings()` in `useAppStore.test.ts` verwendet `version: '1.4.0'` — bei Version-Bump anpassen
- **vitest Backend-Build** → `packages/backend/tsconfig.json` braucht `skipLibCheck: true` — vitest-Typen sind inkompatibel mit `module: CommonJS`
- **caps-disabled Status** → konsistent in 3 Stellen: `SessionStatusMessage['status']` (shared/types.ts) + `HostStatus.status` (electron/types.ts) + `tray.ts` switch-Statement
- **Alte Electron-Instanz** → `Get-Process electron | Stop-Process -Force` (PowerShell) — sonst blockiert Single-Instance-Lock
- **Electron frontend veraltet** → nach `npm run build -w @cwp/frontend` immer: `cd packages/electron && node build.mjs`
- **Lasso: lassoPointsRef synchron setzen** → direkt im Event-Handler, NICHT in `setLassoPoints(updater)` — React verarbeitet Updater asynchron
- **Lasso: lassoDidMove** → erst in `pointerDown` zurücksetzen, nicht in `pointerUp` — sonst löscht `onClick` die Selektion sofort
- **Zoom: @dnd-kit Transform ist screen-space** → `transform.x/y` durch `zoom` dividieren — sonst falsch skaliert
- **Zoom: Ctrl+Scroll** → nativen Listener mit `{ passive: false }`, `useAppStore.getState()` statt React-Closure
- **Canvas-Select rubber-band** → `CanvasSettings` select-Wert als lokaler `useState`, NICHT von `detectPreset()` ableiten. Sonst: 'custom' setzen → 1920×1080 default → `detectPreset` erkennt Fixed-Preset → Select springt zurück → Inputs nie sichtbar.
- **NumericInput in 2-Spalten-Grid** → immer `compact` prop übergeben — sonst quetschen ±-Buttons (je 44px) das Input-Feld auf ~30px.
- **Scrollbar-Feedback-Loop** → `overflow:auto` + `minWidth:'100%'` + fixer Canvas-Breite: 1px Overflow → Scrollbar (17px) → `100%` schrumpft → Canvas > `100%` → beide Scrollbars locked. Fix: bei fixem Canvas kein `min*:'100%'`; ResizeObserver auf äußerem Container → `overflow:hidden` wenn Canvas passt, `overflow:auto` wenn nicht.
- **Windows-DPI-Skalierung** → User sieht "1920px" (physisch), Canvas braucht CSS-px = physisch/scaleFactor. Toolbar-Höhe = 56px. Verfügbare Canvas-Fläche: `window.innerWidth × (window.innerHeight - 56)`. `window.devicePixelRatio > 1` → Warnung zeigen.
- **Alte Electron-Instanz killen (bash)** → `powershell.exe -Command "Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force"`
- **electron-builder `buildResources` ≠ `files`** → `buildResources` zeigt nur wo Build-Ressourcen (icon.ico) für den Installer liegen. Dateien die die App zur Laufzeit braucht (z.B. `assets/tray-*.png`) müssen explizit in `files` stehen.

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
- Alle API-Quellen: `docs/bitfocus-companion-module-sources.md`

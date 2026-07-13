# Implementierungs-Historie (abgeschlossene Phasen)

## Phase 1 — Repo aufsetzen ✅ FERTIG
Monorepo (npm workspaces), TypeScript-Konfiguration, shared types, Beispiel-Settings

## Phase 2 — Backend (Satellite-Broker) ✅ FERTIG
- `SatelliteSession`: WebSocket → Companion, ADD-DEVICE, KEY-STATE parser, PING/PONG, REMOVE-DEVICE, Exponential Backoff
- `StateStore`: In-Memory Delta-Store
- `ClientServer`: HTTP (GET /api/settings) + WebSocket-Server für Browser (Port 8080), Snapshot bei neuem Client
- `SessionManager`: Orchestrierung, press-Routing
- `index.ts`: Entry Point, Graceful Shutdown (SIGINT/SIGTERM)

## Phase 3 — Frontend Canvas + Edit-Mode ✅ FERTIG
- `CompanionButtonElement`: bgColor, Bitmap, Text-Overlay, mehrzeilig, States, `render.fontSize`
- `ShapeElement`, `LabelElement`: vollständig
- Edit-Mode: Drag (@dnd-kit), Resize (custom PointerEvents), Rubber-Band Selektion
- `PropertiesPanel`: Overlay, GeometryBlock, element-spezifische Props, Canvas-Settings
- Keyboard-Shortcuts vollständig (V/E/G/S/Del/Esc/Ctrl+S/Z/Y/D + Nudge)
- Panel-Auswahl als Dropdown in Toolbar (Sidebar entfernt)
- 28/28 Tests grün

## Phase 3.5 — Element-Hinzufügen ✅ FERTIG (Session 2026-04-03)
- `AddElementMenu`: Toolbar `+`-Button + Canvas Rechtsklick (nur Edit-Mode)
- `CompanionButtonPickerDialog`: Host/Page-Dropdown + Mini-Grid aus Store-State
- `addElement()` / `addPageAssignment()` Store-Actions
- Shape immer hinter anderen Elementen (z-Sentinel-Logik)
- CompanionButton Ref (Page/Row/Col) im PropertiesPanel editierbar
- Backend: `SessionManager.update()` — neue Sessions nach Ctrl+S starten (kein Neustart nötig)
- 32/32 Tests grün, letzter Commit: `208702d`

## Phase 3.6 — Touch-UX ✅ FERTIG (Session 2026-04-03)
- `EditableElement`: `touch-action: none` → Shape/Label Touch-Drag funktioniert mit 1 Finger
- `NumericInput`: ±-Buttons (44px) für Touch, `compact`-Prop für enge 2-Spalten-Layouts
- `GeometryBlock`: 2-Spalten ohne Buttons (compact), Position+Größe in einer Card
- `PropertiesPanel`: Breite 280→320px, mehr Abstände, Sections klarer getrennt
- `CompanionButtonProps`: Ref-Picker nur aktiv wenn Host verbunden (`hostConnected` Check)
- `CompanionButtonPickerDialog`: Page-Input als NumericInput mit ±-Buttons; Dialog positioniert neben PropertiesPanel
- Letzter Commit: `38e5cc1`

## Phase 4 — Refactor: SatelliteClient (Button Subscriptions API) ✅ FERTIG (Session 2026-04-03)
- `SatelliteClient.ts`: ADD-SUB/REMOVE-SUB/SUB-PRESS/SUB-STATE, PING/PONG Keepalive, Reconnect mit Re-Subscribe
- `HostManager.ts`: 1 Client pro Host, Subscription-Diff auf Panel-Elementen, Picker-Subscriptions temporär
- `StateStore.ts`: Key-Format `hostId:page:row:col` (kein keysPerRow mehr)
- `ClientServer.ts`: `POST/DELETE /api/preview-page` für Button-Picker Live-Vorschau; Schema 1.2.0
- Frontend: `sessionStatus` per Host, `getButtonState(h,p,row,col)`, Picker ohne pageAssignments
- Letzter Commit: `7457936`

## Phase 5 — Host-Verwaltung UI ✅ FERTIG (Session 2026-04-05)
- ✅ Host hinzufügen/entfernen/bearbeiten — `HostManagerModal`
- ✅ Verbindungsstatus live in Toolbar (Status-Dots pro Host)
- ✅ Companion-Version + API-Version anzeigen (Tooltip + Modal)
- ✅ Warnung wenn `CAPS SUBSCRIPTIONS=0` — Toolbar Badge
- ✅ Panel-Verwaltung: Create/Rename/Delete im Toolbar-Dropdown
- ✅ Speichern-Button mit Material Icon + Flash-Animation
- ✅ Canvas-Texturen (8 Optionen in PropertiesPanel → Canvas-Einstellungen)
- ✅ Bug-Fix: Canvas-Settings-Änderung sprang auf erstes Panel (setSettings preserviert activePanelId)
- 50/50 Tests grün

## Phase 6 — Electron Wrapper ✅ FERTIG (Session 2026-04-06)
Design-Spec: `docs/superpowers/specs/2026-04-05-electron-tray-design.md`
Implementierungsplan: `docs/superpowers/plans/2026-04-05-electron-tray.md` (13 Tasks)

Alle 13 Tasks erledigt:
1. ✅ Settings v1.3.0 (+server.port)
2. ✅ ClientServer: staticDir-Parameter (Frontend-Serving im Packaged-Build)
3. ✅ HostManager: onStatusChange Callback + createBackend() Factory
4. ✅ Electron Package Scaffolding (package.json, tsconfig, build.mjs, esbuild)
5. ✅ portCheck.ts + 5 Tests
6. ✅ settingsHelper.ts + 6 Tests (load/save/migrate aus userData)
7. ✅ AppStatus / HostStatus Types (IPC-Payload)
8. ✅ startup.html (Port-Edit, Auto-Badge, Host-Status-Dots, Open/Quit)
9. ✅ preload.ts (contextBridge: cwpApi)
10. ✅ startupWindow.ts (400×240 frameless, hide-on-close)
11. ✅ tray.ts (connected/partial/error Icons, Kontextmenü)
12. ✅ main.ts (Single-Instance-Lock, Boot-Sequenz, IPC-Handler, graceful shutdown)
13. ✅ electron-builder.yml + npm Scripts (build:electron, electron:dev, release)

## Phase 6.1 — Icons ✅ FERTIG (Session 2026-04-06)
- ✅ Tray-Icons (16×16, 3 Varianten): Button-Grid Design + Status-Dot — `generate-icons.mjs`
- ✅ App-Icon: icon.svg → icon-512.png + icon-256.png + icon.ico
  - Design: 3×3 farbige Buttons (links) + 3 vertikale Meter-Bars Grün/Blau/Orange (rechts)
  - Pure Node.js Renderer (2× Supersampling, kein externes Dep) — ARM64-kompatibel
- Für macOS .icns: icon-512.png → cloudconvert.com

## Phase 6.2 — Electron UX-Fixes + Panel APP-Modus ✅ FERTIG (Session 2026-04-08)
- ✅ Startup-Fenster: App-Icon, Hide-Button, Apply-Button für Port-Änderung
- ✅ Tray: "Open in App" + "Open in Browser"
- ✅ Quit-Dialog: native `dialog.showMessageBox()`
- ✅ Panel APP-Modus: `PanelWindow` — natives Electron-Fenster ohne Browser-Chrome (1280×720, resizable, focus-if-open)
- ✅ start-panel.bat — Start-Skript für einfachen Launch

## Phase 7 — ChannelStrip Element ✅ FERTIG (Session 2026-04-10)
Design-Spec: `docs/superpowers/specs/2026-04-09-channelstrip-design.md`
Implementierungsplan: `docs/superpowers/plans/2026-04-09-channelstrip.md`

- ✅ `ChannelStripElement` Interface in `shared/src/types.ts` + `AnyElement` Union
- ✅ `RotateMessage` + `FrontendToBackend` union erweitert
- ✅ `SatelliteClient.rotate()` → `SUB-ROTATE SUBID=... DIRECTION=±1`
- ✅ `HostManager.handleRotate()` + `buildDesiredSubs()` für channelStrip refs
- ✅ `ClientServer.onRotate` Handler (8. Param vor staticDir)
- ✅ `useWebSocket.sendRotate()` im Frontend-Hook
- ✅ `utils/channelStrip.ts` — `parseChannelStripText()`, `parsePanValue()`, `isMuted()` (luminance > 0.15)
- ✅ `ChannelStripElement.tsx` — MeterBar, Drum-Wheel, PeakHold, Pan-Indicator, Mute/Solo
- ✅ `ChannelStripProps.tsx` — Refs + Text-Parsing + Style im PropertiesPanel
- ✅ `ChannelStripWizard.tsx` — 5-Schritt Setup-Wizard, z-Index 1050 (Picker bei 1100)
- ✅ `AddElementMenu` — channelStrip Eintrag + Wizard-Integration
- ✅ 82/82 Tests grün

ChannelStrip-Fixes (Session 2026-04-10b):
- ✅ Fader Level Schriftgröße: `fontSize: 10` → `12px`
- ✅ Wheel visuelles Feedback: Höhe 28→38px, Rippen-Gradient, Drag-Glow
- ✅ Meter Farbzonen Broadcast-Standard + `backgroundSize+backgroundPosition: bottom` Fix
- ✅ Peak Hold violett `#b060ff`
- ✅ Fader-Knob: `bottom: X%` statt `top`
- ✅ Solo/Mute vertikal: Solo oben, Mute unten
- ✅ Default-Größe: `w: 80, h: 240` → `w: 130, h: 500`

## Panel Zoom ✅ FERTIG (Session 2026-04-10c)
Design-Spec: `docs/superpowers/specs/2026-04-10-zoom-and-host-grid-design.md`
Implementierungsplan: `docs/superpowers/plans/2026-04-10-zoom-and-host-grid.md`

- ✅ `setZoom(panelId, zoom)` Store-Action mit Clamp [0.2, 2.0]
- ✅ `ZoomControl.tsx` — Icon-Button (`zoom_in`) + Popover-Slider (20–200%, Step 5%)
- ✅ Canvas: Drei-Ebenen-Layout (scroll-wrapper → size-reserve → scale(zoom) → canvas)
- ✅ Koordinaten durch Zoom dividiert: `getCanvasPos`, `handleContextMenu`, `handleDragEnd`, `ResizeHandles`, `EditableElement` group-drag
- ✅ Ctrl+Scroll mit `{ passive: false }` → ±5% pro Tick
- ✅ Zoom wird in `panel.zoom` gespeichert (Ctrl+S)

## CompanionButton-Picker — Grid-Größe aus Host-Konfiguration ✅ (Session 2026-04-10)
- ✅ `HostProfile` um `gridCols?: number` und `gridRows?: number` erweitert
- ✅ `CompanionButtonPickerDialog` + `ChannelStripWizard` lesen Host-Default beim Öffnen (Resync bei Host-Wechsel)

> Zwischenstände v1.1–v1.3.5 (VirtualDeck, Layer-System, Physical Style, Multi-Button-Editing, Releases usw.): siehe CLAUDE.md → „Nächste Session — Offene Aufgaben" (✅-Einträge mit Commit-Referenzen).

## Phase 8 — Companion 5.0 Adoption ✅ FERTIG (Session 2026-07-13, v1.4.0/v1.4.1)
Plan + Live-Test-Ergebnisse: `memory/plan-2026-07-13-companion-5-adoption.md` (11/11 Protokoll-Tests PASS gegen Companion 5.0.0 / API 1.12.0)

- ✅ **A — WebP/PNG-Bitmaps** (`931c726`): CAPS `BITMAP_FORMATS`-Negotiation in SatelliteClient + VirtualSurfaceSession, `BITMAP_FORMAT` auf ADD-SUB/ADD-DEVICE, Frontend Data-URL-Passthrough — ~17× kleinere Button-Updates
- ✅ **D — Doku-Refresh** (`fa7ac59`): satellite-api-protocol.md auf 1.12, ws-protocol, CLAUDE.md-Korrekturen
- ✅ **B — mDNS-Auto-Discovery** (`ec1f5b7`): `DiscoveryService` (@julusian/bonjour-service), Browse-on-demand via HostManagerModal, „Gefundene Companion-Instanzen"-Sektion mit Übernehmen-Button
- ✅ **C — Non-square Bitmaps** (`bc08f07`): `deriveBitmapDims()` (Aspect-Quantisierung), HostManager `realSubDims` ("WxH"), SatelliteClient STYLE-Branch mit 4.3-Legacy-Fallback
- ✅ **E — Seitennamen im Picker** (`f428e4c`): Schema-Bump 1.8.0 (`httpPort` + Migration), `PageNameResolver` + `GET /api/page-name(s)`, Picker-Merge (lokal > Companion > Nummer)
- ✅ **Seitennamen-Batch** (`b873cda`): `resolveMany()` Worker-Pool → alle Namen beim Picker-Öffnen (99 Namen ~145 ms)
- Releases: `v1.4.0` (`e721348`) + `v1.4.1` (`ecb3d43`), Tags lokal; Backend 51 / Electron 20 / Frontend 128 Tests grün

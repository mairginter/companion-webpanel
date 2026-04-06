# CLAUDE.md – Companion Webpanel Projekt

Dieses File beschreibt Ziel, Entscheidungen, Architektur und nächste Schritte des Projekts.
Es ist der Einstiegspunkt für neue Sessions — lies es zuerst, bevor du irgendwas baust.

---

## Was wird gebaut

Ein **lokal laufendes Webpanel als PWA** für Bitfocus Companion, erreichbar im LAN (PC, Mac, Tablet).  
Es spiegelt Companion-Buttons in Echtzeit (Bitmap, Farbe, Text) und löst Button-Presses aus.

**Primärer Anwendungsfall:** Live-Produktion (Streaming/Broadcast) — der User steuert OBS/vMix/NDI-Workflows über ein frei gestaltbares Touch-Panel.

---

## Alle getroffenen Entscheidungen (nicht mehr diskutieren)

| Entscheidung | Wert | Grund |
|---|---|---|
| API | Companion Satellite API (WebSocket) | Offizielle Remote-Surface API, Push-Updates, kein Polling |
| WS-Port | 16623 (Companion Standard seit 3.5) | WebSocket-Port — `net.Socket` (TCP) funktioniert NICHT |
| Satellite Mode | Simple Mode (MVP) | Kein Advanced/LAYOUT_MANIFEST im MVP |
| Bitmap-Größe | 72px (Companion Standard) | Was Companion liefert |
| Stack Backend | Node.js + TypeScript | Einheitlich mit Frontend, bewährtes Pattern |
| Stack Frontend | React + TypeScript (PWA) | Gute WS-Unterstützung, Memoization möglich |
| Deployment | Nur PWA (kein Electron/Tauri) | MVP-Fokus |
| Kiosk | Tablet: PWA Standalone / Desktop: Chrome `--app=` | Kein nativer Wrapper nötig |
| Persistenz | Lokale JSON-Datei `CompanionWebpannelSettings.json` | Einfach, kein Server-DB |
| Surface-Zuordnung | **Entfällt** — Button Subscriptions API (seit Companion 4.3 / API 1.10.0) | Kein ADD-DEVICE, kein Surface in Companion UI sichtbar |
| KEY-PRESS Timing | Echte Haltezeit (onPointerDown/Up/Leave/Cancel) | Long-Press-Aktionen in Companion funktionieren |
| Max. Connections | 1 SatelliteClient pro Host (statt 1 Session pro Page) | Alle Subscriptions über eine WS-Verbindung |
| Schema-Version | 1.3.0 | +server.port (Phase 6 Task 1 ✅); wizard/surfaceConfig entfernt — kein pageAssignment mehr nötig |
| Monorepo-Tool | npm workspaces | Kein extra Tool nötig, standard npm |
| Frontend Build | Vite + vite-plugin-pwa | Schnell, modernes HMR, PWA out-of-the-box |
| State-Management Frontend | Zustand | Minimal, kein Boilerplate, gut für WS-Deltas |
| Drag & Drop (Edit-Mode) | @dnd-kit | Modular, Touch-Support, freies Positionieren |
| Panel-Ansicht | Single-Panel (Sidebar-Wechsel) | Einfacher für Live-Produktion |
| bgColor-Anwendung | Auf gesamten Element-Container | Nicht nur 72px Bitmap — ganzer Button bekommt bgColor |
| Sidebar links | Einklappbar (Toggle-Button) | Mehr Canvas-Platz im View-Mode |
| Shortcut-Leiste | Entfernt → `?`-Menü in Toolbar | Weniger UI-Rauschen, Shortcuts bleiben zugänglich |
| REMOVE-DEVICE | Beim graceful shutdown senden | Companion UI sauber halten |
| Duplicate DEVICEID | Idempotent (selber Socket) | Companion entfernt altes Device automatisch bei Reconnect |
| Page via API setzen | **Entfällt** — keine Pages/Surfaces mehr nötig | Subscriptions arbeiten direkt mit PAGE/ROW/COL — kein Startup-Page-Setup |
| Desktop-Packaging | Electron 33 + electron-builder 25 | Startup-Fenster + Tray = Electron-Stärke; pkg wäre 40MB kleiner aber kein natives Fenster |
| Electron-Prozessmodell | Backend läuft direkt im Electron Main Process | Kein Child-Process — einfacher, kein IPC für Backend-Daten nötig |
| Electron-Build | esbuild bundelt main.ts + backend in dist/main.js | Löst Monorepo-Modul-Auflösung elegant — kein webpack nötig |
| Frontend im Electron-Build | build.mjs kopiert frontend/dist → electron/frontend/ | electron-builder inkludiert es via `files: [frontend/**]` |
| Static-File-Serving | ClientServer bekommt optionales `staticDir`-Param | Dev: undefined (Vite serviert auf :5173) · Packaged: app.getAppPath()/frontend |
| Settings-Version | 1.3.0 ✅ — `server.port` implementiert | Konfigurierter Backend-Port in JSON statt nur env-Variable |
| Port Auto-Fallback | findFreePort(configuredPort, 10) bei Start | Falls 8080 belegt → 8081…8089 testen; User sieht Auto-Badge im Startup-Fenster |
| Port manuell ändern | Startup-Fenster hat editierbares Port-Feld | Nur explizite Änderung wird in Settings gespeichert; Auto-Fallback ist Session-temporär |
| Edit-Mode Drag-Ansatz | Hybrid: @dnd-kit + DragDeltaContext | @dnd-kit für Drag-Logik, React Context für Group-Drag ohne per-frame Store-Updates |
| Edit-Mode Resize-Ansatz | Custom Pointer Events (kein @dnd-kit) | `setPointerCapture` für zuverlässiges Tracking auch über Canvas-Rand hinaus |
| Properties Panel Position | `position:absolute` Overlay (Canvas behält volle Breite) | Kein Canvas-Schrumpfen — Panel liegt über Canvas |
| Properties Panel Zustand | localStorage (`cwp:propsPanelSide`, `cwp:propsPanelOpen`) | Kein Store-State — reine UI-Präferenz |
| Properties Panel Controls | 2 Buttons: ⇄ Seite wechseln + ‹/› Einklappen | User kann Panel auf linke Seite flippen wenn rechte Buttons verdeckt |
| Snap Grid-Größe | `panel.grid.size` default 40px, Threshold 8px | Magnetisch: snap nur wenn < 8px von Grid-Linie entfernt |
| Undo/Redo | 1 Ebene (Snapshot vor/nach Geometry-Änderung) | MVP — kein voller Stack |
| Duplizieren Versatz | +75px / +75px | Mindestabstand wegen min. Button-Größe 72px |
| Redo-Shortcut | `Ctrl+Y` | (NICHT Ctrl+X — das ist Cut) |
| isContained-Pattern | Prop auf allen Element-Komponenten | Wenn `true`: `position:relative, 100%x100%` statt absolute — verhindert Doppel-Positionierung im EditableElement-Wrapper |
| Minimum-Größen Edit | companionButton: 72px, shape: 8px, label: 8px | companionButton = Bitmap-Größe, shape/label frei kleiner |
| Code-Datei-Header | Jede Datei bekommt Kurz-Beschreibung + ausführliche Inline-Kommentare | Entschieden Session 3 — Grund-Kommentare erwünscht |
| Canvas-Größe | `panel.canvas.width/height` undefined → dynamisch (ResizeObserver); Presets: 1920×1080, 1440×900, 1280×720, Benutzerdefiniert | Flexibel für verschiedene Bildschirmgrößen |
| Properties Panel Zahlenfelder | Mausrad ±1, Shift+Mausrad ±10; Pfeiltasten ±1/±10; Live-Preview auf Canvas; Store-Update bei `blur` / `Enter`; kein Speichern-Button im Panel | Kein Workflow-Unterbruch — Ctrl+S speichert alles |
| Properties Panel leer | Canvas-Einstellungen anzeigen (Größe-Preset + Hintergrundfarbe) | Sinnvoller Default wenn kein Element selektiert |
| Properties Panel Multi-Select | Nur Geometrie-Block sichtbar; unterschiedliche Werte → `—` (editierbar: setzt alle auf diesen Wert) | Konsistente Multi-Edit-Erfahrung |
| Rubber-Band Style | fill `rgba(74,158,255,0.08)`, stroke `#4a9eff` 1px | Konsistent mit `accent.blue` aus Design-System |
| Rubber-Band Shift | Shift+Rubber-Band fügt zur bestehenden Selektion hinzu | Einheitlich mit Shift+Klick |
| Edit-Mode Nicht-MVP | Kein proportionales Resize (Multi-Select), kein voller Undo-Stack, kein Z-Index manuell, kein `+`-Button, kein MeterElement | MVP-Fokus — Phase 4 |
| Multi-Agent Implementierung | NEIN — kein paralleles Arbeiten mehrerer Agenten | Datei-Konflikte möglich bei parallelen Schreibzugriffen. Sequenziell nach Plan-Reihenfolge. |
| Sidebar | Entfernt — Panel-Auswahl als Dropdown in Toolbar | Mehr Canvas-Platz, einfachere Navigation |
| Properties Panel Schriftgrössen | Labels 12px, Inputs/Selects 14px mit 8×10px Padding, Checkboxen 20×20px | Touch-freundlich (min 44px Hit-Area für Buttons) |
| CompanionButton Font-Size | `render.fontSize` konfigurierbar (default 11px, min 6px) | User kann Textgrösse pro Button anpassen |
| Companion Mindestversion | 4.3.0+ (Satellite API 1.10.0) | Button Subscriptions API erst ab 4.3 — getestet mit 4.3.0+9146 |
| Companion Setting | `satellite_subscriptions_enabled = true` | Muss in Companion Einstellungen aktiviert sein — `CAPS SUBSCRIPTIONS=1` prüfen |
| Surface löschen | Nur wenn kein Button in der Konfig mehr auf diese Page zeigt | Subscription wird entfernt sobald letzter Ref weg ist |
| Panel ohne Surface | Zulassen (stale-Anzeige reicht) | Kein Blocking — Button zeigt ⚠ bis Companion verbunden |
| Button Picker im Picker-Dialog | Temporäre Subscriptions beim Öffnen, REMOVE-SUB beim Schließen | Live-Preview im Mini-Grid ohne permanente Subscription |
| Canvas-Texturen | CSS `background-image` Overlay (SVG data-URI + linear-gradient); `TextureOption.backgroundSize` für Kachelung | `textures.ts` — 8 Optionen: none, leather, carbon, metal, linen, dots, hex, concrete |
| Textur-Kachelung | `TextureOption.backgroundSize?: string`; Canvas kombiniert DOT_GRID + Textur via `backgroundSize: 'auto, <size>'` | linear-gradient Texturen brauchen explizite backgroundSize zum Kacheln |
| HostProfile Felder | `autoConnect?: boolean`, `showInToolbar?: boolean` | autoConnect=false → kein SatelliteClient; showInToolbar=false → kein Status-Dot in Toolbar |
| Host-Verwaltung | `HostManagerModal` — Add/Edit/Delete, Verbinden/Trennen, inline im Modal | Kein separates Settings-Fenster — Modal direkt aus Toolbar |
| Host-Status in Toolbar | Status-Dots gefiltert nach `showInToolbar !== false`; Tooltip: Name, IP, Status, Version, Notizen | `⛔` wenn Host nicht mehr in Settings; `⚠` nur wenn Host existiert aber stale |
| Companion-Version | `SatelliteClient` speichert version nach `BEGIN`-Handshake; `HostInfoMessage` WS-Nachricht ans Frontend | `hostInfo` im Store pro `hostId` |
| Speichern-Button | Material Icon `save` in Toolbar, 600ms Flash-Animation bei Klick | Neben Panel-Dropdown; identisch mit Ctrl+S |
| Panel-Verwaltung Toolbar | Inline Rename (✎/blur), Delete (✕/disabled wenn letztes), `+ Neues Panel` mit ✓/✕ | Kein eigenes Modal — alles direkt im Toolbar-Dropdown |
| Material Icons | Google Fonts CDN (`Material Icons`) in `index.html` | `save` und `settings` Icons in Toolbar |
| setSettings Bug-Fix | `setSettings()` preserviert `activePanelId` wenn Panel noch existiert | War: immer auf `panels[0]` zurückgesprungen → Canvas-Settings-Änderung sprang auf erstes Panel |

---

## Projekt-Dateien (aktueller Stand)

```
CompanionWebpannel/
├── CLAUDE.md                                     ← diese Datei
├── Companion-Webpanel-Umsetzungsbeschreibung.md  ← Anforderungen (Referenz)
├── Webpanel-Architektur.md                       ← Architektur-Doku (aktuell, v1.1)
├── CompanionWebpannelSettings.schema.json        ← JSON-Schema v1.3.0 (+server.port ✅)
├── CompanionWebpannelSettings.json               ← Laufzeit-Konfiguration (Beispiel, anpassen!)
├── electron-builder.yml                          ← ✅ Release-Config Win+Mac (NSIS x64, DMG arm64+x64)
├── bitfocus-companion-module-sources.md          ← API-Quellen / Docs-Links
├── docs/satellite-api-protocol.md                ← Satellite API Protokoll-Referenz (v1.10 / Companion 4.3+)
├── docs/superpowers/
│   ├── specs/2026-04-01-edit-mode-design.md      ← ✅ Edit-Mode Design-Spec
│   ├── specs/2026-04-05-electron-tray-design.md  ← ✅ Electron Wrapper Design-Spec (Phase 6)
│   ├── plans/2026-04-01-edit-mode.md             ← ✅ Edit-Mode Implementierungsplan
│   └── plans/2026-04-05-electron-tray.md         ← ✅ Electron Wrapper Implementierungsplan (13 Tasks)
├── package.json                                  ← npm workspaces root (inkl. @cwp/electron ✅)
└── packages/
    ├── shared/src/types.ts                       ← Alle TypeScript-Typen (Settings, WS-Messages, Elemente)
    ├── backend/src/
    │   ├── satellite/SatelliteClient.ts          ← 1 pro Host, Button Subscriptions API, PING/PONG Keepalive
    │   ├── state/StateStore.ts                   ← In-Memory State + Delta-Logik (Key: hostId:page:row:col)
    │   ├── server/ClientServer.ts                ← HTTP (GET+POST /api/settings, POST+DELETE /api/preview-page)
    │   │                                            + WS-Server für Browser-Clients, stuck-press Fix
    │   │                                            + staticDir-Param für Frontend-Serving im Electron-Build ✅
    │   ├── HostManager.ts                        ← Orchestrierung: 1 SatelliteClient pro Host, Subscription-Diff
    │   │                                            + onStatusChange Callback für Electron-Tray ✅
    │   ├── index.ts                              ← Nur createBackend() Factory-Export für Electron ✅
    │   └── standalone.ts                         ← Standalone Entry Point (npm start/dev) mit loadSettings() + main()
    ├── frontend/src/
    │   ├── store/useAppStore.ts                  ← Zustand-Store (settings, buttons, sessionStatus, hostInfo, mode, activePanelId)
    │   │                                            addHost/updateHost/removeHost, createPanel/renamePanel/deletePanel
    │   ├── ws/useWebSocket.ts                    ← WS-Hook mit Auto-Reconnect (inkl. hostInfo handler)
    │   ├── api/useSettings.ts                    ← GET /api/settings beim Start + saveSettings() für POST
    │   ├── utils/bitmap.ts                       ← Raw-RGB base64 → Canvas Data-URL Konvertierung
    │   ├── utils/textures.ts                     ← ✅ Canvas-Texturen (8 Optionen, SVG+CSS-Gradienten, backgroundSize)
    │   ├── App.tsx + main.tsx                    ← App-Shell mit Keyboard-Shortcuts + HostManagerModal
    │   └── components/
    │       ├── Toolbar/Toolbar.tsx               ← ✅ Toolbar: Mode-Toggle, Panel-Dropdown (CRUD), Speichern, Status-Dots, ?-Button
    │       ├── HostManager/HostManagerModal.tsx  ← ✅ Host Add/Edit/Delete/Connect, inline Form, Delete-Dialog
    │       ├── Canvas/Canvas.tsx                 ← Canvas mit Element-Rendering + Textur-Layering
    │       └── Elements/
    │           ├── CompanionButtonElement.tsx    ← ✅ Vollständig (bgColor, Bitmap, Text, States, ⛔ hostMissing)
    │           ├── ShapeElement.tsx              ← ✅ Rechteck mit fill/stroke/borderRadius
    │           └── LabelElement.tsx              ← ✅ Statischer Text mit Style-Optionen
    └── electron/                                 ← ✅ Electron Wrapper (Phase 6 FERTIG)
        ├── src/
        │   ├── main.ts                           ← Entry Point + IPC-Handler (get-status, open-panel, change-port, quit)
        │   ├── preload.ts                        ← contextBridge (cwpApi)
        │   ├── startupWindow.ts                  ← BrowserWindow Lifecycle (400×240, frameless, hide-on-close)
        │   ├── tray.ts                           ← Tray-Icon + Kontextmenü (connected/partial/error Icon)
        │   ├── portCheck.ts                      ← isPortFree() + findFreePort()
        │   ├── settingsHelper.ts                 ← load/save/migrate aus userData-Dir
        │   └── types.ts                          ← AppStatus, HostStatus (IPC-Payload)
        ├── renderer/startup.html                 ← Startup-Fenster UI (Port-Edit, Host-Status, Open/Quit)
        ├── tests/
        │   ├── portCheck.test.ts                 ← 5 Tests ✅
        │   └── settingsHelper.test.ts            ← 6 Tests ✅
        └── assets/
            ├── icon.svg                          ← ✅ Vektordesign (Button-Grid + Meter-Bars, editierbar)
            ├── icon-512.png                      ← ✅ App-Icon 512×512 (macOS)
            ├── icon-256.png                      ← ✅ App-Icon 256×256
            ├── icon.ico                          ← ✅ Windows ICO (256px PNG-komprimiert)
            ├── tray-connected.png                ← ✅ 16×16 grün (alle Hosts verbunden)
            ├── tray-partial.png                  ← ✅ 16×16 orange (mind. 1 Host Fehler)
            ├── tray-error.png                    ← ✅ 16×16 rot (alle Hosts Fehler)
            ├── generate-icons.mjs                ← ✅ Tray-Icon Generator (pure Node)
            └── generate-app-icon.mjs             ← ✅ App-Icon Generator (pure Node, 2× Supersampling)
```

---

## Architektur (Kurzfassung)

```
[Companion] ←→ WS:16623 ←→ [Node Backend] ←→ WS ←→ [React PWA / Browser]
                              SatelliteClient (1 pro Host)
                              └── ADD-SUB pro referenziertem Button
                              └── SUB-STATE → StateStore
                              └── SUB-PRESS ← press-Events vom Browser
                              StateStore (In-Memory, pro hostId:page:row:col)
                              ClientServer (HTTP + WS auf :8080)
```

- **1 SatelliteClient pro Host** (nicht pro Page) — alle Subscriptions über eine WS-Verbindung
- Subscriptions sind **dynamisch**: neuer Button im Panel → sofort `ADD-SUB`, Button gelöscht → `REMOVE-SUB`
- Kein Surface in Companion UI sichtbar — keine Startup-Page-Konfiguration nötig
- Backend ist **State-Broker**: cached alle SUB-STATEs, sendet nur Deltas an Clients
- Frontend ist **stateless**: bekommt alles vom Backend, rendert nur was sich ändert

---

## Datenmodell (Kern)

### CompanionRef — zeigt auf einen Companion-Button
```typescript
{ hostId: string, page: number, row: number, col: number }
```
> `hostId` ist **required** — wird auf eine Satellite-Session gemappt.

### Panel.defaultMode
```typescript
"view" | "edit"
```
- **view**: Buttons lösen KEY-PRESS aus, kein Drag
- **edit**: Drag & Drop, Resize (min. = bitmapSize), kein KEY-PRESS

### enforceMinSize (CompanionButtonElement.render)
```typescript
enforceMinSize: true  // default
```
Verhindert, dass ein Button kleiner als `bitmapSize` (72px) gezogen wird.

---

## Element-Typen (vollständig)

| Typ | Beschreibung |
|---|---|
| `companionButton` | Spiegelt einen Companion-Button (ref: hostId+page+row+col) |
| `shape` | Rechteck zur visuellen Gruppierung (fill, stroke, borderRadius) |
| `label` | Statischer Text (color, fontSize, fontFamily, align) |
| `meter` | Audio-Meter, Quelle = TEXT-Feld eines Companion-Buttons (parser: "db") |

Alle Elemente erben `BaseElement`: `id, type, x, y, w, h, z, locked`.

---

## Satellite API — wichtigste Kommandos

### Button Subscriptions (ab API 1.10.0 / Companion 4.3.0) — **aktuelle Implementierung**

```
← BEGIN CompanionVersion="4.3.0+..." ApiVersion="1.10.0"
← CAPS SUBSCRIPTIONS=1                              (1=aktiviert, 0=in Companion Settings deaktiviert)

→ ADD-SUB SUBID=cwp/1/0/0 LOCATION=1/0/0 BITMAP=72 COLORS=hex TEXT=true TEXT_STYLE=true
← ADD-SUB OK SUBID="cwp/1/0/0"
← SUB-STATE SUBID="cwp/1/0/0" PRESSED=0 TYPE=BUTTON COLOR=#ff0000 TEXT=<base64> BITMAP=<base64> FONT_SIZE=auto

→ SUB-PRESS SUBID=cwp/1/0/0 PRESSED=true           (bei onPointerDown)
→ SUB-PRESS SUBID=cwp/1/0/0 PRESSED=false          (bei onPointerUp / onPointerLeave / onPointerCancel)
← SUB-PRESS OK SUBID="cwp/1/0/0"

→ REMOVE-SUB SUBID=cwp/1/0/0
← REMOVE-SUB OK SUBID="cwp/1/0/0"
```

> **SUBID-Format:** `cwp/<page>/<row>/<col>` — alphanumerisch + `-` + `/` erlaubt.
> **LOCATION-Format:** `<page>/<row>/<col>` — Companion native Syntax.
> **PING/PONG Keepalive ist nötig!** Companion schließt idle-Verbindungen nach ~5-7s. Client sendet `PING <ts>` alle 2s, erwartet `PONG` innerhalb 6s. Auch eingehende `PING` von Companion mit `PONG` beantworten.
> `CAPS SUBSCRIPTIONS=0` → User muss in Companion Settings „Button Subscriptions API" aktivieren.
> `FONT_SIZE="auto"` → ignorieren oder in `render.fontSize` mappen.
> Bei Socket-Close werden alle Subscriptions automatisch entfernt.

### ADD-DEVICE (alt, nicht mehr verwendet — Referenz)

```
→ ADD-DEVICE DEVICEID="..." PRODUCT_NAME="..." KEYS_TOTAL=64 KEYS_PER_ROW=8 BITMAPS=72 COLORS=true TEXT=true
← ADD-DEVICE OK DEVICEID="..."
← KEY-STATE DEVICEID=... KEY=30 TYPE=BUTTON COLOR=rgb(255,0,0) TEXT=Live BITMAP=<base64>
→ KEY-PRESS DEVICEID=... KEY=30 PRESSED=true/false
→ REMOVE-DEVICE DEVICEID="..."
```

> Nicht mehr verwenden — durch Subscriptions ersetzt. Dokumentiert für Referenz.

---

## Message-Protocol Backend ↔ Frontend (WebSocket)

```typescript
// Backend → Frontend (Delta: ein Key hat sich geändert)
{ t: "delta", hostId: string, page: number, row: number, col: number,
  bgColor?: string, textColor?: string, text?: string, bitmap?: string }

// Backend → Frontend (Snapshot: alle Keys einer Session — bei neuem Client-Connect)
{ t: "snapshot", hostId: string, page: number,
  keys: Record<string, KeyState> }   // "row:col" → { bgColor, textColor, text, bitmap }

// Backend → Frontend (Session-Status — pro Host, kein page)
{ t: "sessionStatus", hostId: string,
  status: "connecting" | "connected" | "stale" | "error" | "caps-disabled" }
// caps-disabled = CAPS SUBSCRIPTIONS=0, Toolbar zeigt orange Badge

// Frontend → Backend (Button-Press / Release)
{ t: "press", hostId: string, page: number, row: number, col: number, pressed: boolean }
```

> Backend-Port (Frontend-WS): 8080 (konfigurierbar via `CLIENT_WS_PORT` env)
> Settings-Pfad: `../../CompanionWebpannelSettings.json` oder `SETTINGS_PATH` env

---

## Edit-Mode vs. View-Mode (UI-Verhalten)

| | View-Mode | Edit-Mode |
|---|---|---|
| Button-Klick | KEY-PRESS an Companion | Element-Auswahl / Properties |
| Drag | deaktiviert | Elemente verschiebbar |
| Resize | deaktiviert | aktiv, min. = bitmapSize |
| Grid-Overlay | aus (wenn grid.enabled=false) | einblendbar |
| Elemente hinzufügen | nein | ja, über `+`-Button |
| Live-Mirror | aktiv | aktiv (Vorschau) |

---

## Frontend WS-Reconnect — wichtige Implementierungsdetails

### Race-Condition-Fix in `useWebSocket.ts`
- **Problem:** `onclose`-Handler einer alten Socket-Instanz setzte `ws.current = null`, obwohl `ws.current` bereits auf eine neue Socket-Instanz zeigte → alle Presses schlugen stumm fehl
- **Fix:** `if (ws.current === socket)` vor `ws.current = null` — nur nullen wenn diese Socket noch die aktuelle ist
- **Fix 2:** `connect()` bricht ab wenn readyState `CONNECTING` (0) oder `OPEN` (1) — verhindert doppelte Socket-Instanzen
- **Surface-Name:** Verwendet `os.hostname()` (Backend-Rechner) statt `hostId` (Companion-Server) — in Companion UI direkt erkennbar welcher Rechner das Panel betreibt

---

## Companion API — wichtige Erkenntnisse aus Implementierung

### Verbindungsprotokoll
- Port 16623 ist **WebSocket** (NICHT TCP `net.Socket`). `ws`-Library verwenden.
- Protokoll ist zeilenbasiert über WS-Text-Frames — `\n` als Delimiter, mehrere Zeilen pro Frame möglich → Line-Buffer im `message`-Handler nötig.

### Bitmap-Format
- Companion sendet Bitmaps als **Raw-RGB** (width × height × 3 Bytes, kein Header, kein JPEG/PNG).
- base64-Länge bei 72px: `72 × 72 × 3 = 15552 Bytes → 20736 Zeichen base64`.
- Konvertierung: Raw-RGB → RGBA (α=255) → `ImageData` → Canvas → `.toDataURL('image/png')` (siehe `utils/bitmap.ts`).
- Erkennungslogik: Wenn `base64.length ≈ expectedB64Len (±4)` → Raw-RGB, sonst MIME-Detection (JPEG `/9j/`, PNG `iVBOR`).

### Text-Encoding
- Companion encodiert Zeilenumbrüche als **literale zwei Zeichen `\n`** (Backslash + n), nicht als echten Newline.
- Fix im Parser: `state.text = decoded.replace(/\\n/g, '\n')` in `SatelliteClient.ts`.
- Im Renderer: `text.split('\n').map((line, i) => ...)` mit `<br />` zwischen Zeilen.

### TEXT-Feld
- Companion encodiert den Text manchmal als Base64-UTF8 → `decodeBase64Utf8()` versucht Decodierung, fällt zurück auf Rohwert wenn kein valider UTF8-Text.

---

## CompanionButtonElement — Render-Optionen

| Option | Default | Beschreibung |
|---|---|---|
| `showBitmap` | `false` | Companion-Bitmap anzeigen. Default false — Text ist bereits in Bitmap eingebettet |
| `showText` | `true` | Text-Overlay anzeigen |
| `showBgColor` | `true` | Companion `bgColor` als Button-Hintergrund anwenden |
| `textAlign` | `'center'` | Textposition: `top` / `center` / `bottom` — gilt immer (auch ohne Bitmap) |
| `bitmapSize` | `72` | Pixelgröße der angezeigten Bitmap |
| `borderRadius` | `6` | Border-Radius des Button-Containers |

**Fix (Session 5):** `textAlign` gilt jetzt immer — unabhängig von `showBitmap`. Default geändert auf `'center'`.

---

## Nächste Schritte (Reihenfolge)

### Phase 1 — Repo aufsetzen ✅ FERTIG
- Monorepo (npm workspaces), TypeScript-Konfiguration, shared types, Beispiel-Settings

### Phase 2 — Backend (Satellite-Broker) ✅ FERTIG
- `SatelliteSession`: WebSocket → Companion, ADD-DEVICE, KEY-STATE parser, PING/PONG, REMOVE-DEVICE, Exponential Backoff
- `StateStore`: In-Memory Delta-Store
- `ClientServer`: HTTP (GET /api/settings) + WebSocket-Server für Browser (Port 8080), Snapshot bei neuem Client
- `SessionManager`: Orchestrierung, press-Routing
- `index.ts`: Entry Point, Graceful Shutdown (SIGINT/SIGTERM)

### Phase 3 — Frontend Canvas + Edit-Mode ✅ FERTIG

- `CompanionButtonElement`: bgColor, Bitmap, Text-Overlay, mehrzeilig, States, `render.fontSize`
- `ShapeElement`, `LabelElement`: vollständig
- Edit-Mode: Drag (@dnd-kit), Resize (custom PointerEvents), Rubber-Band Selektion
- `PropertiesPanel`: Overlay, GeometryBlock, element-spezifische Props, Canvas-Settings
- Keyboard-Shortcuts vollständig (V/E/G/S/Del/Esc/Ctrl+S/Z/Y/D + Nudge)
- Panel-Auswahl als Dropdown in Toolbar (Sidebar entfernt)
- 28/28 Tests grün

### Phase 3.5 — Element-Hinzufügen ✅ FERTIG (Session 2026-04-03)

- `AddElementMenu`: Toolbar `+`-Button + Canvas Rechtsklick (nur Edit-Mode)
- `CompanionButtonPickerDialog`: Host/Page-Dropdown + Mini-Grid aus Store-State
- `addElement()` / `addPageAssignment()` Store-Actions
- Shape immer hinter anderen Elementen (z-Sentinel-Logik)
- CompanionButton Ref (Page/Row/Col) im PropertiesPanel editierbar
- Backend: `SessionManager.update()` — neue Sessions nach Ctrl+S starten (kein Neustart nötig)
- 32/32 Tests grün, letzter Commit: `208702d`

### Phase 3.6 — Touch-UX ✅ FERTIG (Session 2026-04-03)

- `EditableElement`: `touch-action: none` → Shape/Label Touch-Drag funktioniert mit 1 Finger
- `NumericInput`: ±-Buttons (44px) für Touch, `compact`-Prop für enge 2-Spalten-Layouts
- `GeometryBlock`: 2-Spalten ohne Buttons (compact), Position+Größe in einer Card
- `PropertiesPanel`: Breite 280→320px, mehr Abstände, Sections klarer getrennt
- `CompanionButtonProps`: Ref-Picker nur aktiv wenn Host verbunden (`hostConnected` Check)
- `CompanionButtonPickerDialog`: Page-Input als NumericInput mit ±-Buttons; Dialog positioniert neben PropertiesPanel (links/rechts je nach Panel-Seite)
- Letzter Commit: `38e5cc1`

### Phase 4 — Refactor: SatelliteClient (Button Subscriptions API) ✅ FERTIG (Session 2026-04-03)

- `SatelliteClient.ts`: ADD-SUB/REMOVE-SUB/SUB-PRESS/SUB-STATE, PING/PONG Keepalive, Reconnect mit Re-Subscribe
- `HostManager.ts`: 1 Client pro Host, Subscription-Diff auf Panel-Elementen, Picker-Subscriptions temporär
- `StateStore.ts`: Key-Format `hostId:page:row:col` (kein keysPerRow mehr)
- `ClientServer.ts`: `POST/DELETE /api/preview-page` für Button-Picker Live-Vorschau; Schema 1.2.0
- Frontend: `sessionStatus` per Host, `getButtonState(h,p,row,col)`, Picker ohne pageAssignments
- `CompanionButtonPickerDialog`: Page/Grid-Größe als Eingabe, preview-page API, vertikaler Scroll nach 8 Zeilen
- Letzter Commit: `7457936`

### Phase 5 — Host-Verwaltung UI ✅ FERTIG (Session 2026-04-05)
1. ✅ Host hinzufügen/entfernen/bearbeiten — `HostManagerModal`
2. ✅ Verbindungsstatus live in Toolbar (Status-Dots pro Host)
3. ✅ Companion-Version + API-Version anzeigen (Tooltip + Modal)
4. ✅ Warnung wenn `CAPS SUBSCRIPTIONS=0` — Toolbar Badge
- ✅ Panel-Verwaltung: Create/Rename/Delete im Toolbar-Dropdown
- ✅ Speichern-Button mit Material Icon + Flash-Animation
- ✅ Canvas-Texturen (8 Optionen in PropertiesPanel → Canvas-Einstellungen)
- ✅ Bug-Fix: Canvas-Settings-Änderung sprang auf erstes Panel (setSettings preserviert activePanelId)
- 50/50 Tests grün, letzter Commit dieser Session: siehe git log

### Phase 6 — Electron Wrapper ✅ FERTIG (Session 2026-04-06)
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

### Phase 6.1 — Icons ✅ FERTIG (Session 2026-04-06)
- ✅ Tray-Icons (16×16, 3 Varianten): Button-Grid Design + Status-Dot — `generate-icons.mjs`
- ✅ App-Icon: icon.svg (Vektordesign, editierbar) → icon-512.png + icon-256.png + icon.ico
  - Design: 3×3 farbige Buttons (links) + 3 vertikale Meter-Bars Grün/Blau/Orange (rechts)
  - Pure Node.js Renderer (2× Supersampling, kein externes Dep) — ARM64-kompatibel
- npm Scripts: `generate:icons` + `generate:app-icon`
- Für macOS .icns: icon-512.png → cloudconvert.com

---

## UI Design System (festgelegt in Session 2)

Stil: **Professional Dark Control Surface** — orientiert an OBS, vMix, ATEM.

### Farb-Tokens
```js
surface: { base:'#0f141a', panel:'#121821', card:'#1a2030', overlay:'#1e2535', border:'#2a3344', hover:'#243040' }
accent:  { green:'#21d07a', orange:'#ff8a3d', red:'#ff5a5f', blue:'#4a9eff' }
text:    { primary:'#e9edf2', secondary:'#8896aa', muted:'#4a5568' }
```

### Layout-Maße
| Bereich | Wert |
|---|---|
| Toolbar | 56px Höhe |
| Left Sidebar | 200px Breite |
| Properties Panel (Edit) | 320px Breite, rechts |
| Grid-Dot-Raster | 40px |
| Border-Radius Buttons | 8px |
| Border-Radius Dialoge | 12px |

### Typografie
- UI: **Inter** Variable (400/500/600/700)
- Monospace (IPs, Key-Indices, Werte): **JetBrains Mono**
- Skala: 11 / 12 / 13 / 14 / 15 / 18 / 24px

### CompanionButton — visuelle States
| State | Aussehen |
|---|---|
| `inactive` | `bg-surface-card`, Rand gestrichelt, opacity 0.6 |
| `active` | Companion `bgColor` als Hintergrund, `textColor` als Text |
| `pressed` | Border `accent-red` 2.5px, `scale(0.97)` — dauert solange Finger/Maus gehalten |
| `stale` | opacity 0.5, Ring `accent-orange`, ⚠ Overlay-Icon |

### Keyboard Shortcuts
`V` = View · `E` = Edit · `G` = Grid · `S` = Snap · `Ctrl+S` = Speichern · `Ctrl+Z` = Undo · `Ctrl+Y` = Redo · `Del` = Löschen · `Ctrl+D` = Duplizieren · `Pfeiltasten` = 1px Nudge · `Shift+Pfeiltasten` = 10px Nudge · `Shift+Klick` = Selektion erweitern · `Escape` = Selektion aufheben

### Komponenten-Struktur (Frontend) — nach Edit-Mode vollständig
```
packages/frontend/src/
├── canvas/
│   └── snapModifier.ts          ← magneticSnap() + createMagneticSnapModifier() ← Phase 3 (geplant)
├── context/
│   └── DragDeltaContext.ts      ← {dx,dy}|null während Drag (kein Store) ← Phase 3 (geplant)
├── utils/
│   ├── bitmap.ts                ← ✅ Raw-RGB → Data-URL
│   └── geometry.ts              ← applyResizeDelta, rectsOverlap, clampMin ← Phase 3 (geplant)
└── components/
    ├── Toolbar/         Toolbar ✅ (ModeToggle, ?-Menü-Platzhalter)
    ├── Sidebar/         Sidebar ✅ (einklappbar, Panel-Liste-Platzhalter)
    ├── Canvas/
    │   ├── Canvas.tsx   ← DndContext + RubberBand-Overlay ← Phase 3 (geplant, refactor)
    │   └── RubberBand.tsx ← SVG-Rect während Rubber-Band-Selektion ← Phase 3 (geplant)
    ├── EditableElement.tsx ← Wrapper: useDraggable + ResizeHandles + Selektions-Ring ← Phase 3 (geplant)
    ├── Elements/
    │   ├── CompanionButtonElement.tsx ← ✅ (isContained-Prop nötig für Edit-Mode)
    │   ├── ShapeElement.tsx           ← ✅ (isContained-Prop nötig für Edit-Mode)
    │   ├── LabelElement.tsx           ← ✅ (isContained-Prop nötig für Edit-Mode)
    │   ├── ResizeHandles.tsx          ← 8 orange Handles, setPointerCapture ← Phase 3 (geplant)
    │   └── MeterElement.tsx           ← Phase 3.4 (separater Schritt)
    ├── PropertiesPanel/
    │   └── PropertiesPanel.tsx  ← Overlay, GeometryBlock + element-spezifisch ← Phase 3 (geplant)
    └── Dialogs/         WizardDialog, HostManagerModal, ContextMenu  ← Phase 4
```

### Starten (Entwicklung)
```bash
# Settings anpassen:
# CompanionWebpannelSettings.json → hosts[0].host = deine Companion-IP

npm run dev -w @cwp/backend    # Backend auf :8080
npm run dev -w @cwp/frontend   # Frontend auf :5173

# Oder beides gleichzeitig:
npm run dev

# Electron-Dev (Phase 6 ✅ implementiert):
npm run electron:dev           # baut alles + startet Electron

# Release bauen (Win/Mac):
npm run release

# Nach Änderungen an packages/shared/src/types.ts:
npm run build -w @cwp/shared   # WICHTIG: shared neu bauen bevor Backend compiliert
```

---

## Nächste Session — Aufgaben (Priorität)

### Smoke-Test Electron App — AUF X64-SYSTEM TESTEN
> **ARM64-Windows-Info:** Auf ARM64-Windows schlägt Electron's JS-Initialisierung still fehl (`process.type` bleibt `undefined`, `require('electron')` findet nur den npm-Pfad-String). Betrifft alle getesteten Versionen (v28, v32, v33). Details: `docs/electron-arm64-debug.md`

Behobene Build-Fehler (bereits gefixt, brauchen kein Re-Fix auf x64):
- `TextureOption` nicht importiert in `CanvasSettings.tsx` ✅
- `standalone.ts` ausgelagert — `index.ts` läuft nicht mehr beim Electron-Import ✅
- `@esbuild/win32-arm64` fehlte ✅

```bash
npm run electron:dev   # baut Frontend + Backend + startet Electron
```
Checklist (auf x64-System):
- Startup-Fenster erscheint, zeigt Port + Host-Status
- Tray-Icon erscheint, Menü öffnet sich
- "Open Panel" öffnet Browser auf localhost:8080
- Port-Änderung im Startup-Fenster funktioniert
- Quit beendet App sauber

### macOS .icns Icon (wenn Mac-Release nötig)
`packages/electron/assets/icon-512.png` → cloudconvert.com → ICNS → `packages/electron/assets/icon.icns`
Dann `electron-builder.yml` Mac-Target testen.

### Noch offen: MeterElement (separater Schritt)
- Visuell: vertikal oder horizontal? Peak-Hold als Linie? → noch nicht entschieden
- Quelle = TEXT-Feld eines Companion-Buttons, Parser: "db"

### Panel Export/Import (geplant, ~2–3h)
- Export: einzelnes Panel als `.cwp`-Datei (JSON) herunterladen
- Import: `.cwp` einlesen → neue Element-IDs vergeben → Panel hinzufügen
- Beim Import: `hostId`-Mapping-Dialog falls importierter Host nicht in Settings → "Host X aus Datei → welcher Host hier?"

### Host-ID Remapping (geplant, ~3–5h)
- Funktion: alle Button-Referenzen eines Panels von `hostId A` auf `hostId B` umschreiben
- Use Case: Companion-Server-Wechsel, neues Backend, Import aus anderer Installation
- UX: Button im `HostManagerModal` "Ersetze Host in allen Buttons" → Dropdown alt→neu
- Kann mit Panel-Import kombiniert werden (Auto-Mapping wenn `hostId` nicht matcht)

---

## Dev-Gotchas

- **Settings-Version bump** → immer 5 Stellen anfassen: `schema.json` + `types.ts` + `backend/standalone.ts` + `backend/server/ClientServer.ts` + `CompanionWebpannelSettings.json`
- **vitest/esbuild strippt TypeScript** → Type-Fehler erscheinen NICHT als Test-Failures. Für echten TS-Check: `npx tsc --noEmit -p packages/frontend/tsconfig.json` (nicht `tsconfig.app.json` — existiert nicht)
- **shared neu bauen nach Typänderungen** → `npm run build -w @cwp/shared` (WICHTIG: sonst kompiliert Backend gegen alten Stand)
- **Test-Fixture-Version** → `makeSettings()` in `useAppStore.test.ts` verwendet `version: '1.3.0'` (bei nächster Version-Bump anpassen)

---

## Quellen (wichtig für Implementierung)

- Satellite API Protokoll: `docs/satellite-api-protocol.md` (lokal, v1.10 / Companion 4.3+)  
  Update: `gh api "repos/bitfocus/website/contents/for-developers/Satellite-API.md" --jq '.content' | base64 -d > docs/satellite-api-protocol.md`
- companion-satellite Referenz-Impl.: https://github.com/bitfocus/companion-satellite
- Alle API-Quellen: `bitfocus-companion-module-sources.md`

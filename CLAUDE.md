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
| Surface-Zuordnung | Manuell in Companion UI (Wizard-Anleitung) | Vermeidet nicht-offizielle APIs |
| KEY-PRESS Timing | Echte Haltezeit (onPointerDown/Up/Leave/Cancel) | Long-Press-Aktionen in Companion funktionieren |
| Max. Pages | 5–10 Satellite-Sessions parallel | Praxiswert für den Anwendungsfall |
| Schema-Version | 1.1.0 | Aktuelle Version, bitte nicht auf 1.0.0 zurückfallen |
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
| Page via API setzen | Nicht möglich | Muss manuell in Companion UI (Startup Page) gesetzt werden — Wizard-Flow bleibt |
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
| Multi-Agent Implementierung | NEIN — kein paralleles Arbeiten mehrerer Agenten | Kein Git-Repo → keine Worktrees → Datei-Konflikte möglich. Sequenziell nach Plan-Reihenfolge. |
| Sidebar | Entfernt — Panel-Auswahl als Dropdown in Toolbar | Mehr Canvas-Platz, einfachere Navigation |
| Properties Panel Schriftgrössen | Labels 12px, Inputs/Selects 14px mit 8×10px Padding, Checkboxen 20×20px | Touch-freundlich (min 44px Hit-Area für Buttons) |
| CompanionButton Font-Size | `render.fontSize` konfigurierbar (default 11px, min 6px) | User kann Textgrösse pro Button anpassen |

---

## Projekt-Dateien (aktueller Stand)

```
CompanionWebpannel/
├── CLAUDE.md                                     ← diese Datei
├── Companion-Webpanel-Umsetzungsbeschreibung.md  ← Anforderungen (Referenz)
├── Webpanel-Architektur.md                       ← Architektur-Doku (aktuell, v1.1)
├── CompanionWebpannelSettings.schema.json        ← JSON-Schema v1.1.0 (vollständig)
├── CompanionWebpannelSettings.json               ← Laufzeit-Konfiguration (Beispiel, anpassen!)
├── bitfocus-companion-module-sources.md          ← API-Quellen / Docs-Links
├── docs/superpowers/
│   ├── specs/2026-04-01-edit-mode-design.md      ← ✅ Edit-Mode Design-Spec (vollständig)
│   └── plans/2026-04-01-edit-mode.md             ← ✅ Edit-Mode Implementierungsplan (15 Tasks, TDD)
├── package.json                                  ← npm workspaces root
└── packages/
    ├── shared/src/types.ts                       ← Alle TypeScript-Typen (Settings, WS-Messages, Elemente)
    ├── backend/src/
    │   ├── satellite/SatelliteSession.ts         ← WebSocket-Verbindung zu Companion, ADD-DEVICE, PING/PONG
    │   ├── state/StateStore.ts                   ← In-Memory State + Delta-Logik
    │   ├── server/ClientServer.ts                ← HTTP (GET+POST /api/settings) + WS-Server für Browser-Clients
    │   │                                            POST: atomisches Schreiben (tmp→rename), stuck-press Fix
    │   ├── SessionManager.ts                     ← Orchestrierung aller Sessions
    │   └── index.ts                              ← Entry Point, Graceful Shutdown
    └── frontend/src/
        ├── store/useAppStore.ts                  ← Zustand-Store (settings, buttons, sessionStatus, mode, activePanelId)
        ├── ws/useWebSocket.ts                    ← WS-Hook mit Auto-Reconnect
        ├── api/useSettings.ts                    ← GET /api/settings beim Start + saveSettings() für POST
        ├── utils/bitmap.ts                       ← Raw-RGB base64 → Canvas Data-URL Konvertierung
        ├── App.tsx + main.tsx                    ← App-Shell mit Keyboard-Shortcuts
        └── components/
            ├── Toolbar/Toolbar.tsx               ← Toolbar mit Mode-Toggle
            ├── Sidebar/Sidebar.tsx               ← Einklappbare Panel-Liste
            ├── Canvas/Canvas.tsx                 ← Canvas mit Element-Rendering (nach z-Index sortiert)
            └── Elements/
                ├── CompanionButtonElement.tsx    ← ✅ Vollständig (bgColor, Bitmap, Text, States)
                ├── ShapeElement.tsx              ← ✅ Rechteck mit fill/stroke/borderRadius
                └── LabelElement.tsx              ← ✅ Statischer Text mit Style-Optionen
```

---

## Architektur (Kurzfassung)

```
[Companion] ←→ WS:16623 ←→ [Node Backend] ←→ WS ←→ [React PWA / Browser]
                              Satellite-Connector
                              State-Store (In-Memory)
                              Delta-Distributor
                              Command-Router (KEY-PRESS)
```

- **1 Satellite-Session pro (hostId × page)** — jede Session ist ein eigenes „Surface" in Companion
- Backend ist **State-Broker**: cached alle KEY-STATEs, sendet nur Deltas an Clients
- Frontend ist **stateless**: bekommt alles vom Backend, rendert nur was sich ändert

---

## Datenmodell (Kern)

### CompanionRef — zeigt auf einen Companion-Button
```typescript
{ hostId: string, page: number, row: number, col: number }
```
> `hostId` ist **required** — wird auf eine Satellite-Session gemappt.

### surfaceConfig — Grid-Größe pro (hostId, page)
```typescript
{ keysPerRow: number, rows: number }
// keysTotal = keysPerRow * rows
// keyIndex  = row * keysPerRow + col
```
> Wird im Wizard abgefragt, in `wizard.pageAssignments["hostId:page"].surfaceConfig` gespeichert.

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

```
← BEGIN ApiVersion=2.0.0 +OK
→ ADD-DEVICE DEVICEID="webpanel:h1:page:5" PRODUCT_NAME="Webpanel h1 P5"
    KEYS_TOTAL=64 KEYS_PER_ROW=8 BITMAPS=72 COLORS=true TEXT=true TEXT_STYLE=true
← ADD-DEVICE OK DEVICEID="webpanel:h1:page:5"
← KEY-STATE DEVICEID=... KEY=30 TYPE=BUTTON COLOR=rgb(255,0,0) TEXT=Live BITMAP=<base64>
→ KEY-PRESS DEVICEID=... KEY=30 PRESSED=true    (bei onPointerDown)
→ KEY-PRESS DEVICEID=... KEY=30 PRESSED=false   (bei onPointerUp / onPointerLeave / onPointerCancel)
→ PING <timestamp>
← PONG <timestamp>
→ REMOVE-DEVICE DEVICEID="webpanel:h1:page:5"   (beim graceful shutdown)
← REMOVE-DEVICE OK DEVICEID="webpanel:h1:page:5"
```

> Keepalive alle ~2s. Ohne PING/PONG kann Companion die Verbindung trennen.
> Verbindung: **WebSocket** auf Port 16623 (`wsPort`). Protokoll ist zeilenbasiert (`\n`) über WS-Text-Frames.
> Bei Socket-Close entfernt Companion alle Devices dieses Sockets automatisch.

---

## Message-Protocol Backend ↔ Frontend (WebSocket)

```typescript
// Backend → Frontend (Delta: ein Key hat sich geändert)
{ t: "delta", hostId: string, page: number, key: number,
  bgColor?: string, textColor?: string, text?: string, bitmap?: string }

// Backend → Frontend (Snapshot: alle Keys einer Session — bei neuem Client-Connect)
{ t: "snapshot", hostId: string, page: number,
  keys: Record<number, KeyState> }   // keyIndex → { bgColor, textColor, text, bitmap }

// Backend → Frontend (Session-Status)
{ t: "sessionStatus", hostId: string, page: number,
  status: "connecting" | "connected" | "stale" | "error" }

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
- Fix im Parser: `state.text = decoded.replace(/\\n/g, '\n')` in `SatelliteSession.ts`.
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

**Offene Touch-Verbesserungen (nächste Session):**
- CompanionButton Ref im PropertiesPanel: visueller Button-Picker (Mini-Grid-Dialog) statt nur NumericInputs
- Page-Input im Picker-Dialog: bessere Touch-UI (aktuell zu kleines Number-Input)

### Phase 4 — Wizard & Setup-UI (nächste Priority)
1. **Surface-Management klären:** Wann erstellt/löscht? Panel ohne Surface sichtbar — Lifecycle-Design nötig
2. Host-Verwaltung (hinzufügen, entfernen, Verbindungsstatus)
3. Surface-Grid-Konfiguration pro (hostId, page)
4. Anleitung-Dialog: „Startup Page in Companion setzen"
5. Validierung: Button außerhalb Grid → Warnung

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
| Properties Panel (Edit) | 280px Breite, rechts |
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
```

---

## Nächste Session — Aufgaben (Priorität)

### ✅ Spec & Plan fertig + alle Entscheidungen getroffen (Session 4)
- Edit-Mode Design-Spec vollständig (`docs/superpowers/specs/2026-04-01-edit-mode-design.md`)
- Implementierungsplan mit 15 Tasks + TDD fertig (`docs/superpowers/plans/2026-04-01-edit-mode.md`)
- Alle UI-Entscheidungen getroffen und in CLAUDE.md dokumentiert

### ✅ Stabilitätstests abgeschlossen (Session 5)
1. **Port-Freigabe:** `EADDRINUSE` behoben — `ClientServer.ts` fängt Fehler ab, gibt klare Meldung statt Stack-Trace
2. **Graceful Shutdown:** Code korrekt implementiert (`stop()` → `sendRemoveDevice()`). Manuelle Verifikation mit Companion empfohlen (Windows-SIGINT per Script nicht simulierbar)
3. **Absturz-Verhalten Backend:** Windows gibt Port nach Hard-Kill sofort frei — kein `EADDRINUSE`. Frontend-Bug gefixt: `useWebSocket.ts` markiert jetzt alle Sessions als `stale` bei `onclose` → ⚠ Overlay auf Buttons bis Reconnect
4. **Absturz-Verhalten Frontend / Stuck-press:** `ClientServer.ts` Press-Tracker bereits implementiert — bei Tab-Close automatisch `PRESSED=false` gesendet (bereits in Phase 2 gebaut)
5. **Debug-Logs bereinigt:** Alle `console.log` aus `SatelliteSession.ts` und `SessionManager.ts` entfernt — nur `warn`/`error` bleiben

### Phase 3 — Edit-Mode (bereit zur Implementierung)
Reihenfolge laut Plan:
1. Store-Erweiterungen (selectedIds, updateElementGeometry, undo/redo, duplicate, delete)
2. `EditableElement` Wrapper + `DragDeltaContext`
3. `DndContext` in Canvas + Drag (Einzel + Gruppe)
4. `snapModifier.ts` (magneticSnap)
5. `ResizeHandles.tsx` + `geometry.ts`
6. Rubber-Band Selektion (`RubberBand.tsx`)
7. `PropertiesPanel.tsx` (Geometrie-Block → dann element-spezifisch)
8. Canvas-Größen-Einstellung
9. Keyboard-Shortcuts vervollständigen + `Ctrl+S` POST

### Noch offen: MeterElement (separater Schritt nach Edit-Mode)
- Visuell: vertikal oder horizontal? Peak-Hold als Linie? → noch nicht entschieden

---

## Quellen (wichtig für Implementierung)

- Satellite API Protokoll: https://github.com/bitfocus/companion/wiki/Satellite-API
- companion-satellite Referenz-Impl.: https://github.com/bitfocus/companion-satellite
- Alle API-Quellen: `bitfocus-companion-module-sources.md`

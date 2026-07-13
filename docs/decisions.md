# Alle getroffenen Entscheidungen

Diese Entscheidungen sind **final** — nicht mehr diskutieren. Kurze Begründung pro Zeile.

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
| Schema-Version | 1.8.0 (aktuell) | Historie: 1.3.0 +server.port · 1.4.0 VirtualDeck · 1.5.0 maxPages/pageNames · 1.6.0 language · 1.7.0 settingsPath · 1.8.0 httpPort |
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
| Windows Release-Format | `portable` (einzelne .exe, kein Installer) | Einfachster Start: doppelklicken, fertig — kein Admin-Recht, kein Installer-Wizard |
| Portable userData-Pfad | `app.setPath('userData', appData/CompanionWebpanel)` explizit | Portable-Builds würden sonst in temporären Ordnern landen — Settings bleiben zwischen Starts erhalten |
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
| Lasso-Selektion | Freihand-Polygon (LassoSelect.tsx), Ray-Casting Hit-Test, ersetzt RubberBand | Default: Ecken-Check (mindestens 1 Ecke im Polygon), locked=true Elemente ausgeschlossen |
| Edit-Mode Nicht-MVP | Kein proportionales Resize (Multi-Select), kein voller Undo-Stack, kein Z-Index manuell, kein `+`-Button, kein MeterElement | MVP-Fokus — Phase 4 |
| Multi-Agent Implementierung | NEIN — kein paralleles Arbeiten mehrerer Agenten | Datei-Konflikte möglich bei parallelen Schreibzugriffen. Sequenziell nach Plan-Reihenfolge. |
| Sidebar | Entfernt — Panel-Auswahl als Dropdown in Toolbar | Mehr Canvas-Platz, einfachere Navigation |
| Properties Panel Schriftgrössen | Labels 12px, Inputs/Selects 14px mit 8×10px Padding, Checkboxen 20×20px | Touch-freundlich (min 44px Hit-Area für Buttons) |
| CompanionButton Font-Size | `render.fontSize` konfigurierbar (default 11px, min 6px) | User kann Textgrösse pro Button anpassen |
| Bitmap Scaling | `render.scaleBitmap` (default: true) — `objectFit: contain`, `imageRendering: auto` | Bitmap füllt Button-Container; false = feste 72px pixelscharf |
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
| ELECTRON_RUN_AS_NODE Fix | `scripts/launch-electron.mjs` löscht `ELECTRON_RUN_AS_NODE` vor Spawn | Claude Code / VS Code setzen diese Variable → Electron läuft im reinen Node-Modus statt GUI |
| App-Name (userData-Pfad) | `app.setName('CompanionWebpanel')` in main.ts vor Single-Instance-Lock | npm workspace `name` muss `@cwp/electron` bleiben — `app.setName()` steuert userData-Verzeichnis unabhängig |
| Panel APP-Modus | `PanelWindow` (BrowserWindow 1280×720) für "Open in App"; `shell.openExternal` für "Open in Browser" | Beide Optionen in Startup-Fenster + Tray; bereits offen → fokussieren statt neu öffnen |
| Quit-Dialog | `dialog.showMessageBox()` vor shutdown — "Beenden" / "Abbrechen" | Verhindert versehentliches Beenden im Live-Betrieb |
| Electron Tray Host-Filter | `appStatus.hosts` nur Hosts mit `showInToolbar !== false && autoConnect !== false` | Hosts ohne Toolbar-Anzeige oder ohne Auto-Connect nicht im Tray/Startup-Fenster anzeigen |
| Startup-Fenster Hide | Hide-Button statt automatischem Schließen bei "Open in App/Browser" | Fenster bleibt zugänglich für Port-Änderung und Status-Check |
| ChannelStrip Struktur | Monolithisches Element (nicht separate Elemente) mit Setup-Wizard | Ein Block = Meter+Fader+Mute+Solo; Wizard führt durch Refs beim Erstellen |
| ChannelStrip Fader-Control | `SUB-ROTATE SUBID=buttonRef DIRECTION=±1` (Satellite API v1.10) | Kein separater faderUpRef/faderDownRef nötig — ein Button für alles |
| ChannelStrip buttonRef | 1 Companion-Button für: Mute (SUB-PRESS+bgColor) + Fader (SUB-ROTATE) + Daten (TEXT multi-value) | TEXT-Feld mit Separator (z.B. `\|`) enthält Meter L/R, Level, Name als indizierte Werte |
| ChannelStrip Fine/Coarse | Shift+Scroll = `coarseMultiplier` × SUB-ROTATE (Default: 10) | Kein separater Companion-Button — Multiplikator client-seitig |
| ChannelStrip Unity Reset | Doppelklick auf Wheel → SUB-PRESS auf buttonRef | Companion-Button "Press action" = Set Fader 0dB konfigurieren |
| ChannelStrip Color Stripe | 20px Höhe, Channel-Name integriert, konfigurierbare Farbe | Wie SSL/dLive — schnelle visuelle Orientierung im Live-Betrieb |
| ChannelStrip Clip LED | Blinkt (CSS step-start 0.5s) wenn Meter ≥ clipThreshold (default: 0 dBFS), kein Reset | Latching-Verhalten entfällt bewusst — blinkt nur bei aktivem Clipping |
| ChannelStrip invertMute | `style.invertMute?: boolean` — kehrt isMuted-Logik um | Manche Module setzen Feedback-Farbe wenn UNMUTED (z.B. vMix-Varianten) |
| ChannelStrip Index-Defaults | meterLIndex=0, meterRIndex=1, levelIndex=2, nameIndex=3 | Passend zu Beispiel-Format: `MeterL\|MeterR\|Level\|Name` |
| ChannelStrip Picker Portal | `createPortal(..., document.body)` in Wizard + ChannelStripProps | Verhindert Stacking-Context-Probleme wenn Picker innerhalb von Modals geöffnet wird |
| ChannelStrip Mute-Farbe | `buttonState.bgColor` direkt (kein `isMuted`-Kalkül) + `textColor` von Companion | Exakt wie CompanionButtonElement — kein berechneter Zustand, echtes Companion-Feedback |
| ChannelStrip Meter-Gradient | `backgroundSize: 100% Xpx` + `backgroundPosition: bottom` auf Fill-Div | Gradient muss auf volle Meter-Höhe gespannt sein, nicht auf Fill-Div-Höhe — sonst immer Rot oben |
| ChannelStrip Meter-Zonen | Grün −60→−18 (60%), Gelb −18→−9 (73%), Orange −9→−3 (81%), Rot >−3 (100%) | Broadcast-Standard; Peak Hold violett `#b060ff` |
| ChannelStrip Fader-Position | `bottom: X%` (0=unten, 100=oben); Level ist 0–100 Prozent (Wing-Format) | `top` hatte Klemm-Bug bei negativen Werten; `bottom` direktes Mapping |
| ChannelStrip Default-Größe | `w: 130, h: 500` | Sinnvolle Startgröße für typische Mixer-Channel-Strips |
| ChannelStrip Wheel | `flex: 1, maxHeight: 100px`, Wrapper mit `justifyContent: center` | Zentriert zwischen Meter und Mute/Solo; wächst mit Element, klemmt bei 100px |
| Electron Cache | `session.defaultSession.clearCache()` + `clearStorageData(cachestorage+serviceworkers)` beim Start | PWA Service Worker cachte veralteten Frontend-Stand — automatisch gelöscht |
| AddElementMenu useEffect | `[pickerOpen, wizardOpen, onClose]` — wizardOpen in Deps | War fehlend → mousedown-Handler schloss Wizard beim Klick in Wizard-Buttons |
| ChannelStrip Pan | Ausgegraut wenn `style.mono=true` oder `refs.pan` nicht konfiguriert | Pan-Wert aus Companion TEXT-Variable (Wing: `ch1_pan`, vMix: `input_X_pan`) |
| ChannelStrip Solo | Ausgegraut wenn `refs.solo` nicht konfiguriert | Separater optionaler Button (SUB-PRESS + bgColor-State) |
| Panel Zoom | `transform: scale(zoom)` auf Canvas, 3-Ebenen-Layout (scroll-wrapper → size-reserve → scale-root) | `transform` ändert document flow nicht — size-reserve div setzt korrekte Scroll-Dimensionen; Zoom 0.2–2.0 |
| Zoom Koordinaten-Fix | Drag/Resize/Pointer-Deltas durch `zoom` dividieren in `getCanvasPos`, `handleDragEnd`, `ResizeHandles`, `EditableElement` | @dnd-kit liefert screen-space Pixel — innerhalb `scale(zoom)` sonst falsch skaliert |
| Zoom Ctrl+Scroll | Nativer `wheel`-Event mit `{ passive: false }` auf `scrollWrapperRef`; `useAppStore.getState()` statt React-Closure | React onWheel ist passiv → `preventDefault()` schlägt fehl; Closure hätte veralteten zoom-Wert |
| HostProfile Grid | `gridCols?: number`, `gridRows?: number` in `HostProfile` | Picker + ChannelStrip-Wizard lesen Host-Default; kein Schema-Bump — Fallback 8/4 beim Consumer |
| Bitmap-Format-Negotiation (5.0) | Feature-Detection via CAPS `BITMAP_FORMATS` (webp > png > rgb), NIE via ApiVersion; Reset bei jedem `connect()` | Nicht annoncierte Formate fallen server-seitig stumm auf raw-RGB zurück; Reconnect kann auf älteren Companion treffen; Wire-Format für 4.3 bleibt byte-identisch |
| WebP-Bitmap-Pfad | Backend Passthrough; Frontend erkennt `data:`-Prefix → direkt an `<img src>`, kein Canvas/Cache | Data-URLs sind selbstbeschreibend; ~17× kleiner als raw-RGB (72px: 1227 statt 20736 Zeichen) |
| mDNS-Discovery Lifecycle | Browse-on-demand: nur solange HostManagerModal offen (`POST /api/discovery/start\|stop`), Watchdog-Auto-Stop 5 min | Kein Dauer-Multicast; Windows-Firewall-Prompt (UDP 5353) erst bei aktiver Nutzung |
| mDNS-Dependency | `@julusian/bonjour-service` (Companions eigene Lib, pure JS) | Bündelt durch esbuild fürs Electron-Package; DiscoveredHost: fqdn-Dedupe, erste nicht-link-locale IPv4, TXT `protocolVersion` |
| Non-square Bitmaps (5.0) | Automatisch aus Element-Geometrie abgeleitet, NICHT persistiert; Aspect quantisiert auf Stufen {1:2, 9:16, 3:4, 1:1, 4:3, 16:9, 2:1}, `bitmapSize` = lange Seite | Kein Schema-Bump; Quantisierung verhindert Re-Subscribe-Churn beim Resize; Gate: NONSQUARE-CAP + Data-URL-Format + showBitmap + scaleBitmap≠false |
| Non-square Wire-Format | `STYLE=<base64 JSON>` ersetzt BITMAP/COLORS/TEXT/TEXT_STYLE; `BITMAP_FORMAT` bleibt separater Param; Fallback Legacy `BITMAP=max(w,h)` | raw-RGB hat keinen Header — non-square nur mit selbstbeschreibenden Data-URLs eindeutig dekodierbar |
| Multi-Element gleicher Button | Superset-Box `w=max(w), h=max(h)` (HostManager `realSubDims` als "WxH"-Strings) | Degeneriert zum alten MAX-Verhalten bei lauter Quadraten |
| Seitennamen-Quelle | Companion-HTTP-API `GET :httpPort/api/variable/internal/page_number_<N>_name/value` via Backend-Proxy | Satellite API hat keine PAGE-NAME-Message (auch 1.12 nicht); Proxy vermeidet CORS, Frontend bleibt stateless; interne Variablen sind read-only — Namen ändern nur in Companion-UI |
| Seitennamen-Batch | `resolveMany()` Worker-Pool Concurrency 20, TTL-Cache 30 s (auch leere Ergebnisse), Timeout 1,5 s/Seite | Live gemessen: 99 Namen in ~145 ms; leere Ergebnisse cachen verhindert Timeout-Hämmern gegen tote Hosts |
| Seitennamen-Priorität im Picker | Lokale `pageNames` (HostProfile) > Companion-Name (HTTP-API) > nur Nummer | User-Overrides gewinnen; graceful degradation ohne HTTP-API |
| httpPort Feld | `HostProfile.httpPort?: number` (Default 8000) — Schema-Bump 1.8.0 | Companion Admin-Port; braucht eigene Firewall-Freigabe am Companion-Host |

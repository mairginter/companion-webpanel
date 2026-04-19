# Webpanel für Bitfocus Companion – Architektur (v1.1 / MVP)

## Ziel
Ein lokal betriebenes **Webpanel als PWA** (Tablet Standalone / Desktop Kiosk via `--app=`), das **Companion-Buttons in Echtzeit spiegelt** (Bitmap/Farben/Text) und **Button-Press** an Companion sendet – vollständig im LAN.  
Die Echtzeit-Spiegelung und Button-Interaktion erfolgt über die **Companion Satellite API** (WebSocket/TCP), die explizit für Remote-Surfaces gedacht ist und `KEY-STATE`/`KEY-PRESS` bereitstellt.

---

## Architektur-Überblick

### High-Level Komponenten

1. **Frontend (PWA, React/TypeScript)**
   - Rendering der Webpanel-Seiten (frei platzierbare Buttons, Grid, Shapes, Labels, Audio Meter)
   - WebSocket-Verbindung zum lokalen Backend für Live-Updates
   - **Edit-Mode / View-Mode** (Modus-Umschalter in der Toolbar)
   - UI für Wizard/Setup (Host-Auswahl, Port, Surface Grid-Größe, Page-Surfaces Status)
   - Beispiel UI: `webpanel-mockup-layout-v2.svg`

2. **Backend (Node.js/TypeScript)**
   - **Satellite Connector**: baut pro benötigter Companion-Page eine Satellite-Session auf ("Data-Surface pro Page")
   - **State Store**: zentraler In-Memory-Store (mit optionaler Persistenz) für Button-States
   - **Delta Distributor**: verteilt nur Änderungen (Deltas) an Webclients
   - **Command Router**: nimmt UI-Kommandos entgegen (Press) und sendet `KEY-PRESS` an die passende Satellite-Session
   - **Static/PWA Server**: liefert PWA Assets aus (oder proxy auf Vite Dev Server)

3. **Persistenz (Datei)**
   - Speicherung/Laden in `CompanionWebpannelSettings.json` (Hosts, Panels, Elemente, Wizard-State inkl. surfaceConfig)

> Dieses Pattern entspricht dem Ansatz, wie Bitfocus' **Companion Satellite** als separater Dienst Surfaces verbindet und konfigurierbar macht (Referenz-Implementierung/Pattern).

---

## Datenmodelle (Core)

### 1) HostProfile
- `id`: string
- `name`: string
- `host`: string (IP/DNS)
- `satellite`: `{ wsPort: number }` (Default 16623)
- `notes?`: string

### 2) PageSurfaceSession
Repräsentiert die Verbindung für **eine Companion-Page**.
- `hostId`: string
- `page`: number
- `deviceId`: string (z. B. `webpanel:hostA:page:5`)
- `mode`: `simple`
- `keysPerRow`: number — aus `PageAssignment.surfaceConfig.keysPerRow`
- `keysTotal`: number — `keysPerRow × rows` aus `surfaceConfig`
- `bitmapSize`: 72 (fest, Companion-Standard)
- `connected`: boolean
- `apiVersion`: string (aus `BEGIN`)

> **Grid-Größe:** Wird im Wizard/Settings pro Page konfiguriert (`surfaceConfig`). Standard 8×8 = 64 Keys. Muss alle im Layout verwendeten `row`/`col` abdecken — der höchste `keyIndex = row * keysPerRow + col` muss < `keysTotal` sein. Das Frontend warnt beim Speichern, wenn ein Element außerhalb des konfigurierten Grids liegt.

**Warum „eine Session pro Page"?**
Die Satellite-API folgt einem Paging-/Surface-Modell; um Buttons einer bestimmten Page konsistent zu spiegeln, ist pro Page eine „Data-Surface" praktikabel.

### 3) ButtonRef (Mapping)
- `hostId`: string — welcher Host (Satellite-Verbindung)
- `page`: number
- `row`: number
- `col`: number
- `keyIndex`: number (Simple Mode: `row * keysPerRow + col`)

### 4) ButtonState (Mirror-State)
- `bgColor?`: string (hex oder rgb)
- `textColor?`: string
- `text?`: string
- `fontSize?`: number
- `bitmap?`: string (base64) oder `null`
- `pressed?`: boolean
- `ts`: number (Unix ms)

### 5) PanelLayout
- `panels[]`: Webpanel-Seiten
- `defaultMode`: `"edit" | "view"` — gespeicherter Startmodus des Panels
- `elements[]`: `companionButton | shape | label | meter`

### 6) UI-Modus (Runtime-State, nicht persistiert)
- `currentMode`: `"edit" | "view"` — aktueller Zustand im Frontend-Store (flüchtig, nicht in JSON)
- Beim Laden eines Panels wird `currentMode = panel.defaultMode` gesetzt.

---

## Edit-Mode vs. View-Mode

| Eigenschaft | View-Mode | Edit-Mode |
|---|---|---|
| Button-Klick | löst `KEY-PRESS` aus | öffnet Element-Eigenschaften |
| Drag & Drop | deaktiviert | Elemente frei verschiebbar |
| Resize-Handles | unsichtbar | sichtbar, Mindestgröße = `bitmapSize` |
| Grid-Overlay | aus (wenn `grid.enabled=false`) | einblendbar per Toggle |
| Element hinzufügen | nicht möglich | über `+`-Button / Kontextmenü |
| Element löschen | nicht möglich | Entf-Taste / Kontextmenü |
| Toolbar-Button | zeigt `✏ Bearbeiten` | zeigt `▶ Ansicht` |

**Mindestgröße im Edit-Mode:**  
Wenn `render.enforceMinSize = true`, blockiert der Resize-Handler das Unterschreiten von `render.bitmapSize` für Breite und Höhe. Der Wert entspricht typisch 72px (Companion-Bitmap-Größe).

---

## Simple-Mode Key-Mapping (Row/Column → KEY)
Im Simple Mode beschreibt Satellite ein uniformes Grid (z. B. 8 Spalten × 8 Zeilen), und Events referenzieren `KEY`.

**Mapping:**
- `keyIndex = row * keysPerRow + col`
- `row/col` sind 0-basiert (wie in Companion-HTTP/Buttons üblich).
- `keysTotal = keysPerRow × rows` — wird beim `ADD-DEVICE` übergeben.

> Hinweis: Satellite erwähnt, dass `KEY` seit v1.6 auch row/col-artig referenziert werden kann, aber für MVP ist ein strikt lineares Mapping am robustesten.

---

## Message-Flows (Sequenzen)

### Flow A: Start / Host wählen / Sessions aufbauen
1. **Frontend** lädt `CompanionWebpannelSettings.json` vom Backend.
2. User wählt `HostProfile`.
3. Backend sammelt alle eindeutigen `(hostId, page)`-Kombinationen aus dem aktiven Panel-Layout.
4. Pro `(hostId, page)`: lese `surfaceConfig` aus `wizard.pageAssignments["hostId:page"]`.
   - Fehlende `surfaceConfig` → Wizard-Dialog: User gibt `keysPerRow` und `rows` ein → wird in Settings gespeichert.
5. Backend erstellt `PageSurfaceSession` mit den konfigurierten Grid-Dimensionen:
   - Verbinde per WebSocket zum Companion Satellite Endpoint (Default 16623).
   - Empfange `BEGIN ... ApiVersion=...`.
   - Sende `ADD-DEVICE DEVICEID=... PRODUCT_NAME=... KEYS_TOTAL=<keysTotal> KEYS_PER_ROW=<keysPerRow> BITMAPS=72 COLORS=true TEXT=true TEXT_STYLE=true`.
   - Starte Keepalive: `PING`/`PONG` alle ~2s.

### Flow B: Wizard (manuelle Surface→Page Zuordnung + Grid-Konfiguration)
Da Companion die „aktuelle Page" einer Surface im UI verwaltet, zeigt das Webpanel beim ersten Start eines neuen (hostId, page)-Paars einen Wizard:
1. „Bitte in Companion → Surfaces → **Webpanel Page X** → Startup Page = X setzen; Navigation deaktivieren."
2. „Wie groß ist das Grid dieser Companion-Page?"
   - Eingabe: **Spalten (keysPerRow)** und **Zeilen (rows)**
   - Standard-Vorschlag: 8 × 8
   - Hinweis: Muss alle Buttons dieser Page abdecken (max. col + 1 ≤ keysPerRow, max. row + 1 ≤ rows).
3. Werte werden in `wizard.pageAssignments["hostId:page"].surfaceConfig` gespeichert.

Das ist bewusst pragmatisch; es vermeidet Abhängigkeit von nicht-offiziellen Konfig-APIs.

### Flow C: Realtime Mirror (KEY-STATE → UI)
1. Companion sendet `KEY-STATE` für geänderte Keys an die jeweilige PageSession.
2. Backend parst die Zeile (Args), dekodiert Base64 für TEXT/BITMAP (falls vorhanden).
3. Backend aktualisiert `StateStore[(hostId, page, keyIndex)]`.
4. Backend sendet **Delta-Update** via WS an alle Webclients, z. B.:
   ```json
   {"t":"delta","hostId":"h1","page":5,"key":30,"bgColor":"#00ff00","text":"23 dB"}
   ```
5. Frontend rendert nur betroffene Komponenten neu (nur im View-Mode sichtbar wirksam; im Edit-Mode ebenfalls aktiv für Live-Vorschau).

### Flow D: Button Press (UI → KEY-PRESS)
Nur aktiv im **View-Mode** — im Edit-Mode löst Klick/Tap die Element-Auswahl aus, kein KEY-PRESS.

1. User tippt Webpanel-Button (View-Mode).
2. Frontend sendet Command via WS an Backend:
   ```json
   {"t":"press","hostId":"h1","page":5,"row":3,"col":6}
   ```
3. Backend berechnet `keyIndex = row * keysPerRow + col` und sendet an passende PageSession:
   - `KEY-PRESS DEVICEID=... KEY=<keyIndex> PRESSED=true`
   - 80–100 ms später: `KEY-PRESS DEVICEID=... KEY=<keyIndex> PRESSED=false`

> Fester Tap-Timing: 80–100 ms verhindert „stuck-pressed"-Zustände in Companion.

### Flow E: Reconnect & Resync
- Bei Socket-Disconnect:
  - Exponential Backoff Reconnect
  - Nach Reconnect erneut `ADD-DEVICE` (mit gespeicherter `surfaceConfig`)
  - UI „stale" markieren bis erste `KEY-STATE` Updates eintreffen

---

## Performance- & Stabilitätsregeln (MVP)
- **Keepalive** (PING/PONG), sonst kann der Server die Verbindung schließen.
- **Delta statt Full-State** an Webclients.
- **Bitmap Caching** (Hash/CRC) zur Reduktion der Repaints/Bandbreite.
- Max. **5–10 Pages parallel** → entsprechend Sessions begrenzen.

---

## Security (LAN)
- Standard: Bind auf `0.0.0.0` nur im LAN.
- Optional: Simple Token für Websocket-Clients.

---

## Deliverables (MVP)
1. PWA UI (React) mit Edit-Mode / View-Mode
2. Node WS Broker (Satellite Connector + WebSocket Server)
3. Datei-Persistenz `CompanionWebpannelSettings.json` (inkl. `surfaceConfig` pro Page)

---

## Quellen
- Satellite API Spec (Ports, Simple/Advanced, KEY-STATE/KEY-PRESS, PING/PONG): Companion Wiki – Satellite API
- Referenz-Pattern „Companion Satellite" (separater Dienst, TypeScript, Surfaces over network): GitHub – bitfocus/companion-satellite

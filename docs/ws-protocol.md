# WebSocket Protokoll-Referenz

## Satellite API — wichtigste Kommandos

Vollständige Referenz: `docs/satellite-api-protocol.md` (v1.12 / Companion 5.0+)

### Button Subscriptions (ab API 1.10.0 / Companion 4.3.0) — aktuelle Implementierung

```
← BEGIN CompanionVersion="5.0.0+..." ApiVersion="1.12.0"
← CAPS SUBSCRIPTIONS=1 NONSQUARE=1 BITMAP_FORMATS="rgb,png,webp"
      (SUBSCRIPTIONS: 1=aktiviert, 0=in Companion Settings deaktiviert;
       NONSQUARE + BITMAP_FORMATS erst ab Companion 5.0 — Feature-Detection via CAPS, nicht ApiVersion)

→ ADD-SUB SUBID=cwp/1/0/0 LOCATION=1/0/0 BITMAP=72 COLORS=hex TEXT=true TEXT_STYLE=true
      (+ ` BITMAP_FORMAT=webp` wenn per CAPS annonciert → BITMAP kommt als Data-URL, ~17× kleiner)
      (Alternative ab 5.0: `STYLE=<base64 JSON>` statt BITMAP/COLORS/TEXT/TEXT_STYLE —
       erlaubt non-square Dimensionen, z.B. {"bitmap":{"w":144,"h":72},"text":true,"textStyle":true,"colors":"hex"})
← ADD-SUB OK SUBID="cwp/1/0/0"
← SUB-STATE SUBID="cwp/1/0/0" PRESSED=0 TYPE=BUTTON COLOR=#ff0000 TEXT=<base64> BITMAP=<base64|data-url> FONT_SIZE=auto

→ SUB-PRESS SUBID=cwp/1/0/0 PRESSED=true           (bei onPointerDown)
→ SUB-PRESS SUBID=cwp/1/0/0 PRESSED=false          (bei onPointerUp / onPointerLeave / onPointerCancel)
← SUB-PRESS OK SUBID="cwp/1/0/0"

→ SUB-ROTATE SUBID=cwp/1/0/0 DIRECTION=1           (ChannelStrip Fader: +1 oder -1)

→ REMOVE-SUB SUBID=cwp/1/0/0
← REMOVE-SUB OK SUBID="cwp/1/0/0"
```

**SUBID-Format:** `cwp/<page>/<row>/<col>` — alphanumerisch + `-` + `/` erlaubt.  
**LOCATION-Format:** `<page>/<row>/<col>` — Companion native Syntax.  
**PING/PONG Keepalive ist nötig!** Companion schließt idle-Verbindungen nach ~5-7s. Client sendet `PING <ts>` alle 2s, erwartet `PONG` innerhalb 6s. Auch eingehende `PING` von Companion mit `PONG` beantworten.  
`CAPS SUBSCRIPTIONS=0` → User muss in Companion Settings „Button Subscriptions API" aktivieren.  
`FONT_SIZE="auto"` → ignorieren oder in `render.fontSize` mappen.  
Bei Socket-Close werden alle Subscriptions automatisch entfernt.

### ADD-DEVICE (verwendet vom Virtual Companion Deck — `VirtualSurfaceSession.ts`)

```
→ ADD-DEVICE DEVICEID="..." PRODUCT_NAME="..." KEYS_TOTAL=64 KEYS_PER_ROW=8 BITMAPS=72 COLORS=hex TEXT=true TEXT_STYLE=true
      (+ ` BITMAP_FORMAT=webp` wenn per CAPS annonciert — wie bei ADD-SUB)
← ADD-DEVICE OK DEVICEID="..."
← KEY-STATE DEVICEID=... KEY=30 TYPE=BUTTON COLOR=#ff0000 TEXT=Live BITMAP=<base64|data-url>
→ KEY-PRESS DEVICEID=... KEY=30 PRESSED=true/false
→ REMOVE-DEVICE DEVICEID="..."
```

---

## Message-Protocol Backend ↔ Frontend (WebSocket :8080)

```typescript
// Backend → Frontend (Delta: ein Key hat sich geändert)
{ t: "delta", hostId: string, page: number, row: number, col: number,
  bgColor?: string, textColor?: string, text?: string, bitmap?: string }

// Backend → Frontend (Snapshot: alle Keys — bei neuem Client-Connect)
{ t: "snapshot", hostId: string, page: number,
  keys: Record<string, KeyState> }   // "row:col" → { bgColor, textColor, text, bitmap }

// Backend → Frontend (Session-Status — pro Host)
{ t: "sessionStatus", hostId: string,
  status: "connecting" | "connected" | "stale" | "error" | "caps-disabled" }
// caps-disabled = CAPS SUBSCRIPTIONS=0, Toolbar zeigt orange Badge

// Backend → Frontend (Host-Info nach BEGIN-Handshake)
{ t: "hostInfo", hostId: string, companionVersion: string, apiVersion: string }

// Backend → Frontend (mDNS-Discovery-Stand — komplette Liste, kein Delta;
// nur aktiv solange /api/discovery/start lief)
{ t: "discovery", hosts: Array<{ id: string, name: string, address: string, port: number, apiVersion?: string }> }

// Frontend → Backend (Button-Press / Release)
{ t: "press", hostId: string, page: number, row: number, col: number, pressed: boolean }

// Frontend → Backend (Fader-Rotate für ChannelStrip)
{ t: "rotate", hostId: string, page: number, row: number, col: number, direction: 1 | -1 }
```

Backend-Port: 8080 (konfigurierbar via `server.port` in Settings oder `CLIENT_WS_PORT` env)  
Settings-Pfad: `../../CompanionWebpannelSettings.json` oder `SETTINGS_PATH` env

### HTTP-Endpoints des Backends (:8080)

| Methode + Pfad | Zweck |
|---|---|
| `GET /api/settings` | Aktuelle Settings als JSON (kompakt, kein pretty-print) |
| `POST /api/settings` | Settings speichern (atomisch tmp→rename); prüft Schema-Version, max. 1 MB Body |
| `POST /api/preview-page` | Temporäre Picker-Subscriptions starten — Body `{ hostId, page, keysPerRow, rows }` |
| `DELETE /api/preview-page?hostId&page` | Picker-Subscriptions beenden |
| `POST /api/discovery/start` / `.../stop` | mDNS-Browse an/aus (Browse-on-demand, HostManagerModal-Lifecycle; Watchdog stoppt nach 5 min automatisch). Ergebnisse kommen als `discovery`-WS-Broadcast |
| `GET /api/page-names?hostId=<id>` | Alle Companion-Seitennamen (1…maxPages) als Batch → `{ names: { "<page>": "<name>" } }`; parallel (Limit 20) via Companion-HTTP-API `:httpPort`, TTL-Cache 30 s; nicht ermittelbare Seiten fehlen in der Map |
| `GET /api/page-name?hostId=<id>&page=<n>` | Einzelner Seitenname → `{ name }` (`''` bei 403/404/Timeout — graceful) |

---

## Companion API — wichtige Erkenntnisse aus Implementierung

### Verbindungsprotokoll
- Port 16623 ist **WebSocket** (NICHT TCP `net.Socket`). `ws`-Library verwenden.
- Protokoll ist zeilenbasiert über WS-Text-Frames — `\n` als Delimiter, mehrere Zeilen pro Frame möglich → Line-Buffer im `message`-Handler nötig.

### Bitmap-Format
- **Legacy (immer, einziges Format bei Companion ≤ 4.3):** Raw-RGB (width × height × 3 Bytes, kein Header).
  base64-Länge bei 72px: `72 × 72 × 3 = 15552 Bytes → 20736 Zeichen base64`.
  Konvertierung: Raw-RGB → RGBA (α=255) → `ImageData` → Canvas → `.toDataURL('image/png')` (siehe `utils/bitmap.ts`).
- **Ab Companion 5.0 (API 1.12) mit negotiiertem `BITMAP_FORMAT=webp|png`:** BITMAP kommt als
  selbstbeschreibende Data-URL `data:image/webp;base64,…` — ~17× kleiner als raw (72px: 1227 statt 20736 Zeichen).
  Backend ist Passthrough; Frontend erkennt am `data:`-Prefix und reicht direkt an `<img src>` durch (kein Canvas, kein Cache).
- Erkennungslogik in `utils/bitmap.ts`: `data:`-Prefix → Passthrough; `base64.length ≈ expectedB64Len (±4)` → Raw-RGB; sonst MIME-Detection (JPEG `/9j/`, PNG `iVBOR`).

### Text-Encoding
- Companion encodiert Zeilenumbrüche als **literale zwei Zeichen `\n`** (Backslash + n), nicht als echten Newline.
- Fix im Parser: `state.text = decoded.replace(/\\n/g, '\n')` in `SatelliteClient.ts`.
- Im Renderer: `text.split('\n').map((line, i) => ...)` mit `<br />` zwischen Zeilen.

### TEXT-Feld
- Companion encodiert den Text manchmal als Base64-UTF8 → `decodeBase64Utf8()` versucht Decodierung, fällt zurück auf Rohwert wenn kein valider UTF8-Text.

### Frontend WS-Reconnect — Race-Condition-Fix in `useWebSocket.ts`
- **Problem:** `onclose`-Handler einer alten Socket-Instanz setzte `ws.current = null`, obwohl `ws.current` bereits auf eine neue Socket-Instanz zeigte → alle Presses schlugen stumm fehl
- **Fix:** `if (ws.current === socket)` vor `ws.current = null` — nur nullen wenn diese Socket noch die aktuelle ist
- **Fix 2:** `connect()` bricht ab wenn readyState `CONNECTING` (0) oder `OPEN` (1) — verhindert doppelte Socket-Instanzen
- **Surface-Name:** Verwendet `os.hostname()` (Backend-Rechner) statt `hostId` (Companion-Server)

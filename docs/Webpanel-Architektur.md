# Webpanel für Bitfocus Companion – Architektur (v2.0)

> Aktualisiert 2026-07-13 (Stand v1.4.1, Companion-5.0-Adoption).
> v1.1 beschrieb noch das ADD-DEVICE-pro-Page-Modell mit Wizard/surfaceConfig —
> das wurde in Phase 4 durch die Button Subscriptions API ersetzt (siehe `docs/phase-history.md`).

## Ziel

Ein lokal betriebenes **Webpanel als PWA + Electron-Desktop-App**, das **Companion-Buttons in Echtzeit spiegelt** (Bitmap/Farben/Text) und **Button-Presses/Rotates** an Companion sendet — vollständig im LAN, erreichbar von PC/Mac/Tablet.
Kommunikation über die **Companion Satellite API** (WebSocket :16623, Button Subscriptions ab API 1.10) plus die **allgemeine Companion-HTTP-API** (:8000) für Seitennamen.

---

## Architektur-Überblick

```
[Companion 4.3+/5.0] ←WS:16623→ [Node Backend] ←WS/HTTP:8080→ [React PWA / Browser]
      │  └ HTTP:8000 (Seitennamen) ─┘                              │
      │                                                    [Electron-Wrapper]
      │                                                    (Tray, Startup-Fenster,
      └ mDNS-Announce (_companion-satellite-ws._tcp) ┐      PanelWindow, Backend
                                                     └──→   im Main Process)
```

### Backend-Komponenten (`packages/backend`)

| Komponente | Aufgabe |
|---|---|
| `SatelliteClient` (1 pro Host) | WS-Verbindung zu Companion; BEGIN/CAPS-Handshake, ADD-SUB/REMOVE-SUB/SUB-PRESS/SUB-ROTATE, PING/PONG-Keepalive (2 s / 6 s Timeout), Exponential-Backoff-Reconnect mit Re-Subscribe. Ab Companion 5.0: Bitmap-Format-Negotiation (CAPS `BITMAP_FORMATS` → `BITMAP_FORMAT=webp`) und Non-square via `STYLE`-Param (CAPS `NONSQUARE`) |
| `HostManager` | Orchestrierung: 1 Client pro Host (autoConnect-gesteuert); diffst gewünschte Subscriptions aus den Panel-Elementen (`realSubDims`, "WxH"-Strings — Dimensionsänderung → Re-Subscribe); temporäre Picker-Subscriptions; Press/Rotate-Routing |
| `bitmapDims.ts` | `deriveBitmapDims(elW, elH, base)`: quantisiert Element-Geometrie auf Aspect-Stufen {1:2, 9:16, 3:4, 1:1, 4:3, 16:9, 2:1} für Non-square-Subscriptions (nicht persistiert) |
| `StateStore` | In-Memory-State, Key `hostId:page:row:col`; liefert Deltas (nur Änderungen) + Snapshots; Sekundär-Indizes für O(k) `clearHost` |
| `ClientServer` | HTTP + WS auf :8080 für Browser-Clients: Settings-API, Picker-Preview, Discovery-Steuerung, Seitennamen-Proxy, Static-Serving (Electron-Build); Press-Tracker sendet PRESSED=false bei Client-Disconnect |
| `DiscoveryService` | mDNS-Browse nach `companion-satellite-ws` (Companion 5.0 announced via Bonjour); Browse-on-demand (nur solange HostManagerModal offen), Watchdog-Auto-Stop 5 min; fqdn-Dedupe, erste nicht-link-locale IPv4, TXT `protocolVersion` |
| `pageNames.ts` | `PageNameResolver`: Seitennamen aus der Companion-HTTP-API (`/api/variable/internal/page_number_<N>_name/value`); TTL-Cache 30 s, Timeout 1,5 s; `resolveMany()` Batch mit Worker-Pool (Concurrency 20) |
| `VirtualSurfaceManager` / `VirtualSurfaceSession` | ADD-DEVICE-Pfad fürs `virtualCompanionDeck`-Element: registriert echtes Surface (Companion weist Seite zu), KEY-STATE → vDelta-Batches, KEY-PRESS |

Backend ist **State-Broker**: cached alle SUB-STATEs und sendet nur Deltas. Frontend ist **stateless** und rendert nur was sich ändert.

### Frontend (`packages/frontend`, React + Zustand + Vite/PWA)

- `useWebSocket`: WS-Hook mit Auto-Reconnect; verarbeitet `delta/snapshot/sessionStatus/hostInfo/discovery/vDelta(Batch)/vSnapshot/vSessionStatus`
- `useAppStore` (Zustand): Settings, Button-States, Session-Status, discoveredHosts (transient), Undo/Redo, Panel-/Element-CRUD
- `utils/bitmap.ts`: raw-RGB → Canvas → PNG-Data-URL (mit FIFO-Cache); `data:`-URLs (webp/png ab Companion 5.0) werden direkt durchgereicht
- Elemente: `companionButton`, `shape`, `label`, `channelStrip`, `virtualCompanionDeck` — alle erben `BaseElement` (`id, type, x, y, w, h, z, layer, locked`)
- Edit-Mode: @dnd-kit-Drag + custom Resize, Lasso-Selektion, Grid-Snap, 4 Named Layers, Zoom 0.2–2.0

### Electron (`packages/electron`)

Backend läuft direkt im Main Process (kein Child-Process); esbuild bündelt alles in `dist/main.js`. Startup-Fenster (Port-Edit, Host-Status), Tray (Status-Icons, Open in App/Browser), PanelWindow (1280×720), Settings in `userData/companionwebpanel.json` mit automatischer Migration — Konfigurationsdatei wird **nie** auto-erstellt.

---

## Protokoll-Pfade

### 1. Button Subscriptions (Standard-Pfad, `companionButton`/`channelStrip`)

```
← BEGIN CompanionVersion="5.0.0" ApiVersion="1.12.0"
← CAPS SUBSCRIPTIONS=1 NONSQUARE=1 BITMAP_FORMATS="rgb,png,webp"
→ ADD-SUB SUBID=cwp/1/0/0 LOCATION=1/0/0 BITMAP=72 COLORS=hex TEXT=true TEXT_STYLE=true [BITMAP_FORMAT=webp]
→ ADD-SUB SUBID=cwp/1/0/1 LOCATION=1/0/1 STYLE=<b64 {"bitmap":{"w":144,"h":72},…}> BITMAP_FORMAT=webp   ← non-square
← SUB-STATE SUBID="cwp/1/0/0" COLOR=#ff0000 TEXT=<b64> BITMAP=<raw-b64 | data:image/webp;base64,…>
→ SUB-PRESS / SUB-ROTATE
```

Subscriptions sind **dynamisch**: Settings-Save (Ctrl+S) diffst Elemente gegen aktive Subs — neu → ADD-SUB, entfernt → REMOVE-SUB, Dimensionen geändert → Re-Subscribe. Feature-Detection läuft **immer über CAPS-Keys, nie über ApiVersion**; alle 5.0-Features degradieren auf 4.3 aufs exakte Alt-Verhalten.

### 2. Virtual Companion Deck (ADD-DEVICE-Pfad)

Registriert ein echtes Surface (`KEYS_TOTAL/KEYS_PER_ROW` aus dem Element-Grid); Companion weist die Seite über seine Surface-UI zu. Nutzt ebenfalls die Bitmap-Format-Negotiation.

### 3. Companion-HTTP-API (Seitennamen)

Die Satellite API hat keine PAGE-NAME-Message → Backend-Proxy fragt `GET :httpPort/api/variable/internal/page_number_<N>_name/value` ab (Batch beim Picker-Öffnen, ~150 ms für 99 Seiten). Interne Variablen sind read-only; Namen ändern nur in der Companion-UI. Graceful: ohne HTTP-API zeigt der Picker nur Nummern.

Vollständige Kommandos/Endpoints: `docs/ws-protocol.md` · Satellite-Referenz: `docs/satellite-api-protocol.md` (v1.12).

---

## Datenmodelle (Kern, `packages/shared/src/types.ts`)

```typescript
Settings { version: '1.8.0', activeHostId, hosts: HostProfile[], panels: Panel[], server?, language?, settingsPath? }

HostProfile { id, name, host, satellite: { wsPort }, httpPort?,        // 8000 — Seitennamen-Proxy
              notes?, autoConnect?, showInToolbar?, gridCols?, gridRows?, maxPages?, pageNames? }

CompanionRef { hostId, page, row, col }                                 // zeigt auf einen Companion-Button
KeyState     { bgColor?, textColor?, text?, bitmap? }                   // bitmap: raw-RGB-b64 ODER data:-URL
DiscoveredHost { id(fqdn), name, address, port, apiVersion? }           // mDNS-Fund
```

---

## Edit-Mode vs. View-Mode

| Eigenschaft | View-Mode | Edit-Mode |
|---|---|---|
| Button-Klick | löst SUB-PRESS aus (echte Haltezeit via PointerDown/Up) | selektiert Element |
| Drag & Drop / Resize | deaktiviert | frei (Grid-Snap, Mindestgröße = bitmapSize bei enforceMinSize) |
| Element hinzufügen/löschen | nicht möglich | `+`-Button / Rechtsklick / Entf |
| Host-Labels, Grid-Overlay | aus | einblendbar |

---

## Performance- & Stabilitätsregeln

- **Keepalive** PING/PONG (2 s, Timeout 6 s) — Companion schließt idle-Verbindungen nach ~5–7 s
- **Delta statt Full-State** an Webclients; vDelta-Batches fürs Virtual Deck
- **WebP-Bitmaps** ab Companion 5.0 (~17× kleiner); raw-RGB-Fallback mit Frontend-Konvertierungs-Cache (500 Einträge FIFO)
- **Aspect-Quantisierung** verhindert Re-Subscribe-Churn beim Element-Resize
- **TTL-Caches**: Seitennamen 30 s (auch leere Ergebnisse — kein Timeout-Hämmern)
- **Line-Buffer-Guards** (10 MB) + Body-Size-Limits (1 MB) gegen Protokoll-/DoS-Fehler

## Security (LAN)

- Bind auf `0.0.0.0`, nur fürs LAN gedacht — kein Auth im MVP
- mDNS (UDP 5353) nur on-demand; Windows-Firewall-Prompt beim ersten Browse

---

## Quellen

- Satellite API v1.12: `docs/satellite-api-protocol.md` (lokale Kopie) · https://github.com/bitfocus/website
- Referenz-Implementierung: https://github.com/bitfocus/companion-satellite
- Alle Architektur-Entscheidungen: `docs/decisions.md` · Historie: `docs/phase-history.md`

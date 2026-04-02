# Webpanel für Bitfocus Companion – Umsetzungsbeschreibung (Zusammenfassung)

**Ziel:** Ein lokal laufendes, im LAN erreichbares Webpanel (PWA/Kiosk), das Companion-Buttons performant spiegelt (Text/Farben/Bitmap) und auslösen kann.

---

## 1. Foundation / Rahmenbedingungen

- **Webpanel** über Webseite/PWA, im **Kiosk‑Modus** ohne Browser-Menüleisten nutzbar (Tablet Standalone, Desktop `--app=`).  
- **Erreichbar im lokalen Netzwerk** (PC, Mac, Tablet).  
- **Läuft lokal** auf PC oder Mac (Node‑Backend + Web‑Frontend).  
- **Einstellungen speichern/laden** als lokale Datei: `CompanionWebpannelSettings.json`.

---

## 2. API‑Entscheidung: Satellite API (Output/Spiegelung) + Satellite KEY‑PRESS (Input)

### Warum Satellite API

- Satellite ist dafür gedacht, Remote‑Surfaces mit Companion zu verbinden und **Button‑State als Push‑Updates** zu liefern (z. B. `KEY-STATE` mit **BITMAP**, **COLOR**, **TEXTCOLOR**, **TEXT**, optional **FONT_SIZE**). citeturn1search8  
- Verbindung ist seit Companion 3.5 **auch über WebSockets** möglich (Default-Port 16623; TCP klassisch 16622). citeturn1search8  

### Button‑Press über Satellite

- Button‑Interaktion wird über `KEY-PRESS` (Simple Mode: `KEY=<n>`, Advanced Mode: `CONTROLID`) an Companion gesendet. citeturn1search8  

> **Hinweis:** Für MVP wird der Press‑Pfad ausschließlich über Satellite `KEY‑PRESS` umgesetzt (kein HTTP erforderlich). citeturn1search8

---

## 3. Implementierungsstack (Option 1)

### Gewählter Stack

- **Frontend:** TypeScript + React (PWA)
- **Backend:** Node.js (TypeScript)

**Begründung:** Einheitliche Sprache/Typen über Frontend/Backend, gute WebSocket‑Unterstützung, und das offizielle Companion‑Satellite Projekt ist ebenfalls TypeScript‑basiert (Bewährtes Muster für Satellite‑Connectivity). citeturn1search23

---

## 4. Pragmatik: Wizard für Surface→Page Zuordnung

Wizard:

- Backend verwaltet PageSurfaces: Map<PageNumber, SatelliteConnection>
- Beim ersten Button einer Page:

  1. Satellite‑Connection aufbauen (WS 16623) [companion.free]
  2. ADD-DEVICE senden mit DEVICEID="webpanel:page-5" und PRODUCT_NAME="Webpanel Page 5" [companion.free]
  3. Simple Mode reicht erstmal: KEYS_TOTAL, KEYS_PER_ROW, BITMAPS=72, COLORS=hex, TEXT=true, TEXT_STYLE=true (alles in Spec beschrieben) [companion.free]
  4. Companion beginnt KEY‑STATE zu senden → du spiegelst.

> „Bitte in Companion → Surfaces → **Webpanel Page 5** → **Startup Page = 5** setzen; Navigation deaktivieren/ignorieren.”

- **Manuell ist erlaubt** (Entscheidung bestätigt).
- Ziel: Für jeden im Webpanel genutzten Button/Widget existiert pro Companion‑Page eine passende „Data‑Surface“

---

## 5. Satellite API Modus: Simple Mode (MVP)

- MVP nutzt **Satellite Simple Mode** (uniformes Grid, gemeinsame Rendering‑Optionen pro Device). citeturn1search8  
- Empfohlene Parameter (MVP‑Richtung): Bitmaps in **72px**, Farben als **hex/rgb**, Text & Text‑Style aktiviert – gemäß Satellite‑Spec. citeturn1search8

**Advanced Mode** (LAYOUT_MANIFEST) ist explizit *nicht* Bestandteil des MVP und kann später als Optimierung ergänzt werden. citeturn1search8

---

## 6. UI‑Anforderungen (OK)

- Button „+“ anlegen mit Eingabe **Seite/Zeile/Spalte** (Companion).  
- Webpanel‑Buttons haben **frei definierbare Touch‑Fläche** (Höhe/Breite), Companion‑Bitmap/Info **zentriert** in Originalgröße (z. B. 72px).  
- Spiegeln von **Text, Textfarbe, Bitmap, Hintergrundfarbe** aus Satellite `KEY-STATE`. citeturn1search8  
- Auf einer Webpanel‑Page können Buttons von **mehreren Companion‑Pages** angezeigt werden (über mehrere Hintergrund‑Surfaces).  
- Ein-/ausblendbares **Grid** zum Ausrichten.  
- **Audio‑Meter** als dynamische Grafik, Quelle z. B. aus Button‑Text (Satellite TEXT). citeturn1search8  
- Hintergrund‑Formen (Rechtecke) zur optischen Gruppierung; frei in Größe/Farbe.  
- Textfelder (Beschreibungen) frei in Größe/Farbe/Font.  
- **Zoom‑Level** für gesamte Oberfläche, um verschiedene Auflösungen zu unterstützen.  
- Menü: Speichern/Laden von Layouts/Presets (lokal in `CompanionWebpannelSettings.json`).
- Menü: Auswahl/Verwaltung mehrerer Companion Hosts (IP/Ports), schneller Wechsel.

---

## 7. Performance / Effizienz (OK Super)

- Backend als **State‑Broker**: hält Satellite‑Verbindungen, cached Button‑States und pusht nur Deltas an Clients. citeturn1search8  
- Bitmap‑Handling: Caching/Dedupe, um Re‑Renders und Bandbreite zu minimieren.
- Webclient: Rendering optimiert (Memoization, nur geänderte Controls neu zeichnen).

---

## 8. Deployment / Packaging (OK)

- **Nur PWA** (kein Electron/Tauri im MVP).  
- Start: **Server + Browser/PWA**
  - Tablet: PWA Standalone möglich
  - Desktop: Chrome/Edge `--app=` (Kiosk‑like)

---

## 9. Rahmenannahmen (bestätigt)

- Surface→Page Zuordnung **darf manuell** erfolgen.
- Erwartete gleichzeitige Pages: **5–10 Companion‑Pages**.

---

## 10. Nächster Schritt (Angebot)

Wenn du willst, kann ich dir als nächsten Schritt erstellen:

1. **Technisches Architektur‑Dokument** (Komponenten, Datenmodelle, Message‑Flows)
2. **JSON‑Schema** für Layout/Presets (`CompanionWebpannelSettings.json`)
3. Oder direkt ein **PoC‑Repo‑Skeleton** (Node + WS‑Broker + React PWA)

---

## 11. Relevante Docs / Quellen

- Satellite API (Protokoll, Ports, Simple/Advanced Mode, KEY‑STATE/KEY‑PRESS): [companion.free – Satellite API](citeturn1search8)  
- Companion Satellite (Referenz‑Implementierung / Architekturpattern): [GitHub – bitfocus/companion-satellite](citeturn1search23)

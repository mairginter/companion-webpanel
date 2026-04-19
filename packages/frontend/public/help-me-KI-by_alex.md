# Companion Webpanel — KI-Kontext-Datei

Diese Datei beschreibt alle Features und Konfigurationsmöglichkeiten von Companion Webpanel.
Sie ist optimiert für das Lesen durch KI-Assistenten.

---

## Projektübersicht

Companion Webpanel ist ein frei gestaltbares Touch-Panel für Bitfocus Companion. Es ermöglicht, viele Funktionen übersichtlich, strukturiert und kategorisiert darzustellen und zu steuern. Das Panel läuft lokal als Web-App und ist im LAN von jedem Gerät (PC, Mac, Tablet, Smartphone) über den Browser erreichbar. Mehrere Nutzer können gleichzeitig verbunden sein.

Das Panel kommuniziert mit Bitfocus Companion über die Satellite API (WebSocket auf Port 16623). Button-Zustände (Bitmap, Farbe, Text) werden in Echtzeit synchronisiert. Button-Presses werden vom Panel an Companion weitergeleitet.

Mindestanforderung: Bitfocus Companion 4.3.0 oder neuer, mit aktivierter Option "satellite_subscriptions_enabled" in den Companion-Einstellungen.

Verfügbar als:
- Web-App: läuft als Node.js-Prozess, erreichbar im Browser unter http://localhost:PORT
- Electron Desktop-App: eigenständige Anwendung mit Tray-Icon, Startup-Fenster und eingebettetem Browser

---

## Verbindung einrichten (Hosts)

Ein Host ist eine Verbindung zu einer Bitfocus Companion-Instanz. Mehrere Hosts können gleichzeitig verbunden werden — jeder Host ist eine eigene Companion-Instanz (z.B. auf verschiedenen Rechnern im Netzwerk).

Host-Konfiguration erfolgt über den Host-Manager (Toolbar → Hosts-Symbol).

Felder pro Host:
- Name: Anzeigename im Panel (frei wählbar)
- Host/IP: IP-Adresse oder Hostname des Companion-Rechners
- Port: WebSocket-Port der Satellite API (Standard: 16623)
- Automatisch verbinden (autoConnect): wenn deaktiviert, wird dieser Host beim Start nicht verbunden
- In Toolbar anzeigen (showInToolbar): wenn deaktiviert, erscheint der Status-Punkt dieses Hosts nicht in der Toolbar

Der Verbindungsstatus wird in der Toolbar als farbiger Punkt pro Host angezeigt:
- Blau: verbindet
- Grün: verbunden
- Orange: Verbindung verloren, Wiederverbindung läuft
- Rot: Fehler

---

## Panel-Canvas

Ein Panel ist eine konfigurierbare Arbeitsfläche mit Elementen. Es können mehrere Panels angelegt werden (über das Panel-Dropdown in der Toolbar).

Canvas-Konfiguration:
- Breite und Höhe in Pixeln (Preset-Dropdown oder manuelle Eingabe, z.B. 1920×1080)
- Die letzten 5 verwendeten Canvas-Größen werden gespeichert
- Zoom: Ctrl+Scroll oder Zoom-Control in der Toolbar (10%–200%)
- Grid: visuelle Rasterlinien (Major + Minor), ein/aus mit G-Taste
- Snap: Elemente rasten am Raster ein, ein/aus mit S-Taste (nur im Edit-Modus)

Modi:
- View-Modus (V): Buttons lösen Companion-Aktionen aus, kein Drag
- Edit-Modus (E): Elemente verschieben, skalieren, konfigurieren — kein Button-Press

---

## Canvas-Elemente

### CompanionButton

Spiegelt einen Companion-Button in Echtzeit. Zeigt Bitmap, Hintergrundfarbe und Text so an wie Companion ihn darstellt.

Konfigurierbare Properties:
- Host: welche Companion-Instanz (Host-ID)
- Page: Companion-Seite (Zahl)
- Row: Zeile auf der Companion-Seite
- Col: Spalte auf der Companion-Seite
- Border-Radius: abgerundete Ecken (px)
- Physical Style: aktiviert einen silber-metallischen Rahmen mit konkaver Dom-Fläche (3D-Optik)
- Text-Align: Textausrichtung (left, center, right)
- Bitmap skalieren (scaleBitmap): Companion-Bitmap füllt den Button, auch wenn er größer als 72×72px ist
- Hintergrundfarbe anzeigen (showBgColor): Companion-Hintergrundfarbe als Button-Hintergrund verwenden

Im View-Modus: Klick/Touch löst KEY-PRESS in Companion aus.

### Shape

Ein Rechteck zur visuellen Gruppierung von Elementen auf dem Canvas.

Konfigurierbare Properties:
- Fill-Farbe (Hintergrundfarbe)
- Stroke-Farbe (Rahmenfarbe)
- Stroke-Breite (px)
- Border-Radius (px)
- Textur: CSS-basierte Canvas-Textur (keiner, Carbon, Leder, Metall, etc.)
- Opacity (0–100%)

Shape-Elemente reagieren nicht auf Klicks im View-Modus.

### Label

Statischer Text für Beschriftungen, Überschriften und Kategorientitel.

Konfigurierbare Properties:
- Text-Inhalt
- Textfarbe
- Schriftgröße (px)
- Schriftfamilie
- Textausrichtung (left, center, right)

Label-Elemente reagieren nicht auf Klicks im View-Modus.

### ChannelStrip

Ein Audio-Mixer-Kanal-Element. Stellt Pegelanzeige (Meter L/R), Fader, Mute-Button, Solo-Button, Pan-Regler und Kanalname dar. Alle Werte werden über Companion-Button-Referenzen gesteuert.

Funktionsweise: Jedes Steuerelement (Meter, Fader, Mute etc.) ist mit einem Companion-Button verknüpft. Der Button-Text des Companion-Buttons wird via Text-Parsing interpretiert — ein spezielles Format teilt die Datenwerte auf.

Text-Parsing-Format: Die Werte im Button-Text sind durch ein Trennzeichen (Standard: |) separiert. Die Reihenfolge wird über Index-Einstellungen konfiguriert:
- Index 0: Meter L (Pegel links, 0–100)
- Index 1: Meter R (Pegel rechts, 0–100)
- Index 2: Fader-Position (0–100)
- Index 3: Kanalname

Fader-Bedienung: vertikales Drag mit Maus oder Touch sendet SUB-ROTATE an Companion.
Drum-Wheel: alternatives Scrollrad-Element, ein/ausblendbar.
Mute-Button: löst KEY-PRESS auf dem konfigurierten Mute-Companion-Button aus.
Solo-Button: wird nur angezeigt wenn ein Solo-Companion-Button konfiguriert ist.
Pan-Regler: wird nur angezeigt wenn ein Pan-Companion-Button konfiguriert ist.

Konfigurierbare Properties:
- Refs: Companion-Button-Referenz für jedes Steuerelement (Meter L, Meter R, Fader, Mute, Solo, Pan, Name)
- Trennzeichen (Separator)
- Index pro Wert
- Wheel anzeigen (showWheel)

### VirtualCompanionDeck

Eine eigenständige virtuelle Companion-Oberfläche. Erscheint als Grid von Buttons in Companion (wie ein physisches Streamdeck). Alle Buttons dieser Oberfläche sind direkt im Panel bedienbar.

Der Unterschied zu CompanionButton: VirtualCompanionDeck registriert eine eigene Surface-Session bei Companion. Companion behandelt es wie ein physisches Gerät. Das gesamte Grid ist in einem einzigen Element auf dem Canvas untergebracht.

Konfigurierbare Properties:
- Cols: Anzahl Spalten (1–16)
- Rows: Anzahl Zeilen (1–8)
- Fallback-Farbe: Hintergrundfarbe für leere Buttons
- Physical Style: 3D-Dom-Optik für alle Buttons
- Bitmap skalieren (scaleBitmap)
- Text-Align
- Hintergrundfarbe anzeigen (showBgColor)

---

## Edit-Modus-Funktionen

Im Edit-Modus (E-Taste) können Elemente bearbeitet werden:

- Drag: Element anklicken und ziehen
- Resize: Anfasser an den Ecken und Kanten des Elements
- Grid Snap: Drag und Resize rasten am Raster ein (wenn Snap aktiv)
- Multi-Select Lasso: Maus auf leere Canvas-Fläche ziehen → Lasso-Rahmen wählt alle überlappenden Elemente
- Shift-Klick: einzelne Elemente zur Selektion hinzufügen/entfernen
- Duplizieren: Ctrl+D — dupliziert alle selektierten Elemente mit +75px Versatz
- Löschen: Entf-Taste — löscht alle selektierten Elemente
- Stil kopieren: Ctrl+Shift+C — kopiert die Stil-Properties des selektierten Elements
- Stil einfügen: Ctrl+Shift+V — überträgt kopierten Stil auf alle selektierten Elemente
- Undo: Ctrl+Z
- Redo: Ctrl+Y
- Element sperren (Lock): gesperrte Elemente können nicht verschoben oder gelöscht werden
- Properties Panel: rechts eingeblendet wenn ein Element selektiert ist — zeigt alle konfigurierbaren Eigenschaften

---

## Keyboard Shortcuts

| Shortcut          | Aktion                              |
|-------------------|-------------------------------------|
| Ctrl+S            | Speichern                           |
| Ctrl+Z            | Rückgängig (Undo)                   |
| Ctrl+Y            | Wiederholen (Redo)                  |
| Ctrl+D            | Element(e) duplizieren              |
| Ctrl+Shift+C      | Stil kopieren                       |
| Ctrl+Shift+V      | Stil einfügen                       |
| V                 | View-Modus aktivieren               |
| E                 | Edit-Modus aktivieren               |
| G                 | Grid ein/aus                        |
| S                 | Snap ein/aus (nur Edit-Modus)       |
| Entf / Backspace  | Selektierte Elemente löschen        |
| ↑ ↓ ← →          | Element verschieben (1 px)          |
| Shift + ↑ ↓ ← →  | Element verschieben (10 px)         |
| Escape            | Auswahl aufheben                    |

---

## Einstellungen (Settings)

Einstellungen werden über die Settings-API gespeichert (POST /api/settings). Die Konfigurationsdatei liegt im userData-Verzeichnis der Electron-App bzw. als JSON-Datei neben dem Backend-Prozess.

Konfigurierbare Einstellungen:
- Server-Port (Standard: 8080): auf welchem Port das Backend läuft
- Sprache (language): de (Deutsch) oder en (Englisch) — gilt für alle UI-Strings
- Hosts: Liste aller Companion-Verbindungen (siehe Abschnitt "Verbindung einrichten")
- Panels: alle Canvas-Panels mit ihren Elementen und Canvas-Einstellungen

---

## Electron-App

Die Electron-Version läuft als Desktop-Anwendung:

- Tray-Icon in der Taskleiste: Rechtsklick öffnet das Kontextmenü mit Schnellzugriff
- Startup-Fenster (400×240px): zeigt Verbindungsstatus, Port und Schnellzugriff-Buttons
  - "Im Browser öffnen": öffnet das Panel im Standard-Browser
  - "In App öffnen": öffnet das Panel in einem eingebetteten Fenster (1280×720px)
  - Port-Feld: Port ändern → App neu starten mit neuem Port
- Single-Instance: nur eine Instanz gleichzeitig möglich; zweite Instanz bringt das Startup-Fenster in den Vordergrund
- Beim Schließen aller Fenster bleibt die App aktiv (Tray-App)
- Beenden: über Tray-Menü → Bestätigungsdialog

# Companion Webpanel — KI-Kontext-Datei

Diese Datei beschreibt alle Features und Konfigurationsmöglichkeiten von Companion Webpanel.
Sie ist optimiert für das Lesen durch KI-Assistenten.

---

## Projektübersicht

Companion Webpanel ist ein frei gestaltbares Touch-Panel für Bitfocus Companion. Es ermöglicht, viele Funktionen übersichtlich, strukturiert und kategorisiert darzustellen und zu steuern. Das Panel läuft lokal als Web-App und ist im LAN von jedem Gerät (PC, Mac, Tablet, Smartphone) über den Browser erreichbar. Mehrere Nutzer können gleichzeitig verbunden sein.

Das Panel kommuniziert mit Bitfocus Companion über die Satellite API (WebSocket auf Port 16623). Button-Zustände (Bitmap, Farbe, Text) werden in Echtzeit synchronisiert. Button-Presses werden vom Panel an Companion weitergeleitet.

Mindestanforderung: Bitfocus Companion 4.3.0 oder neuer, mit aktivierter Option "satellite_subscriptions_enabled" in den Companion-Einstellungen.

Ab Companion 5.0 nutzt das Panel automatisch komprimierte WebP-Bitmaps (Satellite API 1.12) — Button-Grafiken sind dadurch ~17× kleiner als das Raw-RGB-Format älterer Companion-Versionen. Das passiert transparent per Feature-Detection; es ist keine Konfiguration nötig, und mit Companion 4.3 bleibt alles wie bisher.

Settings-Schema-Version: **1.8.0**

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
- Notizen: freies Textfeld
- Button-Grid: Spalten und Zeilen für den Button-Picker (Standard: 8×4)
- Max. Pages: maximale Seiten-Anzahl im Picker-Dropdown

Der Verbindungsstatus wird in der Toolbar als farbiger Punkt pro Host angezeigt:
- Blau/Orange (animiert): verbindet
- Grün: verbunden
- Orange: Verbindung verloren, Wiederverbindung läuft
- Rot: Fehler

Wenn ein Host im Companion die "Button Subscriptions API" nicht aktiviert hat, erscheint eine orangene Warnung mit dem Pfad zur Einstellung.

---

## Panel-Canvas

Ein Panel ist eine konfigurierbare Arbeitsfläche mit Elementen. Es können mehrere Panels angelegt werden (Panel-Dropdown in der Toolbar: + Neu, Umbenennen, Duplizieren, Löschen).

Canvas-Konfiguration:
- Breite und Höhe in Pixeln (Preset-Dropdown oder manuelle Eingabe, z.B. 1920×1080)
- Die letzten 5 verwendeten Canvas-Größen werden gespeichert
- "Verfügbaren Bereich übernehmen": setzt Canvas auf die aktuelle Fenstergröße minus Toolbar
- Hintergrundfarbe des Canvas
- DPI-Hinweis bei Windows-Skalierung: Canvas-Größe in logischen CSS-px eingeben, nicht physischen Pixeln

Zoom:
- Ctrl+Scroll oder Zoom-Control in der Toolbar (20%–200%)
- **Auto-Zoom (Fit to Window):** "Fit"-Button im Zoom-Flyout der Toolbar. Wenn aktiv, berechnet der Canvas den Zoom automatisch so, dass der gesamte Canvas ins Fenster passt. Der Zoom passt sich bei jeder Fenstergrößenänderung neu an. Ctrl+Scroll deaktiviert Auto-Zoom und übernimmt den aktuellen Zoom-Wert für manuelles Zoomen. Auto-Zoom ist pro Panel gespeichert.

Grid:
- Visuelle Rasterlinien (Major + Minor), ein/aus mit G-Taste
- Snap: Elemente rasten beim Drag und Resize am Raster ein, ein/aus mit S-Taste (nur Edit-Modus)

Modi:
- View-Modus (V): Buttons lösen Companion-Aktionen aus, kein Drag
- Edit-Modus (E): Elemente verschieben, skalieren, konfigurieren — kein Button-Press

---

## Canvas-Elemente

### Ebenen (Named Layers)

Alle Elemente sind einer von vier benannten Ebenen zugewiesen. Die Ebene bestimmt die Zeichenreihenfolge (Stacking Order). Innerhalb einer Ebene gibt es zusätzlich eine Z-Reihenfolge.

Ebenen (von unten nach oben):
- **Background** (0): Hintergrundelemente (Shapes, Bilder)
- **Lower** (1): zweite Ebene
- **Main** (2): Standard für neue Elemente
- **Overlay** (3): oberste Ebene (für Beschriftungen, Status-Overlays)

Ebene im PropertiesPanel ändern: 4 Buttons (Background / Lower / Main / Overlay).
Reihenfolge innerhalb einer Ebene: "Eine Ebene nach vorne" / "Eine Ebene nach hinten" (bei Einzel-Selektion).
Ganz nach vorne / Ganz nach hinten: verschiebt innerhalb der aktuellen Ebene an den Rand.

### CompanionButton

Spiegelt einen Companion-Button in Echtzeit. Zeigt Bitmap, Hintergrundfarbe und Text so an wie Companion ihn darstellt.

Konfigurierbare Properties:
- Host: welche Companion-Instanz (Host-ID)
- Page: Companion-Seite (Zahl)
- Row: Zeile auf der Companion-Seite
- Col: Spalte auf der Companion-Seite
- Border-Radius: abgerundete Ecken (px)
- Physical Style: aktiviert einen silber-metallischen Rahmen mit konkaver Dom-Fläche (3D-Optik). Im View-Modus skaliert die Dom beim Drücken leicht ein.
- Text-Align: Textausrichtung (left, center, right)
- Bitmap skalieren (scaleBitmap): Companion-Bitmap füllt den Button, auch wenn er größer als 72×72px ist
- Bitmap-Auflösung (bitmapSize): Auflösung der von Companion angeforderten Bitmap — Werte: 72 / 100 / 144 / 200 px (Standard: 72). Nur sichtbar wenn "Bitmap anzeigen" aktiv ist. Höhere Auflösung verbessert die Bildqualität bei großen Buttons, erhöht aber den Datenverbrauch (quadratisch: 144px = 4× mehr Daten als 72px). Das Backend subscribed Companion mit dem gesetzten Wert (`ADD-SUB BITMAP=N`) und führt bei Auflösungsänderung automatisch einen Re-Subscribe durch.
- Hintergrundfarbe anzeigen (showBgColor): Companion-Hintergrundfarbe als Button-Hintergrund verwenden
- Text anzeigen (showText): Companion-Button-Text einblenden
- Schriftgröße: wird bei kleinen Buttons automatisch auf min. 7px begrenzt

Im View-Modus: Klick/Touch löst KEY-PRESS in Companion aus.

**Multi-Button-Editing:** Wenn ≥2 CompanionButtons selektiert sind, erscheint im PropertiesPanel ein Batch-Edit-Panel. Felder mit gemischten Werten zeigen "—" (indeterminate). Nur geänderte Felder werden auf alle selektierten Buttons angewendet. Editierbare Felder im Batch-Modus: Host, showBgColor, showBitmap, bitmapSize, showText, textAlign, borderRadius, physicalStyle, fontSize.

**Host-Labels im Edit-Modus:** Label-Icon-Button in der Toolbar (Edit-Modus) blendet semi-transparente Host-Name-Labels (8px, unten) auf allen CompanionButtons ein. Nützlich zur Kontrolle welcher Button zu welchem Host gehört.

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
- Schriftstärke (Normal, Semi-Bold, Bold)
- Textausrichtung (left, center, right)

Label-Elemente reagieren nicht auf Klicks im View-Modus.

### ChannelStrip

Ein Audio-Mixer-Kanal-Element. Stellt Pegelanzeige (Meter L/R), Fader, Mute-Button, Solo/PFL-Button, Pan-Regler und Kanalname dar. Alle Werte werden über Companion-Button-Referenzen gesteuert. Jede Funktion kann einzeln aktiviert oder weggelassen werden.

#### Button 1 (Basisfunktion — reicht für Fader + Mute + Meter + Name)

Für die Grundfunktion des ChannelStrips genügt **ein einziger Companion-Button** (Ref: Fader):

- **Push (KEY-PRESS):** Mute ein/aus — die Hintergrundfarbe des Companion-Buttons gibt den Mute-Status zurück (z.B. rot = gemuted, grau = aktiv)
- **Links/Rechts drehen (SUB-ROTATE):** Lautstärke lauter/leiser — der Fader-Wert im Button-Text aktualisiert sich
- **Button-Text mit Variablen:** Der Text des Companion-Buttons wird geparst und liefert Meteranzeige und Kanalname

Text-Format: Die Werte im Button-Text sind durch ein Trennzeichen (Standard: `|`) getrennt. Die Reihenfolge ist frei konfigurierbar über Index-Einstellungen.

Die Werte stammen nicht aus Companion selbst, sondern aus **Companion-Variablen** — also aus Daten, die ein angebundenes Gerät oder eine Software live an Companion liefert. Typische Quellen sind Hardware-Audiomixer (z.B. Behringer X32, Midas M32, Allen & Heath), Software-Mixer (z.B. vMix Audio, OBS, REAPER) oder andere Broadcast-Geräte mit Companion-Modul.

Der Companion-Button-Text wird als Template konfiguriert (mit `$(modul:variable)`-Syntax). Zur Laufzeit ersetzt Companion die Variablen durch aktuelle Werte — das Ergebnis sendet er als fertigen Text an das Webpanel.

Beispiel Button-Text-Template (so konfiguriert man den Companion-Button):
```
$(x32:ch01_meterL)|$(x32:ch01_meterR)|$(x32:ch01_fader)|$(x32:ch01_name)
```

Beispiel Button-Text zur Laufzeit (so kommt er beim Webpanel an, mit aktuellen Werten):
```
67|71|82|Kanal 1
```

Interpretation bei Konfiguration meterLIndex=0, meterRIndex=1, levelIndex=2, nameIndex=3:
- Index 0 → `67` = Meter L (Pegel links, 0–100)
- Index 1 → `71` = Meter R (Pegel rechts, 0–100)
- Index 2 → `82` = Fader-Position (0–100)
- Index 3 → `Kanal 1` = Kanalname

Nicht benötigte Werte einfach weglassen (Index auf -1 setzen oder Variable im Template nicht mitsenden).

Fader-Bedienung: vertikales Drag mit Maus oder Touch sendet ebenfalls SUB-ROTATE an Companion.
Drum-Wheel: alternatives Scrollrad-Element, ein/ausblendbar mit `showWheel`-Option.

#### Button 2 (optional — für Solo/PFL und Pan)

Für Solo/PFL und Pan wird ein **zweiter Companion-Button** (Ref: Solo/Pan) benötigt:

- **Push (KEY-PRESS):** Solo/PFL ein/aus — Hintergrundfarbe des Buttons zeigt Solo-Status
- **Links/Rechts drehen (SUB-ROTATE):** Pan-Position steuern (links/rechts)

Solo-Button wird im ChannelStrip nur angezeigt, wenn dieser zweite Button konfiguriert ist.
Pan-Regler wird ebenfalls nur angezeigt, wenn dieser zweite Button konfiguriert ist.

Beide Funktionen (Solo und Pan) teilen sich den gleichen Button — Push = Solo, Drehen = Pan.

Konfigurierbare Properties:
- Refs: Companion-Button-Referenz für Fader (Button 1) und Solo/Pan (Button 2)
- Trennzeichen (Separator)
- Index pro Wert (meterLIndex, meterRIndex, levelIndex, nameIndex)
- Wheel anzeigen (showWheel)
- Coarse Multiplier: Multiplikator für SUB-ROTATE-Schrittweite (Fader-Empfindlichkeit)

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

**Elemente zwischen Panels kopieren:** Im Edit-Modus mit ≥1 selektierten Elementen → PropertiesPanel (unten) → "In Panel kopieren" → Dropdown mit allen anderen Panels. Die kopierten Elemente erhalten neue UUIDs und +75px Versatz.

**Panel duplizieren:** Im Panel-Dropdown (Toolbar) → ⧉-Icon neben dem Panel-Namen. Erstellt ein vollständiges Duplikat mit allen Elementen und neuen UUIDs, Name = "…Copy".

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
| Ctrl+Scroll       | Zoom ändern (deaktiviert Auto-Zoom) |

---

## Einstellungen (Settings)

Einstellungen werden in einer JSON-Datei gespeichert. Standardpfad in der Electron-App: `userData/companionwebpanel.json` (neue Installationen) bzw. `userData/settings.json` (Upgrade von älteren Versionen). In der Web-App liegt die Datei neben dem Backend-Prozess.

Konfigurierbare Einstellungen:
- Server-Port (Standard: 8080): auf welchem Port das Backend läuft
- Sprache (language): de (Deutsch) oder en (Englisch) — gilt für alle UI-Strings
- Hosts: Liste aller Companion-Verbindungen (siehe "Verbindung einrichten")
- Panels: alle Canvas-Panels mit ihren Elementen und Canvas-Einstellungen
- settingsPath: optionaler ~-normalisierter Pfad zur Settings-Datei (für Custom Settings Path, wird in die Datei selbst geschrieben für Cross-Device-Sync)

**Custom Settings Path:** Die Einstellungsdatei kann in einem beliebigen Ordner liegen — z.B. OneDrive oder iCloud für automatische Synchronisation zwischen Geräten. Der Pfad wird maschinenlokal in `userData/meta.json` gespeichert (nicht in der Cloud-Datei selbst). Beim Start liest die App zuerst `meta.json`, um den Pfad zur eigentlichen Settings-Datei zu ermitteln.

---

## Electron-App

Die Electron-Version läuft als Desktop-Anwendung:

- Tray-Icon in der Taskleiste: Rechtsklick öffnet das Kontextmenü mit Schnellzugriff
- Startup-Fenster (400×350px): zeigt Verbindungsstatus, Port und Schnellzugriff-Buttons
  - Port-Feld: Port ändern → Apply → App startet mit neuem Port
  - **Abschnitt "Config File":** zeigt die aktive Einstellungsdatei
    - Dateiname-Feld mit `⋯`-Button (Hover: "Load Config File…"): öffnet Datei-Dialog, wählt eine vorhandene `.json`-Datei → App startet automatisch neu mit der neuen Datei
    - **"New Empty Config"-Button** (Dokument+Plus-Icon): öffnet Speichern-Dialog, erstellt eine leere Einstellungsdatei am gewählten Ort → App startet automatisch neu mit der neuen leeren Konfiguration
  - "In App öffnen": öffnet das Panel in einem eingebetteten Fenster (1280×720px)
  - "Im Browser öffnen": öffnet das Panel im Standard-Browser
- Single-Instance: nur eine Instanz gleichzeitig möglich; zweite Instanz bringt das Startup-Fenster in den Vordergrund
- Beim Schließen aller Fenster bleibt die App aktiv (Tray-App)
- Beenden: über Tray-Menü → Bestätigungsdialog

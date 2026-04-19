# HelpModal + help-me-KI-by_alex.md Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the `?` button in the Toolbar to open a 3-tab help modal (KI-Kontext download, Keyboard Shortcuts, Feature Overview) and create a downloadable AI-context markdown file.

**Architecture:** `helpModalOpen` is local `useState` in `App.tsx` (same pattern as `hostManagerOpen`). `HelpModal` renders at App level. Tab state is local `useState` inside `HelpModal`. All strings go through the existing `react-i18next` setup with a new `helpModal` namespace in both locale files. The markdown file lives in `packages/frontend/public/` and is served by Vite at `/help-me-KI-by_alex.md`.

**Tech Stack:** React, react-i18next, TypeScript, Vite (static public folder), vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/shared/locales/de.json` | Add `helpModal.*` DE strings |
| Modify | `packages/shared/locales/en.json` | Add `helpModal.*` EN strings |
| Create | `packages/frontend/public/help-me-KI-by_alex.md` | Downloadable AI context file |
| Create | `packages/frontend/src/components/HelpModal/HelpModal.tsx` | 3-tab modal component |
| Modify | `packages/frontend/src/App.tsx` | Add `helpModalOpen` state + render modal |
| Modify | `packages/frontend/src/components/Toolbar/Toolbar.tsx` | Add `onOpenHelp` prop + wire `?` button |

---

## Task 1: i18n keys — helpModal namespace

**Files:**
- Modify: `packages/shared/locales/de.json`
- Modify: `packages/shared/locales/en.json`

**Context:** Both locale files are flat JSON objects with top-level namespace keys (e.g. `toolbar`, `dialog`). Add a new `helpModal` key after `dialog`. The files live at `packages/shared/locales/`.

- [ ] **Step 1: Add helpModal keys to de.json**

Open `packages/shared/locales/de.json`. At the very end, before the closing `}`, add a comma after the last existing entry and then add:

```json
  "helpModal": {
    "title": "Hilfe",
    "tabKi": "KI-Kontext",
    "tabShortcuts": "Shortcuts",
    "tabFeatures": "Features",
    "kiTitle": "KI-Kontext-Datei herunterladen",
    "kiDescription": "Gib diese Datei einer KI — sie kann dann alle Fragen zu dieser App beantworten.",
    "kiDownloadButton": "help-me-KI-by_alex.md herunterladen",
    "kiFootnote": "Die Datei enthält eine vollständige Beschreibung aller Features und Konfigurationen.",
    "shortcutsHeading": "Keyboard Shortcuts",
    "shortcutColumn": "Shortcut",
    "actionColumn": "Aktion",
    "featuresHeading": "Canvas-Elemente",
    "appDesc": "Companion Webpanel ist ein frei gestaltbares Touch-Panel für Bitfocus Companion — viele Funktionen lassen sich damit übersichtlich, strukturiert und kategorisiert darstellen und steuern.",
    "appMultiHost": "Mehrere Companion-Instanzen (Hosts) können gleichzeitig verbunden werden.",
    "appVersions": "Verfügbar als Web-App (Browser, mehrere Nutzer gleichzeitig via LAN) und als Electron Desktop-App.",
    "shortcut_save": "Speichern",
    "shortcut_undo": "Rückgängig",
    "shortcut_redo": "Wiederholen",
    "shortcut_duplicate": "Duplizieren",
    "shortcut_copyStyle": "Stil kopieren",
    "shortcut_pasteStyle": "Stil einfügen",
    "shortcut_viewMode": "View-Modus",
    "shortcut_editMode": "Edit-Modus",
    "shortcut_toggleGrid": "Grid ein/aus",
    "shortcut_toggleSnap": "Snap ein/aus",
    "shortcut_delete": "Element löschen",
    "shortcut_move1": "Verschieben (1 px)",
    "shortcut_move10": "Verschieben (10 px)",
    "shortcut_deselect": "Auswahl aufheben",
    "btn_companionButton": "CompanionButton",
    "btn_companionButton_desc": "Spiegelt Companion-Buttons in Echtzeit (Bitmap, Farbe, Text)",
    "btn_companionButton_props": "Host · Page · Row · Col · Physical Style · Border-Radius · Text-Align",
    "btn_shape": "Shape",
    "btn_shape_desc": "Rechteck zur visuellen Gruppierung von Elementen",
    "btn_shape_props": "Fill · Stroke · Border-Radius · Textur · Opacity",
    "btn_label": "Label",
    "btn_label_desc": "Statischer Text für Beschriftungen und Überschriften",
    "btn_label_props": "Farbe · Schriftgröße · Familie · Ausrichtung",
    "btn_channelStrip": "ChannelStrip",
    "btn_channelStrip_desc": "Audio-Mixer-Element mit Pegelanzeige, Fader, Mute und Solo",
    "btn_channelStrip_props": "Refs · Text-Parsing · Wheel · Solo · Pan",
    "btn_virtualDeck": "VirtualCompanionDeck",
    "btn_virtualDeck_desc": "Eigenständige Companion-Button-Oberfläche (Virtual Surface)",
    "btn_virtualDeck_props": "Cols · Rows · Fallback-Farbe · Bitmap-Scale · Physical Style"
  }
```

- [ ] **Step 2: Add helpModal keys to en.json**

Open `packages/shared/locales/en.json`. Add the same `helpModal` key with English translations:

```json
  "helpModal": {
    "title": "Help",
    "tabKi": "AI Context",
    "tabShortcuts": "Shortcuts",
    "tabFeatures": "Features",
    "kiTitle": "Download AI Context File",
    "kiDescription": "Give this file to any AI — it can then answer all questions about this app.",
    "kiDownloadButton": "Download help-me-KI-by_alex.md",
    "kiFootnote": "The file contains a complete description of all features and configurations.",
    "shortcutsHeading": "Keyboard Shortcuts",
    "shortcutColumn": "Shortcut",
    "actionColumn": "Action",
    "featuresHeading": "Canvas Elements",
    "appDesc": "Companion Webpanel is a freely customizable touch panel for Bitfocus Companion — many functions can be displayed and controlled in an organized, structured and categorized way.",
    "appMultiHost": "Multiple Companion instances (hosts) can be connected simultaneously.",
    "appVersions": "Available as a web app (browser, multiple users simultaneously via LAN) and as an Electron desktop app.",
    "shortcut_save": "Save",
    "shortcut_undo": "Undo",
    "shortcut_redo": "Redo",
    "shortcut_duplicate": "Duplicate",
    "shortcut_copyStyle": "Copy style",
    "shortcut_pasteStyle": "Paste style",
    "shortcut_viewMode": "View mode",
    "shortcut_editMode": "Edit mode",
    "shortcut_toggleGrid": "Toggle grid",
    "shortcut_toggleSnap": "Toggle snap",
    "shortcut_delete": "Delete element",
    "shortcut_move1": "Move (1 px)",
    "shortcut_move10": "Move (10 px)",
    "shortcut_deselect": "Deselect",
    "btn_companionButton": "CompanionButton",
    "btn_companionButton_desc": "Mirrors Companion buttons in real time (bitmap, color, text)",
    "btn_companionButton_props": "Host · Page · Row · Col · Physical Style · Border Radius · Text Align",
    "btn_shape": "Shape",
    "btn_shape_desc": "Rectangle for visual grouping of elements",
    "btn_shape_props": "Fill · Stroke · Border Radius · Texture · Opacity",
    "btn_label": "Label",
    "btn_label_desc": "Static text for labels and headings",
    "btn_label_props": "Color · Font Size · Family · Alignment",
    "btn_channelStrip": "ChannelStrip",
    "btn_channelStrip_desc": "Audio mixer element with level meter, fader, mute and solo",
    "btn_channelStrip_props": "Refs · Text Parsing · Wheel · Solo · Pan",
    "btn_virtualDeck": "VirtualCompanionDeck",
    "btn_virtualDeck_desc": "Standalone Companion button surface (Virtual Surface)",
    "btn_virtualDeck_props": "Cols · Rows · Fallback Color · Bitmap Scale · Physical Style"
  }
```

- [ ] **Step 3: Verify JSON is valid**

Run:
```bash
node -e "require('./packages/shared/locales/de.json'); require('./packages/shared/locales/en.json'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add packages/shared/locales/de.json packages/shared/locales/en.json
git commit -m "feat(i18n): add helpModal namespace — DE + EN"
```

---

## Task 2: help-me-KI-by_alex.md

**Files:**
- Create: `packages/frontend/public/help-me-KI-by_alex.md`

**Context:** Vite serves everything in `packages/frontend/public/` at the root path. A file placed here is accessible at `/help-me-KI-by_alex.md` in the running app and in the Electron build (via the built frontend). The file is manually maintained — update it when new features are added to the app.

- [ ] **Step 1: Create the file**

Create `packages/frontend/public/help-me-KI-by_alex.md` with the following content:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/public/help-me-KI-by_alex.md
git commit -m "feat: add help-me-KI-by_alex.md AI context file"
```

---

## Task 3: HelpModal component

**Files:**
- Create: `packages/frontend/src/components/HelpModal/HelpModal.tsx`

**Context:** No test file needed — this is pure presentational UI with no logic to unit-test. The existing vitest suite (116 tests) must stay green after this task. Follow the same dark-theme style as `HostManagerModal.tsx` (background `#252830`, border `#3a3d46`, overlay `rgba(0,0,0,0.65)`, zIndex 1200). Use `useTranslation` from `react-i18next` for all strings. The component mounts its own ESC key listener using `useEffect` with `{ capture: true }` so it fires before App.tsx's ESC handler.

- [ ] **Step 1: Create HelpModal.tsx**

Create `packages/frontend/src/components/HelpModal/HelpModal.tsx` with the following complete implementation:

```tsx
/**
 * HelpModal.tsx
 *
 * 3-Tab Hilfe-Modal, geöffnet über den ?-Button in der Toolbar.
 * Tabs: KI-Kontext (Download), Shortcuts, Features.
 * ESC und Backdrop-Klick schließen das Modal.
 */
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

type Tab = 'ki' | 'shortcuts' | 'features'

interface HelpModalProps {
  onClose: () => void
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.65)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1200,
}

const MODAL: React.CSSProperties = {
  background: '#252830',
  border: '1px solid #3a3d46',
  borderRadius: 10,
  width: 560,
  maxWidth: '92vw',
  maxHeight: '82vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const HEADER: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 18px',
  borderBottom: '1px solid #3a3d46',
  flexShrink: 0,
}

const TAB_BAR: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #3a3d46',
  flexShrink: 0,
}

const CONTENT: React.CSSProperties = {
  overflowY: 'auto',
  padding: '18px',
  flex: 1,
}

const KBD: React.CSSProperties = {
  background: '#3a3d46',
  border: '1px solid #4a4d56',
  borderRadius: 3,
  padding: '1px 6px',
  fontSize: 11,
  fontFamily: 'monospace',
  color: '#ccc',
}

const CARD: (color: string) => React.CSSProperties = (color) => ({
  background: '#2d3038',
  borderRadius: 6,
  padding: '10px 12px',
  borderLeft: `3px solid ${color}`,
  marginBottom: 8,
})

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 16px',
    fontSize: 12,
    cursor: 'pointer',
    color: active ? '#7db9e8' : '#888',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #7db9e8' : '2px solid transparent',
    fontWeight: active ? 500 : 400,
    lineHeight: 1,
  }
}

const FEATURES = [
  { key: 'btn_companionButton', color: '#7db9e8' },
  { key: 'btn_shape',           color: '#8ec98a' },
  { key: 'btn_label',           color: '#c98a8a' },
  { key: 'btn_channelStrip',    color: '#8a8ac9' },
  { key: 'btn_virtualDeck',     color: '#c98ac9' },
]

const SHORTCUTS: Array<{ keys: string; actionKey: string }> = [
  { keys: 'Ctrl+S',         actionKey: 'shortcut_save'       },
  { keys: 'Ctrl+Z',         actionKey: 'shortcut_undo'       },
  { keys: 'Ctrl+Y',         actionKey: 'shortcut_redo'       },
  { keys: 'Ctrl+D',         actionKey: 'shortcut_duplicate'  },
  { keys: 'Ctrl+Shift+C',   actionKey: 'shortcut_copyStyle'  },
  { keys: 'Ctrl+Shift+V',   actionKey: 'shortcut_pasteStyle' },
  { keys: 'V',              actionKey: 'shortcut_viewMode'   },
  { keys: 'E',              actionKey: 'shortcut_editMode'   },
  { keys: 'G',              actionKey: 'shortcut_toggleGrid' },
  { keys: 'S',              actionKey: 'shortcut_toggleSnap' },
  { keys: 'Del',            actionKey: 'shortcut_delete'     },
  { keys: '↑ ↓ ← →',       actionKey: 'shortcut_move1'      },
  { keys: 'Shift+↑↓←→',    actionKey: 'shortcut_move10'     },
  { keys: 'Esc',            actionKey: 'shortcut_deselect'   },
]

export function HelpModal({ onClose }: HelpModalProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('ki')

  // ESC closes modal — capture phase takes priority over App.tsx ESC handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [onClose])

  return (
    <div style={OVERLAY} onMouseDown={onClose}>
      <div style={MODAL} onMouseDown={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={HEADER}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>
            {t('helpModal.title')}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Tab bar */}
        <div style={TAB_BAR}>
          {(['ki', 'shortcuts', 'features'] as Tab[]).map((tab) => (
            <button
              key={tab}
              style={tabStyle(activeTab === tab)}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'ki'        && `📥 ${t('helpModal.tabKi')}`}
              {tab === 'shortcuts' && `⌨ ${t('helpModal.tabShortcuts')}`}
              {tab === 'features'  && `⚙ ${t('helpModal.tabFeatures')}`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={CONTENT}>

          {/* ── Tab 1: KI-Kontext ── */}
          {activeTab === 'ki' && (
            <div>
              <div style={{
                background: '#1a3d2a', border: '1px solid #2a6a44',
                borderRadius: 8, padding: '16px 18px', textAlign: 'center', marginBottom: 14,
              }}>
                <div style={{ color: '#6ee7a0', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                  {t('helpModal.kiTitle')}
                </div>
                <div style={{ color: '#a0d4b0', fontSize: 12, marginBottom: 14 }}>
                  {t('helpModal.kiDescription')}
                </div>
                <a
                  href="/help-me-KI-by_alex.md"
                  download
                  style={{
                    background: '#2a6a44', borderRadius: 5, padding: '8px 16px',
                    color: '#6ee7a0', fontSize: 12, fontWeight: 500,
                    textDecoration: 'none', display: 'inline-block',
                  }}
                >
                  ⬇ {t('helpModal.kiDownloadButton')}
                </a>
              </div>
              <p style={{ color: '#666', fontSize: 11, textAlign: 'center', margin: 0 }}>
                {t('helpModal.kiFootnote')}
              </p>
            </div>
          )}

          {/* ── Tab 2: Shortcuts ── */}
          {activeTab === 'shortcuts' && (
            <div>
              <div style={{ color: '#aaa', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 12 }}>
                {t('helpModal.shortcutsHeading')}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: '#666', borderBottom: '1px solid #3a3d46' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0 8px', fontWeight: 500, width: 160 }}>
                      {t('helpModal.shortcutColumn')}
                    </th>
                    <th style={{ textAlign: 'left', padding: '4px 0 8px', fontWeight: 500 }}>
                      {t('helpModal.actionColumn')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SHORTCUTS.map(({ keys, actionKey }) => (
                    <tr key={actionKey} style={{ borderBottom: '1px solid #2a2d36' }}>
                      <td style={{ padding: '6px 0' }}>
                        <kbd style={KBD}>{keys}</kbd>
                      </td>
                      <td style={{ padding: '6px 0', color: '#ccc' }}>
                        {t(`helpModal.${actionKey}`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Tab 3: Features ── */}
          {activeTab === 'features' && (
            <div>
              {/* App description block */}
              <div style={{
                background: '#2d3038', borderRadius: 6, padding: '12px 14px', marginBottom: 16,
                border: '1px solid #3a3d46',
              }}>
                <p style={{ color: '#ccc', fontSize: 12, margin: '0 0 8px 0', lineHeight: 1.5 }}>
                  {t('helpModal.appDesc')}
                </p>
                <p style={{ color: '#888', fontSize: 11, margin: '0 0 4px 0' }}>
                  • {t('helpModal.appMultiHost')}
                </p>
                <p style={{ color: '#888', fontSize: 11, margin: 0 }}>
                  • {t('helpModal.appVersions')}
                </p>
              </div>

              <div style={{ color: '#aaa', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 10 }}>
                {t('helpModal.featuresHeading')}
              </div>

              {FEATURES.map(({ key, color }) => (
                <div key={key} style={CARD(color)}>
                  <div style={{ color, fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                    {t(`helpModal.${key}`)}
                  </div>
                  <div style={{ color: '#aaa', fontSize: 11, marginBottom: 4 }}>
                    {t(`helpModal.${key}_desc`)}
                  </div>
                  <div style={{ color: '#666', fontSize: 10 }}>
                    {t(`helpModal.${key}_props`)}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```
Expected: no errors.

- [ ] **Step 3: Run existing tests**

```bash
npm test -w @cwp/frontend
```
Expected: all existing tests pass (116 tests).

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/HelpModal/HelpModal.tsx
git commit -m "feat: add HelpModal component — 3 tabs (KI, Shortcuts, Features)"
```

---

## Task 4: Wire HelpModal into App.tsx and Toolbar.tsx

**Files:**
- Modify: `packages/frontend/src/App.tsx`
- Modify: `packages/frontend/src/components/Toolbar/Toolbar.tsx`

**Context:** `App.tsx` already has the pattern for `hostManagerOpen` — duplicate it for `helpModalOpen`. `Toolbar.tsx` has a `ToolbarProps` interface at line 8 and the `?` button at lines 468–474 with no `onClick`. Add an `onOpenHelp` prop (optional, same style as `onOpenHostManager?: () => void`).

- [ ] **Step 1: Update Toolbar.tsx — add onOpenHelp prop and wire button**

In `packages/frontend/src/components/Toolbar/Toolbar.tsx`:

Change the `ToolbarProps` interface (lines 8–13):
```tsx
interface ToolbarProps {
  mode: 'view' | 'edit'
  onToggleMode: () => void
  onOpenHostManager?: () => void
  onOpenHelp?: () => void
  onSave?: () => void
}
```

Change the function signature to destructure `onOpenHelp`:
```tsx
export function Toolbar({ mode, onToggleMode, onOpenHostManager, onOpenHelp, onSave }: ToolbarProps) {
```

Change the `?` button (lines 468–474) to wire `onClick`:
```tsx
<button
  style={{ ...modeButtonStyle(false), width: 32, padding: 0, textAlign: 'center' }}
  title={t('toolbar.keyboardShortcuts')}
  onClick={onOpenHelp}
>
  ?
</button>
```

- [ ] **Step 2: Update App.tsx — add helpModalOpen state and render HelpModal**

In `packages/frontend/src/App.tsx`:

Add the import at the top (after the existing imports):
```tsx
import { HelpModal } from './components/HelpModal/HelpModal'
```

Add `helpModalOpen` state after `hostManagerOpen`:
```tsx
const [hostManagerOpen, setHostManagerOpen] = useState(false)
const [helpModalOpen, setHelpModalOpen] = useState(false)
```

Update the `<Toolbar>` JSX to pass `onOpenHelp`:
```tsx
<Toolbar
  mode={mode}
  onToggleMode={toggleMode}
  onOpenHostManager={() => setHostManagerOpen(true)}
  onOpenHelp={() => setHelpModalOpen(true)}
  onSave={handleSave}
/>
```

Add the `<HelpModal>` render after the `<HostManagerModal>` block (still inside the return):
```tsx
{helpModalOpen && (
  <HelpModal onClose={() => setHelpModalOpen(false)} />
)}
```

The complete updated `return` block looks like:
```tsx
return (
  <div style={styles.app}>
    <Toolbar
      mode={mode}
      onToggleMode={toggleMode}
      onOpenHostManager={() => setHostManagerOpen(true)}
      onOpenHelp={() => setHelpModalOpen(true)}
      onSave={handleSave}
    />
    <div style={styles.body}>
      <Canvas sendPress={sendPress} sendRotate={sendRotate} sendVPress={sendVPress} />
    </div>
    {hostManagerOpen && (
      <HostManagerModal
        onClose={() => setHostManagerOpen(false)}
        saveSettings={saveSettings}
      />
    )}
    {helpModalOpen && (
      <HelpModal onClose={() => setHelpModalOpen(false)} />
    )}
  </div>
)
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```
Expected: no errors.

- [ ] **Step 4: Run existing tests**

```bash
npm test -w @cwp/frontend
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/App.tsx packages/frontend/src/components/Toolbar/Toolbar.tsx
git commit -m "feat: wire HelpModal — ? button opens 3-tab help modal"
```

---

## Task 5: Manual smoke test + final checks

**Files:** none (verification only)

**Context:** This task verifies the feature works end-to-end. Run the dev server and test every interaction path from the spec.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```
Open `http://localhost:5173` in a browser.

- [ ] **Step 2: Smoke test — open and close modal**

- Click the `?` button in the Toolbar → modal opens on the KI-Kontext tab
- Click the backdrop (outside the modal box) → modal closes
- Click `?` again → modal opens
- Press `Esc` → modal closes

- [ ] **Step 3: Smoke test — all 3 tabs**

- Click `?` → click "⌨ Shortcuts" tab → shortcut table visible with all 14 rows
- Click "⚙ Features" tab → app description block visible at top, 5 element cards below
- Click "📥 KI-Kontext" tab → green download banner visible

- [ ] **Step 4: Smoke test — download**

- On the KI-Kontext tab, click the download button → browser downloads `help-me-KI-by_alex.md`
- Open the downloaded file — verify it contains the full app description (check that "Projektübersicht" section is present)

- [ ] **Step 5: Smoke test — i18n**

- Switch language to EN via the LanguageSwitcher in the Toolbar
- Open the modal → all tab labels, shortcut descriptions, feature names should be in English
- Switch back to DE → verify German strings are shown

- [ ] **Step 6: Run full test suite**

```bash
npm test
```
Expected: all 116 existing tests pass, 0 failures.

- [ ] **Step 7: TypeScript check all packages**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json && npx tsc --noEmit -p packages/backend/tsconfig.json && npx tsc --noEmit -p packages/shared/tsconfig.json && npx tsc --noEmit -p packages/electron/tsconfig.json && echo "ALL CLEAN"
```
Expected: `ALL CLEAN`

- [ ] **Step 8: Commit smoke test sign-off**

```bash
git commit --allow-empty -m "chore: HelpModal smoke test passed — all checks green"
```

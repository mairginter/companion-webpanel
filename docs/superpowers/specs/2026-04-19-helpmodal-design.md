# HelpModal + help-me-KI-by_alex.md — Design Spec

**Date:** 2026-04-19  
**Status:** Approved

---

## Goal

The `?` button in the Toolbar opens a tabbed help modal. The modal has three tabs: KI-Kontext (AI context file download), Keyboard Shortcuts, and Feature Overview. Additionally, a markdown file `help-me-KI-by_alex.md` is created in `packages/frontend/public/` — it is a complete, AI-optimized description of the app that users can give to any AI assistant to enable it to answer questions about the app.

---

## Architecture

`helpModalOpen` is a local `useState` in `App.tsx` — the same pattern used for `hostManagerOpen`. The `HelpModal` component is rendered at the App level to avoid z-index issues. The Toolbar receives an `onOpenHelp` prop.

Tab selection is local `useState` inside `HelpModal` — it is transient UI state, not shared, so it does not belong in the global store.

`help-me-KI-by_alex.md` lives in `packages/frontend/public/` and is served by Vite at `/help-me-KI-by_alex.md`. It is linked via a plain `<a href="/help-me-KI-by_alex.md" download>` element inside the KI-Kontext tab.

All UI strings go through the existing i18n system (`useTranslation` / `t()`). New keys are added under a `helpModal` namespace in both `de.json` and `en.json`.

---

## Files

### New files
- `packages/frontend/src/components/HelpModal/HelpModal.tsx` — the modal component
- `packages/frontend/public/help-me-KI-by_alex.md` — downloadable AI context file

### Modified files
- `packages/frontend/src/App.tsx` — add `helpModalOpen` state, render `<HelpModal />`, wire `onOpenHelp` to Toolbar
- `packages/frontend/src/components/Toolbar/Toolbar.tsx` — add `onOpenHelp` prop, wire `?` button `onClick`
- `packages/shared/locales/de.json` — add `helpModal.*` keys
- `packages/shared/locales/en.json` — add `helpModal.*` keys

---

## HelpModal Component

### Props
```typescript
interface HelpModalProps {
  onClose: () => void
}
```

### Tab structure
```typescript
type Tab = 'ki' | 'shortcuts' | 'features'
const [activeTab, setActiveTab] = useState<Tab>('ki')
```

### Backdrop and ESC
- Clicking the semi-transparent backdrop calls `onClose`
- `HelpModal` mounts its own `useEffect` ESC listener (`keydown` → `key === 'Escape'` → `onClose`). This runs at capture phase so it takes priority over App.tsx's ESC handler (deselect).

### Layout
Modal is centered (`position: fixed`, flex centering). Width: `560px`, `max-height: 80vh`, scrollable content area per tab. Dark theme consistent with existing modals (`background: #252830`, `border: 1px solid #3a3d46`).

### Tab 1 — KI-Kontext
- Green banner (`background: #1a3d2a`, border `#2a6a44`): title + one-line description + download button
- Download button: `<a href="/help-me-KI-by_alex.md" download>` styled as a green button
- Below banner: secondary explanation text

### Tab 2 — Shortcuts
Two-column table (`Shortcut | Aktion`). `<kbd>` elements for key display. All shortcut descriptions from i18n keys. Complete list:

| Key | Action |
|-----|--------|
| `Ctrl+S` | Speichern / Save |
| `Ctrl+Z` | Rückgängig / Undo |
| `Ctrl+Y` | Wiederholen / Redo |
| `Ctrl+D` | Duplizieren / Duplicate |
| `Ctrl+Shift+C` | Stil kopieren / Copy style |
| `Ctrl+Shift+V` | Stil einfügen / Paste style |
| `V` | View-Modus / View mode |
| `E` | Edit-Modus / Edit mode |
| `G` | Grid ein/aus / Toggle grid |
| `S` | Snap ein/aus / Toggle snap |
| `Del` | Element löschen / Delete element |
| `↑↓←→` | Verschieben 1px / Move 1px |
| `Shift+↑↓←→` | Verschieben 10px / Move 10px |
| `Esc` | Auswahl aufheben / Deselect |

### Tab 3 — Features
Scrollable list of cards. Each card: colored left border, element type name + icon, one-line description, key properties in small grey text.

| Element | Color | Description |
|---------|-------|-------------|
| CompanionButton | `#7db9e8` | Spiegelt Companion-Buttons in Echtzeit |
| Shape | `#8ec98a` | Rechteck zur visuellen Gruppierung |
| Label | `#c98a8a` | Statischer Text |
| ChannelStrip | `#8a8ac9` | Audio-Mixer-Element mit Meter, Fader, Mute, Solo |
| VirtualCompanionDeck | `#c98ac9` | Eigenständige Button-Oberfläche |

Properties summary per card (small grey text, comma-separated):
- CompanionButton: Host, Page, Row, Col, Physical Style, Border-Radius, Text-Align, Bitmap-Scale
- Shape: Fill, Stroke, Border-Radius, Textur, Opacity
- Label: Farbe, Schriftgröße, Familie, Ausrichtung
- ChannelStrip: Refs (Meter L/R, Fader, Mute, Solo, Pan, Name), Text-Parsing, Wheel-Sichtbarkeit
- VirtualCompanionDeck: Cols, Rows, Fallback-Farbe, Bitmap-Scale, Text-Align, Physical Style

---

## i18n Keys (helpModal namespace)

```json
{
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
}
```

English equivalents translate all German strings to English (same keys, EN values).

---

## help-me-KI-by_alex.md — Content Structure

The file is a complete, AI-readable description of the app. It uses `##` headings and plain prose — no code blocks. It is manually maintained; when new features are added to the app, this file must be updated.

### Sections

1. **Projektübersicht** — what the app does, primary use case (live production), how it connects to Companion (Satellite API, WebSocket), PWA/LAN access
2. **Verbindung einrichten (Hosts)** — adding/editing hosts, IP + port + name, autoConnect, showInToolbar, Companion version requirement (4.3+)
3. **Panel-Canvas** — panels, canvas size, zoom, grid, snap, view/edit mode
4. **Canvas-Elemente** — one sub-section per element type:
   - CompanionButton: what it does, all configurable properties with description
   - Shape: what it does, all properties
   - Label: what it does, all properties
   - ChannelStrip: what it does, text-parsing format, all properties
   - VirtualCompanionDeck: what it does, virtual surface concept, all properties
5. **Edit-Modus-Funktionen** — drag, resize, multi-select (lasso + Shift-click), duplicate, delete, copy/paste style, undo/redo, lock element
6. **Keyboard Shortcuts** — complete table as plain text
7. **Einstellungen (Settings)** — server port, language, host configuration
8. **Electron-App** — tray icon, startup window, "Open in App" vs browser

---

## Testing

- **Smoke test**: `?` button opens modal; all 3 tabs switch correctly; ESC closes modal; backdrop click closes modal
- **Download**: clicking the download button in KI-Kontext tab downloads the `.md` file
- **i18n**: switching language (DE↔EN) via LanguageSwitcher updates all modal strings
- **Unit tests**: no logic to unit-test (pure UI) — existing vitest suite must stay green (116 tests)
- **TS check**: `npx tsc --noEmit -p packages/frontend/tsconfig.json` must pass

---

## Out of Scope

- HelpModal is not searchable (no search bar)
- No deep-links into specific tab (URL hash)
- `help-me-KI-by_alex.md` is not auto-generated from code
- No version number in the modal

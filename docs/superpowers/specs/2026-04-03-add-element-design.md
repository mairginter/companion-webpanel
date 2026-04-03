# Add Element Feature — Design Spec
**Datum:** 2026-04-03  
**Status:** Approved

---

## Ziel

Im Edit-Mode können Elemente (CompanionButton, Label, Shape) direkt auf dem Canvas hinzugefügt werden — über einen Toolbar-Button oder per Rechtsklick-Kontextmenü.

---

## Trigger

| Trigger | Verfügbarkeit | Verhalten |
|---|---|---|
| `+`-Button in Toolbar | Nur Edit-Mode | Öffnet `AddElementMenu` unterhalb des Buttons, `canvasPos` = Canvas-Mitte |
| Rechtsklick auf Canvas | Nur Edit-Mode | Öffnet `AddElementMenu` an Mausposition, `canvasPos` = Mausposition relativ zum Canvas |

---

## Komponenten

### 1. `AddElementMenu`

Kleines Popup mit 3 Einträgen.

**Props:**
```typescript
interface AddElementMenuProps {
  screenPos: { x: number; y: number }   // Position des Popups auf dem Bildschirm
  canvasPos: { x: number; y: number }   // Zielposition auf dem Canvas (für Platzierung)
  panelId: string
  onClose: () => void
}
```

**Verhalten:**
- Zeigt 3 Einträge: `CompanionButton`, `Label`, `Shape`
- Klick außerhalb → schließt ohne Aktion
- `Label` / `Shape` → ruft sofort `addElement()` mit Defaults auf, schließt danach
- `CompanionButton` → öffnet `CompanionButtonPickerDialog` (Menu bleibt sichtbar bis Dialog bestätigt/abgebrochen)

**File:** `packages/frontend/src/components/AddElement/AddElementMenu.tsx`

---

### 2. `CompanionButtonPickerDialog`

Modal-Dialog zur Auswahl eines Companion-Buttons.

**Layout:**
```
┌─ Companion Button wählen ──────────────────────┐
│  Host: [Dropdown ▼]    Page: [Dropdown ▼ + +]  │
│  ┌────────────────────────────────────────────┐ │
│  │  Mini-Grid (bgColor + Text aus Store)      │ │
│  │  ■ = ausgewählte Zelle (highlighted)       │ │
│  └────────────────────────────────────────────┘ │
│  Zeile: 1  Spalte: 1   [Abbrechen] [Hinzufügen] │
└─────────────────────────────────────────────────┘
```

**Host-Dropdown:**
- Zeigt nur Hosts mit mindestens einem `connected`-Status in `sessionStatus`
- Kein verbundener Host → Hinweis: „Kein Host verbunden"

**Page-Dropdown:**
- Zeigt existierende Pages für den gewählten Host (aus `wizard.pageAssignments`)
- Letzter Eintrag: `+ Neue Page…`
  - Klick → inline Number-Input erscheint im Dropdown
  - Bestätigen → legt `pageAssignment` mit Default `{ keysPerRow: 8, rows: 8, instructionShown: false }` an (nur im Store, wird beim nächsten Ctrl+S gespeichert)
  - Neue Page → Grid zeigt leere Zellen, trotzdem klickbar

**Mini-Grid:**
- Größe basiert auf `surfaceConfig.keysPerRow` × `surfaceConfig.rows`
- Jede Zelle: `bgColor` aus Store (Fallback `#1a2030`), `text` als Label
- Klick auf Zelle → row/col berechnen aus keyIndex, Zelle highlighted
- Zellgröße: max 48px, skaliert damit Grid in Dialog-Breite (~400px) passt

**Buttons:**
- `Abbrechen` → schließt Dialog ohne Aktion
- `Hinzufügen` (disabled wenn keine Zelle gewählt) → ruft `addElement()`, schließt alles

**File:** `packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx`

---

## Store-Erweiterung

```typescript
// useAppStore.ts — neue Action
addElement: (panelId: string, element: AnyElement) => void
```

**Implementierung:**
- Hängt Element ans Ende von `panel.elements`
- `z` = `max(panel.elements.map(e => e.z)) + 1` (oder `1` wenn keine Elemente)
- Setzt `selectedIds` auf `new Set([element.id])`

**Zusätzlich für neue Pages:**
```typescript
addPageAssignment: (hostId: string, page: number, surfaceConfig: SurfaceConfig) => void
```
- Legt `wizard.pageAssignments[hostId:page]` mit Defaults an, falls nicht vorhanden

---

## Element-Defaults bei Platzierung

Alle Elemente werden **zentriert auf `canvasPos`** platziert (x = canvasPos.x - w/2, y = canvasPos.y - h/2).

| Typ | Größe | Standardwerte |
|---|---|---|
| `companionButton` | 120×120 | `textAlign: 'center'`, `showText: true`, `showBgColor: true` |
| `shape` | 160×100 | `fill: '#1a2030'`, `stroke: '#2a3344'`, `strokeWidth: 1`, `borderRadius: 6` |
| `label` | 200×40 | `text: 'Label'`, `color: '#ffffff'`, `fontSize: 18` |

---

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `packages/frontend/src/store/useAppStore.ts` | `addElement()` + `addPageAssignment()` |
| `packages/frontend/src/components/Toolbar/Toolbar.tsx` | `+`-Button (nur Edit-Mode), öffnet `AddElementMenu` |
| `packages/frontend/src/components/Canvas/Canvas.tsx` | `onContextMenu` Handler (nur Edit-Mode) |

### Neue Dateien
| Datei | Inhalt |
|---|---|
| `packages/frontend/src/components/AddElement/AddElementMenu.tsx` | Popup mit 3 Einträgen |
| `packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx` | Mini-Grid-Picker |

---

## Nicht im Scope (MVP)

- Kein Drag-to-place (Element wird direkt an canvasPos gesetzt)
- Kein `MeterElement` hinzufügen (komplexere Source-Konfiguration)
- Kein Undo für `addElement` (Delete reicht als Korrektur)
- Keine Bitmap-Vorschau im Mini-Grid (nur bgColor + Text)

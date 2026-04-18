# Companion Button Picker — Multi-Select & Seite einfügen

**Datum:** 2026-04-18  
**Status:** Approved  
**Betroffene Dateien:** `CompanionButtonPickerDialog.tsx`, `AddElementMenu.tsx`, `CompanionButtonProps.tsx`

---

## Ziel

Der Companion Button Picker erhält zwei neue Funktionen:
1. **Multi-Select:** Mehrere Buttons per Ctrl+Click / Shift+Click auswählen und gemeinsam auf dem Canvas platzieren.
2. **Seite einfügen:** Alle konfigurierten Buttons der aktuellen Companion-Page auf einmal einfügen.

---

## Feature 1 — Multi-Select

### Selektions-State

**Vorher:**
```ts
selectedRow: number | null
selectedCol: number | null
```

**Nachher:**
```ts
selectedCells: Set<string>       // Key-Format: "row:col"
lastClickedCell: { row: number; col: number } | null
```

### Klick-Verhalten

| Aktion | Ergebnis |
|---|---|
| Plain Click | `selectedCells` leeren → nur geklickte Zelle eintragen. `lastClickedCell` aktualisieren. |
| Ctrl+Click | Geklickte Zelle togglen (rein wenn nicht drin, raus wenn drin). `lastClickedCell` aktualisieren. |
| Shift+Click | Rechteck von `lastClickedCell` bis geklickte Zelle berechnen, alle Zellen im Rechteck zu `selectedCells` hinzufügen. `lastClickedCell` **nicht** aktualisieren. |
| Host / Page / Grid-Größe ändert sich | `selectedCells = new Set()`, `lastClickedCell = null` |

**Shift+Click ohne vorherigen Click:** `lastClickedCell` ist null → Verhalten wie Plain Click.

### Rechteck-Berechnung (Shift+Click)

```ts
const minRow = Math.min(lastClickedCell.row, clickedRow)
const maxRow = Math.max(lastClickedCell.row, clickedRow)
const minCol = Math.min(lastClickedCell.col, clickedCol)
const maxCol = Math.max(lastClickedCell.col, clickedCol)

for (let r = minRow; r <= maxRow; r++) {
  for (let c = minCol; c <= maxCol; c++) {
    selectedCells.add(`${r}:${c}`)
  }
}
```

### Visuelles Feedback

- Ausgewählte Zellen erhalten denselben blauen Rahmen wie bisher der einzelne Button — gilt nun für alle Zellen in `selectedCells`.
- Statuszeile unten zeigt: `"3 Buttons ausgewählt"` (statt `"Zeile X, Spalte Y"`).
- Bei Single-Select (1 Zelle): `"Zeile X, Spalte Y"` (wie bisher).

### "Hinzufügen"-Button

Disabled wenn `selectedCells.size === 0`.

---

## Feature 2 — Seite einfügen

### Neuer Button im Dialog

**Label:** "Seite einfügen"  
**Position:** Neben dem bestehenden "Hinzufügen"-Button (unten im Dialog).

### Konfiguriert-Definition

Ein Button gilt als konfiguriert wenn:
```ts
(bgColor !== undefined && bgColor !== '#000000') || (text !== undefined && text !== '')
```

### Verhalten beim Klick

1. Alle `gridCells` der aktuellen Page nach obiger Bedingung filtern.
2. Sortieren: aufsteigend nach `row`, dann `col`.
3. `CompanionRef[]` daraus bauen.
4. `onConfirm(refs)` aufrufen → Dialog schließt, Buttons landen auf dem Canvas.

### Disabled-Zustände

- Kein Host verbunden → disabled.
- Keine konfigurierten Buttons auf der Page → disabled.

---

## Compact Layout Algorithmus

Gilt für alle Fälle wo `refs.length > 1` (Multi-Select oder Seite einfügen).

**Schritte:**
1. `refs` sortieren: aufsteigend nach `row`, dann `col`.
2. Nach Companion-`row` gruppieren → ergibt geordnete Liste von Canvas-Zeilen.
3. Innerhalb jeder Gruppe: Buttons lückenlos nebeneinander (Canvas-Spalte = Index in der Gruppe, nicht die Companion-Spalte).
4. Canvas-Startposition = `canvasPos` (aktuelle Drop-Position).
5. Für jeden Button: `x = canvasPos.x + colIndex * 120`, `y = canvasPos.y + rowIndex * 120`.

**Beispiel:**

| Companion | Canvas |
|---|---|
| (row 2, col 1) | x=0, y=0 |
| (row 2, col 4) | x=120, y=0 (kein Gap) |
| (row 3, col 2) | x=0, y=120 (neue Zeile) |

`buttonSize` = 120px (Default für `companionButton`).

---

## Interface-Änderung: `onConfirm`

**Vorher:** `onConfirm: (ref: CompanionRef) => void`  
**Nachher:** `onConfirm: (refs: CompanionRef[]) => void`

**Betroffene Aufrufer:**

| Datei | Änderung |
|---|---|
| `AddElementMenu.tsx` | `handlePickerConfirm(refs)` → Compact Layout berechnen → `addElement` für jeden Ref |
| `CompanionButtonProps.tsx` | `refs[0]` nehmen (Ref-Änderung betrifft immer nur ein bestehendes Element) |

---

## Nicht im Scope

- "Seite einfügen" aus CompanionButtonProps (Ref-Änderung bleibt Single-Select).
- Konfigurierbarer Button-Abstand (immer 0px, direkt aneinander).
- Undo/Redo für den Multi-Add (bestehend: kein Undo im Projekt).

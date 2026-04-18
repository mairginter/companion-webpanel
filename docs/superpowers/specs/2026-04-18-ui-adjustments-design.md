# UI Adjustments — Design Spec

**Datum:** 2026-04-18  
**Status:** Approved

---

## Überblick

6 UI-Anpassungen am CompanionWebpanel: ChannelStrip-Name-Override, Page-Namen-Konfiguration, Page-Listbox im Picker, Picker-Memory, Element-Style-Copy/Paste, Default-Größe CompanionButton.

---

## 1. ChannelStrip — Name als Override

**Problem:** `style.name` dient aktuell als Fallback wenn kein Name aus dem Companion-TEXT-Feld geparst wird. User will es als Override nutzen.

**Änderung:**
- `ChannelStripElement.tsx` Zeile 93: `parsed.name ?? style.name ?? ''` → `style.name || parsed.name || ''`
- `ChannelStripProps.tsx`: Label "Name (Fallback)" → "Name (Override)"

**Dateien:** `packages/frontend/src/components/Elements/ChannelStripElement.tsx`, `packages/frontend/src/components/PropertiesPanel/ChannelStripProps.tsx`

---

## 2. Page Names — lokal konfigurierbar

**Problem:** Companion Satellite API (v1.10) bietet keine Page-Namen. Lösung: lokale Konfiguration im Host-Settings-Dialog.

**Datenmodell:**
- `HostProfile` in `packages/shared/src/types.ts` bekommt `pageNames?: Record<number, string>`
  - Key = Page-Nummer (1-basiert), Value = Name
  - Nur belegte Pages werden gespeichert (leere Felder → kein Eintrag)

**HostManagerModal:**
- Aufklappbarer Bereich "Page-Namen" (collapsed by default)
- Zeigt Felder für Page 1 bis `host.maxPages` (oder default 99)
- Jedes Feld: `<input placeholder="(leer)">` neben "Page N"
- Beim Speichern: nur nicht-leere Werte in `pageNames` schreiben

**Picker-Listbox:**
- Option-Text: `pageNames[n] ? \`${n} — ${pageNames[n]}\` : \`${n}\``

**Dateien:** `packages/shared/src/types.ts`, `packages/frontend/src/components/HostManager/HostManagerModal.tsx`, `packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx`

---

## 3. Page Listbox im Picker (+ maxPages Host-Setting)

**Problem:** NumericInput für Page im Picker erlaubt keine schnelle Übersicht aller Pages.

**Neues Host-Setting `maxPages`:**
- `HostProfile` bekommt `maxPages?: number` (Default 99)
- `HostManagerModal`: NumericInput "Max. Pages" (min 1, default 99)
- Settings-Version-Bump: **1.3.0 → 1.4.0** (6 Stellen: schema.json, types.ts, standalone.ts, ClientServer.ts, CompanionWebpannelSettings.json, settingsHelper.ts)

**Picker-Listbox:**
- `NumericInput label="Page"` ersetzen durch `<select>` mit `style={SELECT_STYLE}`
- Optionen: 1 bis `host.maxPages ?? 99`
- Zeigt Page-Namen wenn konfiguriert (siehe Punkt 2)
- `onChange`: `setPageNum(parseInt(e.target.value)); setSelectedCells(new Set()); lastClickedCell.current = null`

**Dateien:** `packages/shared/src/types.ts`, `packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx`, `packages/frontend/src/components/HostManager/HostManagerModal.tsx`, + 4 Stellen für Version-Bump

---

## 4. Picker merkt sich letzte Page

**Problem:** Bei jedem Öffnen des Pickers startet man auf Page 1 (oder `initialRef.page`).

**Implementierung:**
- localStorage-Key: `cwp:picker:lastPage:<hostId>`
- Beim Page-Wechsel im Picker: `localStorage.setItem(\`cwp:picker:lastPage:${hostId}\`, String(pageNum))`
- Beim Initialisieren: `initialRef?.page ?? (parseInt(localStorage.getItem(\`cwp:picker:lastPage:${hostId}\`) ?? '') || 1)`
- Bei Host-Wechsel (`handleHostChange`): gespeicherte Page des neuen Hosts laden

**Datei:** `packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx`

---

## 5. Element-Style Copy/Paste

**Problem:** Keine Möglichkeit, Style-Einstellungen von einem Element auf andere zu übertragen.

**Store-State:**
- `useAppStore` bekommt `copiedStyle: { type: AnyElement['type']; style: unknown; w: number; h: number } | null`
- `copyElementStyle(elementId: string, panelId: string): void` — kopiert style/render des Elements
- `pasteElementStyle(panelId: string, targetIds: string[]): void` — wendet kopiertes Style auf Ziel-Elemente gleichen Typs an

**Was wird kopiert (je Typ):**
- `companionButton` → `render` (alles außer ref)
- `shape` → `style`
- `label` → `style`
- `channelStrip` → `style` (alles außer refs)
- `virtualCompanionDeck` → `render` (alles außer ref/deviceId)

**Was kopiert wird (zusätzlich zu style/render):** `w, h` (Größe)
**Was NICHT kopiert wird:** `x, y, z, locked`, alle `ref`/`refs`-Felder

**UX:**
- PropertiesPanel Header: Button "Style kopieren" (nur bei Einzelauswahl, alle 5 Typen)
- PropertiesPanel Header: Button "Style einfügen" (sichtbar wenn `copiedStyle !== null` und ≥1 Element selektiert und Typ matcht)
- Keyboard: `Ctrl+Shift+C` = copy, `Ctrl+Shift+V` = paste (in `App.tsx` registrieren)
- Paste auf mehrere Elemente: alle selektierten Elemente gleichen Typs bekommen das Style

**Kein Persist:** `copiedStyle` nur in Zustand-Memory, kein localStorage.

**Dateien:** `packages/frontend/src/store/useAppStore.ts`, `packages/frontend/src/components/PropertiesPanel/PropertiesPanel.tsx`, `packages/frontend/src/App.tsx`

---

## 6. Default-Größe CompanionButton: 72×72

**Problem:** Neue CompanionButtons haben aktuell `w: 120, h: 120` — zu groß für normale Verwendung.

**Änderung in `AddElementMenu.tsx`:**
- `makeDefault('companionButton')`: `w: 120, h: 120` → `w: 72, h: 72`
- `compactLayout(refs.map(...), canvasPos, 120)` → spacing-Argument `120` → `72`

**Datei:** `packages/frontend/src/components/AddElement/AddElementMenu.tsx`

---

## Abhängigkeiten & Reihenfolge

1. **Zuerst:** Settings-Version-Bump (Punkt 3) — alle anderen Punkte können parallel
2. **shared bauen** nach Typänderungen: `npm run build -w @cwp/shared`
3. Punkte 1, 4, 5, 6 sind unabhängig voneinander
4. Punkte 2 + 3 teilen sich den HostProfile-Typ-Patch

---

## Out of Scope

- Companion-seitige Page-Namen (keine API verfügbar)
- Ctrl+C/V für Element-Duplikat (separates offenes TODO in CLAUDE.md)

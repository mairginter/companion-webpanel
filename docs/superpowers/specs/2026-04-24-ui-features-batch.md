# Design Spec — UI Features Batch (2026-04-24)

5 features: HostManagerModal Edit-Modal, caps-disabled Hinweis, Multi-Button Editing, Copy-to-Panel, Panel Duplicate.

---

## 1. HostManagerModal — Eigenes Edit-Modal

**Problem:** Das Inline-Edit-Formular ist durch `overflow:hidden` auf der Host-Card geclipt. Der Page-Names-Bereich ist nicht erreichbar.

**Lösung:** Edit-Button öffnet ein zweites dediziertes Modal (560px breit, `maxHeight: 85vh`, scrollbar). HostManagerModal selbst bleibt unverändert.

**Verhalten:**
- Edit-Button in der Host-Card → öffnet `HostEditModal` mit dem jeweiligen `HostProfile` als Initialwert
- `HostEditModal` enthält: HostForm (identisch wie bisher) + Save/Cancel-Footer
- Save ruft `saveSettings()` und schließt das Edit-Modal
- Cancel schließt ohne Speichern
- HostManagerModal bleibt während des Edit-Modals geöffnet im Hintergrund (beide Overlay-Ebenen, Edit-Modal hat höheren z-Index)
- Neuer Host ("+ Host hinzufügen") öffnet dasselbe `HostEditModal` mit leerem Formular

**Komponenten:**
- Neue Komponente `HostEditModal` in `HostManagerModal.tsx` (gleiche Datei, als zweite Export-freie Funktion)
- State in `HostManagerModal`: `editingHost: HostProfile | 'new' | null` (statt bisherigem `editing`)

---

## 2. Host-Verbindungsfehler-Hinweis (`caps-disabled`)

**Problem:** Wenn Companion die Button Subscriptions API deaktiviert hat, zeigt der Toolbar-Dot nur eine unklare Warnung. Der User weiß nicht wo er die Einstellung findet.

**Lösung:** Im HostManagerModal erscheint direkt unter einer Host-Card mit Status `caps-disabled` eine Info-Box mit dem Pfad zur Einstellung.

**Info-Box Inhalt:**
```
⚠ Button Subscriptions API nicht aktiv
Aktivieren unter: Companion → Settings → Protocols → „Button Subscriptions API"
```

**Umsetzung:**
- In der Host-Card-Render-Logik: wenn `sessionStatus[host.id] === 'caps-disabled'` → Info-Box nach der Card-Row einfügen
- Stil: orange Border (`#ff8a3d`), `background: rgba(255,138,61,0.08)`, `fontSize: 12`, Padding `8px 12px`
- Kein Button, rein informativer Text mit fettgedrucktem Pfad

---

## 3. Multi-Button Badge-Editing

**Problem:** Bei Mehrfach-Selektion von `companionButton`-Elementen zeigt das PropertiesPanel nur den GeometryBlock. Render-Properties können nicht gemeinsam geändert werden.

**Lösung:** Neue Komponente `CompanionButtonMultiProps` die erscheint wenn ≥2 CompanionButtons selektiert sind.

**Felder (in dieser Reihenfolge):**

Geometrie (`w`/`h`/`x`/`y`) wird bereits vom `GeometryBlock` für Multi-Select gehandelt — nicht doppeln.

| Feld | Typ | Mixed-State |
|---|---|---|
| `ref.hostId` | Select (Host-Liste) | Option "—" als erster Eintrag |
| `showBgColor` | Checkbox | `indeterminate` |
| `showBitmap` | Checkbox | `indeterminate` |
| `showText` | Checkbox | `indeterminate` |
| `textAlign` | Select (center/top/bottom) | Option "—" als erster Eintrag |
| `borderRadius` | NumericInput | leer (Placeholder "—") |
| `physicalStyle` | Checkbox | `indeterminate` |
| `fontSize` | NumericInput | leer (Placeholder "—") |

**Defer: "Companion bgColor"** — kein `bgColorOverride`-Feld existiert in `CompanionButtonElement.render`. Bedarf separater Typ-Erweiterung; out-of-scope für dieses Batch.

**Mixed-State-Logik:**
- Alle Elemente haben gleichen Wert → Wert anzeigen, normal editierbar
- Werte unterschiedlich → `indeterminate` / leer / "—"
- Änderung eines Felds → überschreibt dieses Feld auf **allen** selektierten Buttons (nur das geänderte Feld, andere bleiben)

**Checkbox `indeterminate`:** via `ref.current.indeterminate = true` in `useEffect`

**Integration in `PropertiesPanel.tsx`:**
```
selectedElements.length >= 2
  && selectedElements.every(el => el.type === 'companionButton')
  → <CompanionButtonMultiProps elements={selectedElements} panelId={panel.id} />
```

Erscheint nach GeometryBlock, statt der Single-Element-Props.

**Neue Datei:** `packages/frontend/src/components/PropertiesPanel/CompanionButtonMultiProps.tsx`

---

## 4. Buttons zwischen Panels kopieren

**Problem:** Kein Weg, selektierte Buttons aus einem Panel in ein anderes zu kopieren.

**Lösung:** Toolbar-Button "→ Panel" erscheint im Edit-Mode wenn ≥1 Element selektiert ist. Öffnet Dropdown mit Panel-Liste.

**Toolbar-Platzierung:** Nach dem bestehenden `+`-Add-Button, nur sichtbar wenn `mode === 'edit' && selectedIds.size > 0`.

**Button-Label:** Icon `content_copy` (Material Icons) + kleiner Pfeil, Tooltip "In anderes Panel kopieren"

**Dropdown:**
- Listet alle Panels außer dem aktiven
- Jeder Eintrag: Panel-Name, Klick kopiert sofort
- Kein Panels vorhanden außer dem aktiven → Button disabled mit Tooltip "Kein anderes Panel vorhanden"

**Kopier-Logik:**
- Neue Store-Action `copyElementsToPanel(sourcePanelId, targetPanelId, elementIds)`
- Kopiert Elemente mit neuen UUIDs (`crypto.randomUUID()`) und +75px Offset auf x und y
- Kein Panel-Wechsel — User bleibt auf aktuellem Panel
- Danach `onSave?.()` aufrufen

**Store-Änderung in `useAppStore.ts`:** Neue Action `copyElementsToPanel`

---

## 5. Panel duplizieren

**Problem:** Kein Weg, ein Panel mit all seinen Elementen zu klonen (z.B. als Show-Layout-Basis).

**Lösung:** Drittes Icon **⧉** in jeder Panel-Zeile des Dropdowns (zwischen ✎ Rename und ✕ Delete).

**Verhalten:**
- Klick → erstellt sofort Kopie mit Name `"<Name> Copy"` + alle Elemente mit neuen UUIDs
- Wechselt automatisch zum neuen Panel (`setActivePanelId`)
- Dropdown schließt
- `onSave?.()` wird aufgerufen

**Store-Änderung in `useAppStore.ts`:** Neue Action `duplicatePanel(panelId): Panel`
- Klont das Panel deep (alle Elemente mit neuen IDs via `crypto.randomUUID()`)
- Hängt das neue Panel ans Ende der Liste
- Gibt das neue Panel zurück

---

## Nicht in Scope

- Host-Settings Live-Update ohne Neustart
- Ctrl+C / Ctrl+V (separates Feature)
- Page-Name-Anzeige im Picker

# Per-Button Bitmap-Auflösung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pro CompanionButton einstellbare Bitmap-Auflösung (72/100/144/200 px) — angefordert bei Companion via ADD-SUB BITMAP=N, per-Button persistent in Settings, mit automatischem Re-Subscribe bei Änderung.

**Architecture:** SatelliteClient nimmt bitmapSize pro subscribe()-Aufruf. HostManager verfolgt bitmapSizes mit Map<string,Map<string,number>> (hostId→"p/r/c"→px) statt Set; Diff-Logik erkennt Größenänderung → REMOVE-SUB+ADD-SUB. CompanionButtonProps und MultiProps zeigen Select 72/100/144/200 px (nur sichtbar wenn showBitmap=true). Keine Settings-Schema-Version bump nötig (bitmapSize ist bereits in types.ts).

**Tech Stack:** TypeScript, React, react-i18next, ws (WebSocket), Vitest

---

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `packages/backend/src/satellite/SatelliteClient.ts` | `SubInfo.bitmapSize`, `subscribe(…, bitmapSize)`, `sendAddSub(…, bitmapSize)` |
| `packages/backend/src/HostManager.ts` | `realSubKeys→realSubSizes: Map<string,Map<string,number>>`, `buildDesiredSubs` liefert auch bitmapSize, Sync-Diff prüft Größenänderung |
| `packages/frontend/src/components/PropertiesPanel/CompanionButtonProps.tsx` | Select 72/100/144/200 px wenn showBitmap=true |
| `packages/frontend/src/components/PropertiesPanel/CompanionButtonMultiProps.tsx` | commonBitmapSize + Select für Batch-Edit |
| `packages/shared/locales/de.json` | `"bitmapSize": "Bitmap-Auflösung"` |
| `packages/shared/locales/en.json` | `"bitmapSize": "Bitmap resolution"` |
| `packages/electron/package.json` | Version 1.3.4 → 1.3.5 |
| `CLAUDE.md` | Release-Eintrag v1.3.5 + Offene Aufgaben aktualisieren |

---

## Task 1: SatelliteClient — bitmapSize in subscribe() und sendAddSub()

**Files:**
- Modify: `packages/backend/src/satellite/SatelliteClient.ts`

- [ ] **Step 1: SubInfo um bitmapSize erweitern**

  In `SatelliteClient.ts` Zeile 39–43, ersetze:
  ```typescript
  interface SubInfo {
    page: number
    row: number
    col: number
  }
  ```
  durch:
  ```typescript
  interface SubInfo {
    page: number
    row: number
    col: number
    bitmapSize: number
  }
  ```

- [ ] **Step 2: subscribe() Signatur und Speicherung anpassen**

  Zeile 110–115, ersetze:
  ```typescript
  subscribe(subId: string, page: number, row: number, col: number): void {
    this.activeSubs.set(subId, { page, row, col })
    if (this.status === 'connected') {
      this.sendAddSub(subId, page, row, col)
    }
  }
  ```
  durch:
  ```typescript
  subscribe(subId: string, page: number, row: number, col: number, bitmapSize = 72): void {
    this.activeSubs.set(subId, { page, row, col, bitmapSize })
    if (this.status === 'connected') {
      this.sendAddSub(subId, page, row, col, bitmapSize)
    }
  }
  ```

- [ ] **Step 3: sendAddSub() Signatur und BITMAP-Parameter anpassen**

  Zeile 337–342, ersetze:
  ```typescript
  private sendAddSub(subId: string, page: number, row: number, col: number): void {
    // LOCATION-Format: "<page>/<row>/<col>"
    this.sendLine(
      `ADD-SUB SUBID=${subId} LOCATION=${page}/${row}/${col} ` +
      `BITMAP=72 COLORS=hex TEXT=true TEXT_STYLE=true`,
    )
  }
  ```
  durch:
  ```typescript
  private sendAddSub(subId: string, page: number, row: number, col: number, bitmapSize: number): void {
    // LOCATION-Format: "<page>/<row>/<col>"
    this.sendLine(
      `ADD-SUB SUBID=${subId} LOCATION=${page}/${row}/${col} ` +
      `BITMAP=${bitmapSize} COLORS=hex TEXT=true TEXT_STYLE=true`,
    )
  }
  ```

- [ ] **Step 4: handleCaps — Re-Subscribe nach Reconnect nutzt gespeicherte bitmapSize**

  Zeile 274–276 (im handleCaps-Bereich), ersetze:
  ```typescript
    for (const [subId, { page, row, col }] of this.activeSubs) {
      this.sendAddSub(subId, page, row, col)
    }
  ```
  durch:
  ```typescript
    for (const [subId, { page, row, col, bitmapSize }] of this.activeSubs) {
      this.sendAddSub(subId, page, row, col, bitmapSize)
    }
  ```

- [ ] **Step 5: TypeScript-Check**

  ```powershell
  cd "c:\Users\alex.mairginter\OneDrive - mairginter\Documents\AppProjekts\Bitfocus_Companion\CompanionWebpannel"
  npx tsc --noEmit -p packages/backend/tsconfig.json
  ```
  Erwartung: keine Fehler (ggf. `skipLibCheck: true` fängt vitest-Inkompatibilität ab)

- [ ] **Step 6: Commit**

  ```powershell
  git add packages/backend/src/satellite/SatelliteClient.ts
  git commit -m "feat(satellite): add bitmapSize param to subscribe() and sendAddSub()"
  ```

---

## Task 2: HostManager — bitmapSize tracking + Diff-Logik

**Files:**
- Modify: `packages/backend/src/HostManager.ts`

- [ ] **Step 1: realSubKeys → realSubSizes umbenennen und Typ ändern**

  Zeile 36–37, ersetze:
  ```typescript
  // Echte Subscriptions (von Panel-Elementen): hostId → Set<"page/row/col">
  private realSubKeys = new Map<string, Set<string>>()
  ```
  durch:
  ```typescript
  // Echte Subscriptions (von Panel-Elementen): hostId → Map<"page/row/col" → bitmapSize>
  private realSubSizes = new Map<string, Map<string, number>>()
  ```

- [ ] **Step 2: autoConnect=false Handler anpassen**

  Zeile 93 (in syncSubscriptions), ersetze:
  ```typescript
        this.realSubKeys.delete(host.id)
  ```
  durch:
  ```typescript
        this.realSubSizes.delete(host.id)
  ```

- [ ] **Step 3: Sync-Logik für bitmapSize-Diff anpassen**

  Zeile 110–129 (in syncSubscriptions), ersetze den Block:
  ```typescript
      const client = this.clients.get(hostId)!
      const currentReal = this.realSubKeys.get(hostId) ?? new Set<string>()
      const desiredForHost = desired.get(hostId) ?? new Set<string>()

      // Neue Subscriptions hinzufügen
      for (const prc of desiredForHost) {
        if (!currentReal.has(prc)) {
          const [p, r, c] = prc.split('/').map(Number)
          client.subscribe(`cwp/${prc}`, p, r, c)
        }
      }

      // Entfernte Subscriptions abmelden
      for (const prc of currentReal) {
        if (!desiredForHost.has(prc)) {
          client.unsubscribe(`cwp/${prc}`)
        }
      }

      this.realSubKeys.set(hostId, desiredForHost)
  ```
  durch:
  ```typescript
      const client = this.clients.get(hostId)!
      const currentSizes = this.realSubSizes.get(hostId) ?? new Map<string, number>()
      const desiredSizes = desired.get(hostId) ?? new Map<string, number>()

      // Neue und geänderte Subscriptions hinzufügen (Größenänderung → Re-Subscribe)
      for (const [prc, bitmapSize] of desiredSizes) {
        const currentSize = currentSizes.get(prc)
        if (currentSize === undefined) {
          // Neu: direkt subscriben
          const [p, r, c] = prc.split('/').map(Number)
          client.subscribe(`cwp/${prc}`, p, r, c, bitmapSize)
        } else if (currentSize !== bitmapSize) {
          // Gleicher Button, andere Größe → REMOVE-SUB + ADD-SUB
          client.unsubscribe(`cwp/${prc}`)
          const [p, r, c] = prc.split('/').map(Number)
          client.subscribe(`cwp/${prc}`, p, r, c, bitmapSize)
        }
        // gleiche Größe: nichts tun
      }

      // Entfernte Subscriptions abmelden
      for (const prc of currentSizes.keys()) {
        if (!desiredSizes.has(prc)) {
          client.unsubscribe(`cwp/${prc}`)
        }
      }

      this.realSubSizes.set(hostId, desiredSizes)
  ```

- [ ] **Step 4: stop() anpassen**

  Zeile ~216 (in stop()), ersetze:
  ```typescript
    this.realSubKeys.clear()
  ```
  durch:
  ```typescript
    this.realSubSizes.clear()
  ```

- [ ] **Step 5: sendAllSnapshotsToClient — pages aus realSubSizes lesen**

  Zeile ~278–285 (in sendAllSnapshotsToClient), ersetze:
  ```typescript
      const allKeys = [
        ...(this.realSubKeys.get(hostId) ?? []),
        ...(this.pickerSubKeys.get(hostId) ?? []),
      ]
      for (const prc of allKeys) {
  ```
  durch:
  ```typescript
      const allKeys = [
        ...(this.realSubSizes.get(hostId)?.keys() ?? []),
        ...(this.pickerSubKeys.get(hostId) ?? []),
      ]
      for (const prc of allKeys) {
  ```

- [ ] **Step 6: buildDesiredSubs — Rückgabetyp und bitmapSize aus Elementen lesen**

  Zeile ~249–271 (buildDesiredSubs), ersetze die gesamte Methode:
  ```typescript
  private buildDesiredSubs(settings: Settings): Map<string, Set<string>> {
    const desired = new Map<string, Set<string>>()

    const addRef = (ref: import('@cwp/shared').CompanionRef | undefined) => {
      if (!ref) return
      const { hostId, page, row, col } = ref
      if (!desired.has(hostId)) desired.set(hostId, new Set())
      desired.get(hostId)!.add(`${page}/${row}/${col}`)
    }

    for (const panel of settings.panels) {
      for (const el of panel.elements) {
        if (el.type === 'companionButton') {
          addRef(el.ref)
        } else if (el.type === 'channelStrip') {
          addRef(el.refs.button.ref)
          addRef(el.refs.solo)
          addRef(el.refs.pan)
        }
      }
    }

    return desired
  }
  ```
  durch:
  ```typescript
  /**
   * Liest alle companionButton-Refs aus allen Panels und gruppiert sie nach hostId.
   * Ergebnis: hostId → Map<"page/row/col", bitmapSize>
   * Bei mehreren Elementen auf gleichem Button: MAX-Auflösung gewinnt.
   */
  private buildDesiredSubs(settings: Settings): Map<string, Map<string, number>> {
    const desired = new Map<string, Map<string, number>>()

    const addRef = (ref: import('@cwp/shared').CompanionRef | undefined, bitmapSize = 72) => {
      if (!ref) return
      const { hostId, page, row, col } = ref
      if (!desired.has(hostId)) desired.set(hostId, new Map())
      const key = `${page}/${row}/${col}`
      const existing = desired.get(hostId)!.get(key) ?? 0
      // MAX: wenn mehrere Elemente denselben Button referenzieren, höchste Auflösung nehmen
      desired.get(hostId)!.set(key, Math.max(existing, bitmapSize))
    }

    for (const panel of settings.panels) {
      for (const el of panel.elements) {
        if (el.type === 'companionButton') {
          addRef(el.ref, el.render?.bitmapSize ?? 72)
        } else if (el.type === 'channelStrip') {
          addRef(el.refs.button.ref, 72)
          addRef(el.refs.solo, 72)
          addRef(el.refs.pan, 72)
        }
      }
    }

    return desired
  }
  ```

- [ ] **Step 7: syncSubscriptions Typ-Signatur aktualisieren**

  Am Anfang von `syncSubscriptions` (Zeile 83–85), ersetze:
  ```typescript
    // Desired: hostId → Set<"page/row/col"> aus allen companionButton-Elementen
    const desired = this.buildDesiredSubs(settings)
  ```
  durch:
  ```typescript
    // Desired: hostId → Map<"page/row/col", bitmapSize> aus allen companionButton-Elementen
    const desired = this.buildDesiredSubs(settings)
  ```

- [ ] **Step 8: TypeScript-Check Backend**

  ```powershell
  npx tsc --noEmit -p packages/backend/tsconfig.json
  ```
  Erwartung: 0 Fehler

- [ ] **Step 9: Commit**

  ```powershell
  git add packages/backend/src/HostManager.ts
  git commit -m "feat(backend): per-button bitmapSize tracking in HostManager — re-subscribe on size change"
  ```

---

## Task 3: i18n — Übersetzungsstrings hinzufügen

**Files:**
- Modify: `packages/shared/locales/de.json`
- Modify: `packages/shared/locales/en.json`

- [ ] **Step 1: Deutschen String einfügen**

  In `de.json`, nach Zeile 100 (`"scaleBitmap": "Bitmap skalieren",`), einfügen:
  ```json
      "bitmapSize": "Bitmap-Auflösung",
  ```

- [ ] **Step 2: Englischen String einfügen**

  In `en.json`, nach Zeile 100 (`"scaleBitmap": "Scale bitmap",`), einfügen:
  ```json
      "bitmapSize": "Bitmap resolution",
  ```

- [ ] **Step 3: Commit**

  ```powershell
  git add packages/shared/locales/de.json packages/shared/locales/en.json
  git commit -m "feat(i18n): add bitmapSize translation key (de/en)"
  ```

---

## Task 4: CompanionButtonProps — Select UI für Einzelelement

**Files:**
- Modify: `packages/frontend/src/components/PropertiesPanel/CompanionButtonProps.tsx`

- [ ] **Step 1: bitmapSize-Select nach showBitmap-Block einfügen**

  Der `showBitmap`-Block (Zeile 106–115) sieht aktuell so aus:
  ```tsx
        <div style={row}>
          <span style={lbl}>{t('propertiesPanel.showBitmap')}</span>
          <input type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }} checked={tog(r.showBitmap, false)} onChange={(e) => updateRender({ showBitmap: e.target.checked })} />
        </div>
        {tog(r.showBitmap, false) && (
          <div style={row}>
            <span style={lbl}>{t('propertiesPanel.scaleBitmap')}</span>
            <input type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }} checked={tog(r.scaleBitmap, true)} onChange={(e) => updateRender({ scaleBitmap: e.target.checked })} />
          </div>
        )}
  ```

  Ersetze durch:
  ```tsx
        <div style={row}>
          <span style={lbl}>{t('propertiesPanel.showBitmap')}</span>
          <input type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }} checked={tog(r.showBitmap, false)} onChange={(e) => updateRender({ showBitmap: e.target.checked })} />
        </div>
        {tog(r.showBitmap, false) && (
          <>
            <div style={row}>
              <span style={lbl}>{t('propertiesPanel.scaleBitmap')}</span>
              <input type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }} checked={tog(r.scaleBitmap, true)} onChange={(e) => updateRender({ scaleBitmap: e.target.checked })} />
            </div>
            <div style={row}>
              <span style={lbl}>{t('propertiesPanel.bitmapSize')}</span>
              <select
                value={r.bitmapSize ?? 72}
                style={sel}
                onChange={(e) => updateRender({ bitmapSize: parseInt(e.target.value, 10) })}
              >
                <option value={72}>72 px</option>
                <option value={100}>100 px</option>
                <option value={144}>144 px</option>
                <option value={200}>200 px</option>
              </select>
            </div>
          </>
        )}
  ```

- [ ] **Step 2: TypeScript-Check Frontend**

  ```powershell
  npx tsc --noEmit -p packages/frontend/tsconfig.json
  ```
  Erwartung: 0 Fehler

- [ ] **Step 3: Commit**

  ```powershell
  git add packages/frontend/src/components/PropertiesPanel/CompanionButtonProps.tsx
  git commit -m "feat(ui): bitmapSize select (72/100/144/200px) in CompanionButtonProps"
  ```

---

## Task 5: CompanionButtonMultiProps — bitmapSize im Batch-Edit

**Files:**
- Modify: `packages/frontend/src/components/PropertiesPanel/CompanionButtonMultiProps.tsx`

- [ ] **Step 1: commonBitmapSize hinzufügen**

  Nach Zeile 103 (`const commonFontSize = common(elements, (el) => r(el).fontSize)`), einfügen:
  ```typescript
    const commonBitmapSize = common(elements, (el) => r(el).bitmapSize ?? 72)
  ```

- [ ] **Step 2: UI-Block für bitmapSize einfügen**

  Nach dem `fontSize`-Block (nach Zeile 205, vor dem schließenden `</div>`), einfügen:
  ```tsx
        {/* bitmapSize */}
        <div style={row}>
          <span style={lbl}>{t('propertiesPanel.bitmapSize')}</span>
          <select
            style={{ ...sel, fontSize: 13, padding: '4px 8px' }}
            value={commonBitmapSize ?? ''}
            onChange={(e) => e.target.value && patchRender({ bitmapSize: parseInt(e.target.value, 10) })}
          >
            {commonBitmapSize === null && <option value="">—</option>}
            <option value={72}>72 px</option>
            <option value={100}>100 px</option>
            <option value={144}>144 px</option>
            <option value={200}>200 px</option>
          </select>
        </div>
  ```

- [ ] **Step 3: TypeScript-Check**

  ```powershell
  npx tsc --noEmit -p packages/frontend/tsconfig.json
  ```
  Erwartung: 0 Fehler

- [ ] **Step 4: Commit**

  ```powershell
  git add packages/frontend/src/components/PropertiesPanel/CompanionButtonMultiProps.tsx
  git commit -m "feat(ui): bitmapSize select in CompanionButtonMultiProps (batch-edit)"
  ```

---

## Task 6: Tests ausführen

**Files:** keine Änderungen, nur Verifikation

- [ ] **Step 1: Backend-Tests**

  ```powershell
  npm run test -w @cwp/backend
  ```
  Erwartung: alle Tests grün (oder keine Tests vorhanden)

- [ ] **Step 2: Frontend-Tests**

  ```powershell
  npm run test -w @cwp/frontend
  ```
  Erwartung: alle Tests grün — insbesondere `CompanionButtonElement.test.ts` und `useAppStore.test.ts`

- [ ] **Step 3: Shared-Tests**

  ```powershell
  npm run test -w @cwp/shared
  ```
  Erwartung: alle Tests grün

---

## Task 7: Version 1.3.5 — Build und Release

**Files:**
- Modify: `packages/electron/package.json` (version: 1.3.4 → 1.3.5)

- [ ] **Step 1: Version bumpen**

  In `packages/electron/package.json`, Zeile mit `"version": "1.3.4"`, ändern zu:
  ```json
  "version": "1.3.5",
  ```

- [ ] **Step 2: Shared neu bauen**

  ```powershell
  npm run build -w @cwp/shared
  ```
  Erwartung: `packages/shared/dist/` aktualisiert, 0 Fehler

- [ ] **Step 3: Frontend bauen**

  ```powershell
  npm run build -w @cwp/frontend
  ```
  Erwartung: `packages/frontend/dist/` aktualisiert, 0 Fehler

- [ ] **Step 4: Electron-Renderer bauen**

  ```powershell
  cd packages/electron && node build.mjs
  ```
  Erwartung: Renderer-Bundle in `packages/electron/dist/renderer/`, 0 Fehler

- [ ] **Step 5: Release bauen**

  ```powershell
  cd "c:\Users\alex.mairginter\OneDrive - mairginter\Documents\AppProjekts\Bitfocus_Companion\CompanionWebpannel"
  npm run release
  ```
  Erwartung: `CompanionWebpanel-1.3.5.exe` (Win x64 portable) in `dist/` oder `release/`

- [ ] **Step 6: Git-Tag setzen und Version-Commit**

  ```powershell
  git add packages/electron/package.json
  git commit -m "chore: release v1.3.5 — per-button bitmap resolution"
  git tag v1.3.5
  ```

---

## Task 8: Dokumentation aktualisieren

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Release-Eintrag v1.3.5 im CLAUDE.md hinzufügen**

  Im Abschnitt "Code Review v1.3.0 — Umgesetzt", nach dem v1.3.4-Eintrag (oder letztem Release), hinzufügen:
  ```markdown
  - ✅ **Release v1.3.5** — Per-Button Bitmap-Auflösung (72/100/144/200px): Select in Props + MultiProps, SatelliteClient BITMAP=N per ADD-SUB, HostManager Re-Subscribe bei Größenänderung; `CompanionWebpanel-1.3.5.exe` portable (Win x64), Tag `v1.3.5` lokal (nicht gepusht)
  ```

- [ ] **Step 2: Offene Aufgabe im CLAUDE.md aktualisieren**

  Im Abschnitt "CompanionButton", suche nach:
  ```
  - ⬜ **Mute → Meter in Blautönen**
  ```
  und füge davor die neue abgeschlossene Aufgabe ein:
  ```markdown
  - ✅ **Per-Button Bitmap-Auflösung** — `render.bitmapSize` (72/100/144/200 px) in `CompanionButtonProps` (Select unter showBitmap) + `CompanionButtonMultiProps`; SatelliteClient `subscribe(…, bitmapSize)` übergibt `BITMAP=N` an `ADD-SUB`; HostManager `realSubSizes: Map<string,Map<string,number>>` erkennt Größenänderung → automatischer Re-Subscribe (REMOVE-SUB+ADD-SUB); mehrere Elemente auf gleichem Button → MAX-Auflösung (v1.3.5)
  ```

- [ ] **Step 3: Commit**

  ```powershell
  git add CLAUDE.md
  git commit -m "docs: update CLAUDE.md for v1.3.5 — per-button bitmap size"
  ```

---

## Self-Review

**Spec-Abdeckung:**
- ✅ Default 72px — `bitmapSize = 72` Default-Parameter in `subscribe()`, `r.bitmapSize ?? 72` in UI
- ✅ Auswahlfeld 72/100/144/200 — in `CompanionButtonProps` (Einzelelement) + `CompanionButtonMultiProps` (Batch)
- ✅ Nur sichtbar wenn `showBitmap=true` — Select ist im `{tog(r.showBitmap, false) && ...}` Block
- ✅ Backend nimmt die Einstellung und sendet sie an Companion — `BITMAP=${bitmapSize}` in `sendAddSub`
- ✅ Re-Subscribe bei Änderung — HostManager Diff erkennt `currentSize !== bitmapSize`
- ✅ Release 1.3.5 — Task 7
- ✅ Dokumentation — Task 8
- ✅ Settings-Schema: kein Bump nötig — `bitmapSize?: number` war bereits in `types.ts:70`
- ✅ Picker-Subscriptions: nicht betroffen — `addPickerSubscriptions` ruft `subscribe()` ohne bitmapSize → Default 72

**Placeholder-Check:** Kein TBD, kein TODO, kein "ähnlich wie Task N" — alle Codeblöcke vollständig.

**Typ-Konsistenz:**
- `SubInfo.bitmapSize: number` → verwendet in `subscribe()`, `handleCaps`, `sendAddSub()`
- `Map<string, Map<string, number>>` → consistent in `realSubSizes`, `buildDesiredSubs()` Rückgabe, Sync-Logik
- `r.bitmapSize ?? 72` → consistent in `CompanionButtonProps` und `CompanionButtonMultiProps`
- `parseInt(e.target.value, 10)` → consistent in beiden UI-Komponenten

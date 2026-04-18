# UI Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 6 UI-Anpassungen: ChannelStrip-Name als Override, Page-Namen lokal konfigurierbar, Page-Listbox im Picker, Picker merkt letzte Page, Element-Style Copy/Paste (Ctrl+Shift+C/V + Buttons), Default-Größe CompanionButton 72×72.

**Architecture:** Alle Änderungen im Frontend (React/Zustand). Settings-Version-Bump 1.4.0→1.5.0 für neue HostProfile-Felder (maxPages, pageNames). Der Store bekommt copiedStyle-State für die Copy/Paste-Funktion. Picker-Memory via localStorage.

**Tech Stack:** React, TypeScript, Zustand (useAppStore), vitest, Node.js backend (für Version-Bump)

---

## File Map

| Datei | Änderung |
|---|---|
| `packages/shared/src/types.ts` | HostProfile: +maxPages, +pageNames; Settings version 1.4.0→1.5.0 |
| `CompanionWebpannelSettings.schema.json` | version pattern 1.4.0→1.5.0 |
| `CompanionWebpannelSettings.json` | version field bump |
| `packages/backend/src/standalone.ts` | expectedVersion bump |
| `packages/backend/src/server/ClientServer.ts` | version check bump |
| `packages/electron/src/settingsHelper.ts` | getDefaultSettings + neue Migration |
| `packages/frontend/src/store/useAppStore.ts` | +copiedStyle, +copyElementStyle, +pasteElementStyle |
| `packages/frontend/src/store/useAppStore.test.ts` | version bump + neue Tests für copy/paste |
| `packages/frontend/src/components/Elements/ChannelStripElement.tsx` | name-Priorität |
| `packages/frontend/src/components/PropertiesPanel/ChannelStripProps.tsx` | Label-Text |
| `packages/frontend/src/components/HostManager/HostManagerModal.tsx` | maxPages + pageNames im HostForm |
| `packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx` | Page-Select + localStorage-Memory |
| `packages/frontend/src/components/PropertiesPanel/PropertiesPanel.tsx` | Copy/Paste-Buttons im Header |
| `packages/frontend/src/App.tsx` | Ctrl+Shift+C/V shortcuts |
| `packages/frontend/src/components/AddElement/AddElementMenu.tsx` | 72×72 default + compactLayout spacing |

---

## Task 1: ChannelStrip Name Override

**Files:**
- Modify: `packages/frontend/src/components/Elements/ChannelStripElement.tsx:93`
- Modify: `packages/frontend/src/components/PropertiesPanel/ChannelStripProps.tsx:215`

- [ ] **Step 1: Name-Priorität umkehren**

In `ChannelStripElement.tsx` Zeile 93, ersetze:
```typescript
  const channelName = parsed.name ?? style.name ?? ''
```
mit:
```typescript
  const channelName = style.name || parsed.name || ''
```

- [ ] **Step 2: Label aktualisieren**

In `ChannelStripProps.tsx` Zeile 215, ersetze:
```tsx
        <span style={lbl}>Name (Fallback)</span>
```
mit:
```tsx
        <span style={lbl}>Name (Override)</span>
```

- [ ] **Step 3: TypeScript-Check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```
Erwartet: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/Elements/ChannelStripElement.tsx
git add packages/frontend/src/components/PropertiesPanel/ChannelStripProps.tsx
git commit -m "feat(channelStrip): name as override instead of fallback"
```

---

## Task 2: Settings Version Bump 1.4.0 → 1.5.0 + HostProfile-Felder

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `CompanionWebpannelSettings.schema.json`
- Modify: `CompanionWebpannelSettings.json`
- Modify: `packages/backend/src/standalone.ts`
- Modify: `packages/backend/src/server/ClientServer.ts`
- Modify: `packages/electron/src/settingsHelper.ts`
- Modify: `packages/frontend/src/store/useAppStore.test.ts`

- [ ] **Step 1: shared/types.ts — Version + HostProfile**

Ersetze in `packages/shared/src/types.ts`:
```typescript
// ─── Settings Types (spiegeln CompanionWebpannelSettings.schema.json v1.4.0) ───

export interface Settings {
  version: '1.4.0'
```
mit:
```typescript
// ─── Settings Types (spiegeln CompanionWebpannelSettings.schema.json v1.5.0) ───

export interface Settings {
  version: '1.5.0'
```

Füge in `HostProfile` nach `gridRows?: number` ein:
```typescript
  /** Maximale Anzahl Pages im Picker-Dropdown. Default: 99 */
  maxPages?: number
  /** Lokale Page-Namen. Key = Page-Nummer (1-basiert). */
  pageNames?: Record<number, string>
```

- [ ] **Step 2: schema.json — Version pattern**

In `CompanionWebpannelSettings.schema.json`, ersetze:
```json
"pattern": "^1\\.4\\.0$"
```
mit:
```json
"pattern": "^1\\.5\\.0$"
```

- [ ] **Step 3: CompanionWebpannelSettings.json — version field**

Ersetze:
```json
"version": "1.4.0",
```
mit:
```json
"version": "1.5.0",
```

- [ ] **Step 4: standalone.ts — expectedVersion**

In `packages/backend/src/standalone.ts`, ersetze:
```typescript
  const expectedVersion: Settings['version'] = '1.4.0'
```
mit:
```typescript
  const expectedVersion: Settings['version'] = '1.5.0'
```

- [ ] **Step 5: ClientServer.ts — version check**

In `packages/backend/src/server/ClientServer.ts`, ersetze:
```typescript
            if (incoming.version !== '1.4.0') {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: `Ungültige Schema-Version: ${incoming.version}` }))
```
mit:
```typescript
            if (incoming.version !== '1.5.0') {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: `Ungültige Schema-Version: ${incoming.version}` }))
```

- [ ] **Step 6: settingsHelper.ts — getDefaultSettings + Migration**

In `packages/electron/src/settingsHelper.ts`:

Ersetze `version: '1.4.0'` in `getDefaultSettings()`:
```typescript
    version: '1.5.0',
```

Füge nach der bestehenden `v1.3.0 → v1.4.0` Migration ein:
```typescript
  // Migration: v1.4.0 → v1.5.0 (maxPages + pageNames in HostProfile)
  if (settings.version === '1.4.0') {
    settings.version = '1.5.0'
    migrated = true
  }
```

- [ ] **Step 7: Test-Fixture version bump**

In `packages/frontend/src/store/useAppStore.test.ts`, ersetze:
```typescript
  version: '1.4.0',
```
mit:
```typescript
  version: '1.5.0',
```

- [ ] **Step 8: shared neu bauen**

```bash
npm run build -w @cwp/shared
```
Erwartet: Build erfolgreich

- [ ] **Step 9: TypeScript-Check + Tests**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
npx tsc --noEmit -p packages/backend/tsconfig.json
npm test -w @cwp/frontend
```
Erwartet: keine Fehler, alle Tests grün

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/types.ts CompanionWebpannelSettings.schema.json
git add CompanionWebpannelSettings.json packages/backend/src/standalone.ts
git add packages/backend/src/server/ClientServer.ts packages/electron/src/settingsHelper.ts
git add packages/frontend/src/store/useAppStore.test.ts
git commit -m "chore: bump settings version 1.4.0 → 1.5.0 (maxPages, pageNames)"
```

---

## Task 3: HostManagerModal — maxPages + pageNames

**Files:**
- Modify: `packages/frontend/src/components/HostManager/HostManagerModal.tsx`

Die Änderungen gehen in die `HostForm`-Komponente (ca. Zeile 157–260). Das bestehende Grid-Section-Ende liegt bei Zeile ~257 (`</div>` nach dem gridRows-Input).

- [ ] **Step 1: emptyHost um neue Felder erweitern**

In `HostManagerModal.tsx` die `emptyHost()`-Funktion (ca. Zeile 137–148), füge nach `gridRows: 4` ein:
```typescript
    maxPages: 99,
    pageNames: {},
```

- [ ] **Step 2: maxPages-Feld zum HostForm hinzufügen**

In `HostForm`, direkt nach dem bestehenden Button-Grid-Block (nach `</div>` des gridRows-Divs, vor dem schließenden `</div>` der gesamten Grid-Section, ca. Zeile 256), füge ein:
```tsx
      {/* Max. Pages */}
      <div>
        <label style={labelStyle}>Max. Pages (Picker-Dropdown)</label>
        <input
          style={inputStyle}
          type="number"
          min={1}
          max={999}
          value={value.maxPages ?? 99}
          onChange={(e) => set({ maxPages: Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 99)) })}
        />
      </div>
```

- [ ] **Step 3: pageNames-Editor hinzufügen**

Nach dem maxPages-Block, füge eine aufklappbare Page-Namen-Sektion ein. Dafür brauchen wir lokalen State im `HostForm`. Da `HostForm` aktuell keine State-Hooks hat, füge `useState` hinzu:

Am Anfang von `HostForm`, nach der `set`-Zeile:
```tsx
  const [pageNamesOpen, setPageNamesOpen] = React.useState(false)
  const maxP = value.maxPages ?? 99
  const pageNums = Array.from({ length: maxP }, (_, i) => i + 1)
```

Dann nach dem maxPages-Block:
```tsx
      {/* Page-Namen */}
      <div>
        <button
          type="button"
          onClick={() => setPageNamesOpen((v) => !v)}
          style={{
            background: 'none', border: '1px solid #2a3344', borderRadius: 6,
            color: '#8896aa', fontSize: 12, padding: '5px 10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {pageNamesOpen ? '▼' : '▶'} Page-Namen konfigurieren
        </button>
        {pageNamesOpen && (
          <div style={{
            marginTop: 8,
            maxHeight: 200,
            overflowY: 'auto',
            border: '1px solid #2a3344',
            borderRadius: 6,
            background: '#121821',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            {pageNums.map((n) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#4a5568', minWidth: 52 }}>Page {n}</span>
                <input
                  style={{ ...inputStyle, padding: '3px 8px', fontSize: 12 }}
                  placeholder="(kein Name)"
                  value={value.pageNames?.[n] ?? ''}
                  onChange={(e) => {
                    const names = { ...(value.pageNames ?? {}) }
                    if (e.target.value) names[n] = e.target.value
                    else delete names[n]
                    set({ pageNames: Object.keys(names).length > 0 ? names : undefined })
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
```

- [ ] **Step 4: TypeScript-Check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```
Erwartet: keine Fehler

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/components/HostManager/HostManagerModal.tsx
git commit -m "feat(hostManager): add maxPages and pageNames configuration"
```

---

## Task 4: Picker — Page-Listbox + localStorage-Memory

**Files:**
- Modify: `packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx`

- [ ] **Step 1: localStorage-Hilfsfunktionen hinzufügen**

Nach den Konstanten-Definitionen (nach `const LABEL_STYLE` und `SELECT_STYLE`, ca. Zeile 73–78), füge ein:
```typescript
const LS_PAGE_KEY = (hostId: string) => `cwp:picker:lastPage:${hostId}`

function loadLastPage(hostId: string): number {
  return parseInt(localStorage.getItem(LS_PAGE_KEY(hostId)) ?? '') || 1
}

function saveLastPage(hostId: string, page: number): void {
  localStorage.setItem(LS_PAGE_KEY(hostId), String(page))
}
```

- [ ] **Step 2: pageNum-Initialwert auf localStorage-Memory umstellen**

In `CompanionButtonPickerDialog`, ersetze die `pageNum`-State-Initialisierung (ca. Zeile 95):
```typescript
  const [pageNum, setPageNum] = useState<number>(initialRef?.page ?? 1)
```
mit:
```typescript
  const [pageNum, setPageNum] = useState<number>(() => {
    const startHost = initialRef?.hostId ?? connectedHosts[0]?.id ?? ''
    return initialRef?.page ?? (startHost ? loadLastPage(startHost) : 1)
  })
```

- [ ] **Step 3: setPageNum-Wrapper mit Persist anlegen**

Direkt nach den State-Deklarationen (nach `const [loadingPreview, setLoadingPreview] = useState(false)`, ca. Zeile 100), füge ein:
```typescript
  const changePage = (page: number) => {
    setPageNum(page)
    if (hostId) saveLastPage(hostId, page)
    setSelectedCells(new Set())
    lastClickedCell.current = null
  }
```

- [ ] **Step 4: handleHostChange um Memory erweitern**

Die `handleHostChange`-Funktion (ca. Zeile 161) ersetzen:
```typescript
  const handleHostChange = (id: string) => {
    setHostId(id)
    setSelectedCells(new Set())
    lastClickedCell.current = null
    const host = settings?.hosts.find((h) => h.id === id)
    if (host?.gridCols !== undefined) setKeysPerRow(host.gridCols)
    if (host?.gridRows !== undefined) setRows(host.gridRows)
    const savedPage = loadLastPage(id)
    setPageNum(savedPage)
    saveLastPage(id, savedPage)
  }
```

- [ ] **Step 5: NumericInput "Page" durch Select ersetzen**

Ersetze den gesamten Page-NumericInput-Block (ca. Zeile 242–251):
```tsx
              <div style={{ flex: 1 }}>
                <NumericInput
                  label="Page"
                  value={pageNum}
                  min={1}
                  onChange={(v) => { setPageNum(v); setSelectedCells(new Set()); lastClickedCell.current = null }}
                  compact
                />
              </div>
```
mit:
```tsx
              <div style={{ flex: 1 }}>
                <div style={LABEL_STYLE}>Page</div>
                {(() => {
                  const host = settings?.hosts.find((h) => h.id === hostId)
                  const maxP = host?.maxPages ?? 99
                  const pageNamesMap = host?.pageNames ?? {}
                  return (
                    <select
                      style={SELECT_STYLE}
                      value={pageNum}
                      onChange={(e) => changePage(parseInt(e.target.value, 10))}
                    >
                      {Array.from({ length: maxP }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {pageNamesMap[n] ? `${n} — ${pageNamesMap[n]}` : String(n)}
                        </option>
                      ))}
                    </select>
                  )
                })()}
              </div>
```

- [ ] **Step 6: Alle direkten setPageNum-Aufrufe auf changePage umstellen**

In der JSX (handleInsertPage und handleConfirm greifen nicht auf setPageNum zu — ok). Der einzige verbleibende direkte `setPageNum`-Aufruf ist in `handleHostChange` — bereits erledigt in Step 4. Prüfe mit grep:
```bash
grep -n "setPageNum" packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx
```
Erwartet: nur noch die State-Deklaration und die eine Zeile in `changePage`. Falls noch weitere existieren, auf `changePage(v)` umstellen.

- [ ] **Step 7: TypeScript-Check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```
Erwartet: keine Fehler

- [ ] **Step 8: Commit**

```bash
git add packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx
git commit -m "feat(picker): page select dropdown + last-page localStorage memory"
```

---

## Task 5: Store — copiedStyle / copyElementStyle / pasteElementStyle

**Files:**
- Modify: `packages/frontend/src/store/useAppStore.ts`
- Modify: `packages/frontend/src/store/useAppStore.test.ts`

- [ ] **Step 1: Tests schreiben (TDD — werden zunächst rot sein)**

In `useAppStore.test.ts`, füge am Ende der Datei ein neues `describe`-Block hinzu. Das `makeSettings()` muss um Elemente aller relevanten Typen erweitert werden. Ersetze `makeSettings`:

```typescript
const makeSettings = (): Settings => ({
  version: '1.5.0',
  activeHostId: 'h1',
  hosts: [{ id: 'h1', name: 'H1', host: '127.0.0.1', satellite: { wsPort: 16623 } }],
  panels: [{
    id: 'panel-1',
    name: 'Test',
    zoom: 1,
    defaultMode: 'view',
    grid: { enabled: true, size: 40, snap: true },
    elements: [
      { id: 'e1', type: 'label', x: 10, y: 20, w: 100, h: 50, z: 0, text: 'Hello', style: { color: '#ff0000', fontSize: 14 } },
      { id: 'e2', type: 'shape', x: 200, y: 100, w: 80, h: 80, z: 1, style: { fill: '#ff0000', stroke: '#000', strokeWidth: 1, borderRadius: 4 } },
      { id: 'e3', type: 'companionButton', x: 0, y: 0, w: 72, h: 72, z: 2,
        ref: { hostId: 'h1', page: 1, row: 0, col: 0 },
        render: { showBgColor: true, showText: true, textAlign: 'center', borderRadius: 6 } },
    ],
  }],
})
```

Dann füge den Test-Block am Ende hinzu:
```typescript
describe('copyElementStyle / pasteElementStyle', () => {
  it('copiedStyle ist initial null', () => {
    expect(useAppStore.getState().copiedStyle).toBeNull()
  })

  it('copyElementStyle speichert style + w + h von label', () => {
    useAppStore.getState().copyElementStyle('panel-1', 'e1')
    const copied = useAppStore.getState().copiedStyle
    expect(copied).not.toBeNull()
    expect(copied!.type).toBe('label')
    expect(copied!.w).toBe(100)
    expect(copied!.h).toBe(50)
    expect((copied!.payload as any).color).toBe('#ff0000')
    expect((copied!.payload as any).fontSize).toBe(14)
  })

  it('pasteElementStyle überträgt style + w + h auf gleichen Typ', () => {
    useAppStore.getState().copyElementStyle('panel-1', 'e1')
    // Zweites label hinzufügen als Ziel
    useAppStore.getState().addElement('panel-1', {
      id: 'e4', type: 'label', x: 300, y: 300, w: 50, h: 30, z: 3,
      text: 'Other', style: { color: '#00ff00', fontSize: 10 },
    })
    useAppStore.getState().pasteElementStyle('panel-1', ['e4'])
    const el = useAppStore.getState().settings!.panels[0].elements.find(e => e.id === 'e4')! as any
    expect(el.style.color).toBe('#ff0000')
    expect(el.style.fontSize).toBe(14)
    expect(el.w).toBe(100)
    expect(el.h).toBe(50)
  })

  it('pasteElementStyle ignoriert Elemente anderen Typs', () => {
    useAppStore.getState().copyElementStyle('panel-1', 'e1') // label
    useAppStore.getState().pasteElementStyle('panel-1', ['e2']) // shape — anderer Typ
    const el = useAppStore.getState().settings!.panels[0].elements.find(e => e.id === 'e2')! as any
    expect(el.style.fill).toBe('#ff0000') // unverändert
    expect(el.w).toBe(80) // unverändert
  })

  it('pasteElementStyle kopiert render für companionButton', () => {
    useAppStore.getState().copyElementStyle('panel-1', 'e3')
    // Zweiten companionButton hinzufügen
    useAppStore.getState().addElement('panel-1', {
      id: 'e5', type: 'companionButton', x: 100, y: 100, w: 120, h: 120, z: 4,
      ref: { hostId: 'h1', page: 1, row: 0, col: 1 },
      render: { showBgColor: false, textAlign: 'bottom' },
    })
    useAppStore.getState().pasteElementStyle('panel-1', ['e5'])
    const el = useAppStore.getState().settings!.panels[0].elements.find(e => e.id === 'e5')! as any
    expect(el.render.showBgColor).toBe(true)
    expect(el.render.textAlign).toBe('center')
    expect(el.w).toBe(72)
    expect(el.h).toBe(72)
    // ref darf NICHT überschrieben worden sein
    expect(el.ref.col).toBe(1)
  })
})
```

- [ ] **Step 2: Tests ausführen — müssen rot sein**

```bash
npm test -w @cwp/frontend -- --reporter=verbose 2>&1 | tail -20
```
Erwartet: Fehler "copyElementStyle is not a function" oder ähnlich

- [ ] **Step 3: AppStore-Interface erweitern**

In `packages/frontend/src/store/useAppStore.ts`, füge nach dem `deleteElements`-Eintrag (ca. Zeile 99) im Interface hinzu:
```typescript
  // ─── Style Copy/Paste ─────────────────────────────────────────────────────
  copiedStyle: {
    type: AnyElement['type']
    w: number
    h: number
    /** style (shape/label/channelStrip) oder render (companionButton/virtualCompanionDeck) */
    payload: Record<string, unknown>
  } | null
  copyElementStyle: (panelId: string, elementId: string) => void
  pasteElementStyle: (panelId: string, targetIds: string[]) => void
```

- [ ] **Step 4: Implementierung in der Store-Factory hinzufügen**

In `useAppStore = create<AppStore>((set, get) => ({`, füge nach dem `addElement`-Block (nach Zeile ~515) ein:
```typescript
  // ─── Style Copy/Paste ─────────────────────────────────────────────────────
  copiedStyle: null,

  copyElementStyle: (panelId, elementId) => {
    const panel = get().settings?.panels.find((p) => p.id === panelId)
    const el = panel?.elements.find((e) => e.id === elementId)
    if (!el) return
    let payload: Record<string, unknown> = {}
    if (el.type === 'companionButton' || el.type === 'virtualCompanionDeck') {
      payload = { ...(el as any).render } ?? {}
    } else {
      payload = { ...(el as any).style } ?? {}
    }
    set({ copiedStyle: { type: el.type, w: el.w, h: el.h, payload } })
  },

  pasteElementStyle: (panelId, targetIds) => {
    const { copiedStyle, settings } = get()
    if (!copiedStyle || !settings) return
    const panel = settings.panels.find((p) => p.id === panelId)
    if (!panel) return
    const updates: Record<string, Partial<AnyElement>> = {}
    for (const id of targetIds) {
      const el = panel.elements.find((e) => e.id === id)
      if (!el || el.type !== copiedStyle.type) continue
      const patch: Record<string, unknown> = { w: copiedStyle.w, h: copiedStyle.h }
      if (el.type === 'companionButton' || el.type === 'virtualCompanionDeck') {
        patch.render = { ...(el as any).render, ...copiedStyle.payload }
      } else {
        patch.style = { ...(el as any).style, ...copiedStyle.payload }
      }
      updates[id] = patch as Partial<AnyElement>
    }
    set((s) => {
      if (!s.settings) return s
      return {
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p) =>
            p.id !== panelId ? p : {
              ...p,
              elements: p.elements.map((el) =>
                updates[el.id] ? { ...el, ...updates[el.id] } as AnyElement : el,
              ),
            },
          ),
        },
      }
    })
  },
```

- [ ] **Step 5: Tests grün machen**

```bash
npm test -w @cwp/frontend -- --reporter=verbose 2>&1 | tail -30
```
Erwartet: alle Tests grün

- [ ] **Step 6: TypeScript-Check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```
Erwartet: keine Fehler

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/src/store/useAppStore.ts
git add packages/frontend/src/store/useAppStore.test.ts
git commit -m "feat(store): add copiedStyle, copyElementStyle, pasteElementStyle"
```

---

## Task 6: PropertiesPanel — Copy/Paste Buttons

**Files:**
- Modify: `packages/frontend/src/components/PropertiesPanel/PropertiesPanel.tsx`

Die Buttons werden im Panel-Header rechts von den bestehenden "⇄" und "‹" Buttons eingefügt. "Style kopieren" nur bei Einzelauswahl sichtbar. "Style einfügen" sichtbar wenn `copiedStyle !== null` und ≥1 Element selektiert und Typ matcht.

- [ ] **Step 1: Store-Selektoren hinzufügen**

In `PropertiesPanel.tsx`, füge nach den bestehenden `useAppStore`-Aufrufen (ca. Zeile 37–39) hinzu:
```typescript
  const copiedStyle = useAppStore((s) => s.copiedStyle)
  const copyElementStyle = useAppStore((s) => s.copyElementStyle)
  const pasteElementStyle = useAppStore((s) => s.pasteElementStyle)
```

- [ ] **Step 2: canPaste-Logik ableiten**

Nach `const canDelete = ...` (ca. Zeile 205), füge ein:
```typescript
  const canCopy = singleEl !== null
  const canPaste = copiedStyle !== null
    && selectedElements.length > 0
    && selectedElements.some((el) => el.type === copiedStyle.type)
```

- [ ] **Step 3: Buttons in den Header einfügen**

Im Header-Bereich, `<div style={{ display: 'flex', gap: 4 }}>` enthält aktuell zwei Buttons (⇄ und ‹). Füge davor ein:
```tsx
          {canCopy && (
            <button
              style={collapseBtn}
              title="Style kopieren (Ctrl+Shift+C)"
              onClick={() => singleEl && copyElementStyle(panel!.id, singleEl.id)}
            >
              ⎘
            </button>
          )}
          {canPaste && (
            <button
              style={{ ...collapseBtn, color: '#4a9eff' }}
              title="Style einfügen (Ctrl+Shift+V)"
              onClick={() => pasteElementStyle(panel!.id, [...selectedIds])}
            >
              ⎗
            </button>
          )}
```

- [ ] **Step 4: TypeScript-Check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```
Erwartet: keine Fehler

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/components/PropertiesPanel/PropertiesPanel.tsx
git commit -m "feat(propertiesPanel): add copy/paste style buttons"
```

---

## Task 7: App.tsx — Ctrl+Shift+C / Ctrl+Shift+V

**Files:**
- Modify: `packages/frontend/src/App.tsx`

- [ ] **Step 1: Shortcuts im bestehenden Ctrl-Handler ergänzen**

In `App.tsx`, im `if (e.ctrlKey)` Block (ca. Zeile 49–74), füge nach dem `case 'd':` Block ein:
```typescript
          case 'c': {
            if (!e.shiftKey) break
            e.preventDefault()
            if (inEdit) {
              const panel = store.getActivePanel()
              if (panel && store.selectedIds.size === 1) {
                store.copyElementStyle(panel.id, [...store.selectedIds][0])
              }
            }
            return
          }
          case 'v': {
            if (!e.shiftKey) break
            e.preventDefault()
            if (inEdit) {
              const panel = store.getActivePanel()
              if (panel && store.copiedStyle) {
                store.pasteElementStyle(panel.id, [...store.selectedIds])
              }
            }
            return
          }
```

- [ ] **Step 2: TypeScript-Check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```
Erwartet: keine Fehler

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/App.tsx
git commit -m "feat(shortcuts): Ctrl+Shift+C/V for element style copy/paste"
```

---

## Task 8: Default-Größe CompanionButton 72×72

**Files:**
- Modify: `packages/frontend/src/components/AddElement/AddElementMenu.tsx`

- [ ] **Step 1: makeDefault und compactLayout anpassen**

In `AddElementMenu.tsx`, ersetze in `makeDefault` (ca. Zeile 48):
```typescript
  return { id, type: 'companionButton', x, y, w: 120, h: 120, z: 0,
```
mit:
```typescript
  return { id, type: 'companionButton', x, y, w: 72, h: 72, z: 0,
```

In `handlePickerConfirm` (ca. Zeile 92), ersetze:
```typescript
    const positions = compactLayout(
      refs.map((r) => ({ row: r.row, col: r.col })),
      canvasPos,
      120,
    )
```
mit:
```typescript
    const positions = compactLayout(
      refs.map((r) => ({ row: r.row, col: r.col })),
      canvasPos,
      72,
    )
```

- [ ] **Step 2: TypeScript-Check**

```bash
npx tsc --noEmit -p packages/frontend/tsconfig.json
```
Erwartet: keine Fehler

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/AddElement/AddElementMenu.tsx
git commit -m "feat(addElement): default companionButton size 72×72"
```

---

## Abschluss

- [ ] **Finaler Test-Run**

```bash
npm test -w @cwp/frontend
```
Erwartet: alle Tests grün

- [ ] **Electron bauen und testen**

```bash
npm run electron:dev
```
Prüfen:
1. Neuer CompanionButton hat 72×72
2. Picker zeigt Page-Dropdown statt NumericInput; Pages werden gespeichert
3. Host-Settings: maxPages + Page-Namen-Editor vorhanden
4. ChannelStrip mit eingetragenem Override-Name zeigt diesen statt Companion-Name
5. Style kopieren/einfügen via Buttons und Ctrl+Shift+C/V funktioniert (Label→Label, gleicher Typ)

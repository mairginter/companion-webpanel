# UI Features Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 UI features: HostManagerModal Edit-Modal, caps-disabled hint, Multi-Button Editing, Copy-to-Panel, Panel Duplicate.

**Architecture:** Store actions first (TDD), then UI components that consume them. All state lives in `useAppStore`. No new backend changes needed — purely frontend.

**Tech Stack:** React + TypeScript, Zustand (`useAppStore`), Vitest for store tests, Material Icons (already bundled), inline CSS-in-JS (project convention).

**Spec:** `docs/superpowers/specs/2026-04-24-ui-features-batch.md`

---

## File Map

| Action | File |
|---|---|
| Modify | `packages/frontend/src/store/useAppStore.ts` |
| Modify | `packages/frontend/src/store/useAppStore.test.ts` |
| Modify | `packages/frontend/src/components/Toolbar/Toolbar.tsx` |
| Modify | `packages/frontend/src/components/HostManager/HostManagerModal.tsx` |
| Modify | `packages/frontend/src/components/PropertiesPanel/PropertiesPanel.tsx` |
| Create | `packages/frontend/src/components/PropertiesPanel/CompanionButtonMultiProps.tsx` |

---

## Task 1: Store — `duplicatePanel` + `copyElementsToPanel`

**Files:**
- Modify: `packages/frontend/src/store/useAppStore.ts`
- Modify: `packages/frontend/src/store/useAppStore.test.ts`

### Step 1.1: Add interface declarations to `AppStore`

In `useAppStore.ts`, inside the `AppStore` interface (after `deletePanel`), add two new method signatures:

```typescript
  /** Dupliziert ein Panel mit allen Elementen (neue IDs), wechselt dazu. */
  duplicatePanel: (panelId: string) => Panel
  /** Kopiert Elemente aus sourcePanelId nach targetPanelId mit +75px Offset und neuen IDs. */
  copyElementsToPanel: (sourcePanelId: string, targetPanelId: string, elementIds: string[]) => void
```

- [ ] Add both method signatures to the `AppStore` interface (around line 74, after `setZoom`).

### Step 1.2: Write failing tests

Open `packages/frontend/src/store/useAppStore.test.ts`. At the end of the file, append:

```typescript
describe('duplicatePanel', () => {
  it('erstellt eine Kopie mit neuem Namen und neuen Element-IDs', () => {
    const store = useAppStore.getState()
    const original = store.settings!.panels[0]
    const copy = store.duplicatePanel(original.id)

    const panels = useAppStore.getState().settings!.panels
    expect(panels).toHaveLength(2)
    expect(copy.name).toBe(`${original.name} Copy`)
    expect(copy.id).not.toBe(original.id)
    expect(copy.elements).toHaveLength(original.elements.length)
    copy.elements.forEach((el, i) => {
      expect(el.id).not.toBe(original.elements[i].id)
    })
  })

  it('wechselt zum neuen Panel', () => {
    const store = useAppStore.getState()
    const original = store.settings!.panels[0]
    store.duplicatePanel(original.id)
    expect(useAppStore.getState().activePanelId).not.toBe(original.id)
  })
})

describe('copyElementsToPanel', () => {
  beforeEach(() => {
    // Zweites Panel anlegen
    useAppStore.getState().createPanel('Target')
  })

  it('kopiert Elemente mit +75px Offset und neuen IDs ins Ziel-Panel', () => {
    const state = useAppStore.getState()
    const sourcePanel = state.settings!.panels[0]
    const targetPanel = state.settings!.panels[1]
    const sourceEl = sourcePanel.elements[0]

    state.copyElementsToPanel(sourcePanel.id, targetPanel.id, [sourceEl.id])

    const updated = useAppStore.getState().settings!
    const targetEls = updated.panels.find(p => p.id === targetPanel.id)!.elements
    expect(targetEls).toHaveLength(1)
    expect(targetEls[0].id).not.toBe(sourceEl.id)
    expect(targetEls[0].x).toBe(sourceEl.x + 75)
    expect(targetEls[0].y).toBe(sourceEl.y + 75)
  })

  it('lässt das Quell-Panel unverändert', () => {
    const state = useAppStore.getState()
    const sourcePanel = state.settings!.panels[0]
    const targetPanel = state.settings!.panels[1]
    const originalCount = sourcePanel.elements.length

    state.copyElementsToPanel(sourcePanel.id, targetPanel.id, [sourcePanel.elements[0].id])

    const after = useAppStore.getState().settings!.panels.find(p => p.id === sourcePanel.id)!
    expect(after.elements).toHaveLength(originalCount)
  })

  it('wechselt nicht das aktive Panel', () => {
    const state = useAppStore.getState()
    const panels = state.settings!.panels
    const activeBefore = useAppStore.getState().activePanelId
    state.copyElementsToPanel(panels[0].id, panels[1].id, [panels[0].elements[0].id])
    expect(useAppStore.getState().activePanelId).toBe(activeBefore)
  })
})
```

- [ ] Append the test block above to `useAppStore.test.ts`.

### Step 1.3: Run tests — verify they fail

```bash
cd packages/frontend && npx vitest run src/store/useAppStore.test.ts
```

Expected: FAIL — `store.duplicatePanel is not a function` and `store.copyElementsToPanel is not a function`.

- [ ] Run tests, confirm FAIL.

### Step 1.4: Implement `duplicatePanel` in the store

In `useAppStore.ts`, inside the `create<AppStore>((set, get) => ({ ... }))` block, after `deletePanel`, add:

```typescript
  duplicatePanel: (panelId) => {
    const { settings } = get()
    if (!settings) return null as unknown as Panel
    const source = settings.panels.find((p) => p.id === panelId)
    if (!source) return null as unknown as Panel
    const newPanel: Panel = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} Copy`,
      elements: source.elements.map((el) => ({ ...el, id: crypto.randomUUID() })),
    }
    set((s) => ({
      settings: { ...s.settings!, panels: [...s.settings!.panels, newPanel] },
      activePanelId: newPanel.id,
    }))
    return newPanel
  },

  copyElementsToPanel: (sourcePanelId, targetPanelId, elementIds) => {
    const { settings } = get()
    if (!settings) return
    const sourcePanel = settings.panels.find((p) => p.id === sourcePanelId)
    if (!sourcePanel) return
    const copies = sourcePanel.elements
      .filter((el) => elementIds.includes(el.id))
      .map((el) => ({ ...el, id: crypto.randomUUID(), x: el.x + 75, y: el.y + 75 }))
    set((s) => ({
      settings: {
        ...s.settings!,
        panels: s.settings!.panels.map((p) =>
          p.id !== targetPanelId ? p : { ...p, elements: [...p.elements, ...copies] },
        ),
      },
    }))
  },
```

- [ ] Add both implementations to `useAppStore.ts`.

### Step 1.5: Run tests — verify they pass

```bash
cd packages/frontend && npx vitest run src/store/useAppStore.test.ts
```

Expected: all tests PASS.

- [ ] Run tests, confirm PASS.

### Step 1.6: Commit

```bash
git add packages/frontend/src/store/useAppStore.ts packages/frontend/src/store/useAppStore.test.ts
git commit -m "feat(store): add duplicatePanel and copyElementsToPanel actions"
```

- [ ] Commit.

---

## Task 2: Panel-Dropdown — Duplicate Icon ⧉

**Files:**
- Modify: `packages/frontend/src/components/Toolbar/Toolbar.tsx`

The panel dropdown (around line 170–238) renders per-panel rows with ✎ Rename and ✕ Delete icons. Add a ⧉ Duplicate icon between them.

### Step 2.1: Add `duplicatePanel` to store selectors in `Toolbar`

In `Toolbar.tsx`, after the line `const deletePanel = useAppStore((s) => s.deletePanel)` (around line 82), add:

```typescript
  const duplicatePanel = useAppStore((s) => s.duplicatePanel)
```

- [ ] Add the selector.

### Step 2.2: Add ⧉ button in the panel row

In the icon group (around line 218–238), the current code is:
```tsx
<div style={{ display: 'flex', gap: 2, paddingRight: 6, flexShrink: 0 }}>
  <button
    title={t('toolbar.rename')}
    onClick={(e) => { e.stopPropagation(); setRenameValue(panel.name); setRenamingId(panel.id) }}
    style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 13, padding: '2px 4px', borderRadius: 3 }}
  >
    ✎
  </button>
  <button
    title={panels.length <= 1 ? t('toolbar.cannotDeleteLast') : t('toolbar.deletePanel')}
    ...
  >
    ✕
  </button>
</div>
```

Replace that `<div>` with:

```tsx
<div style={{ display: 'flex', gap: 2, paddingRight: 6, flexShrink: 0 }}>
  <button
    title={t('toolbar.rename')}
    onClick={(e) => { e.stopPropagation(); setRenameValue(panel.name); setRenamingId(panel.id) }}
    style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 13, padding: '2px 4px', borderRadius: 3 }}
  >
    ✎
  </button>
  <button
    title={t('toolbar.duplicatePanel')}
    onClick={(e) => { e.stopPropagation(); duplicatePanel(panel.id); onSave?.(); setDropdownOpen(false) }}
    style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 13, padding: '2px 4px', borderRadius: 3 }}
  >
    ⧉
  </button>
  <button
    title={panels.length <= 1 ? t('toolbar.cannotDeleteLast') : t('toolbar.deletePanel')}
    onClick={(e) => {
      e.stopPropagation()
      if (deletePanel(panel.id)) onSave?.()
    }}
    disabled={panels.length <= 1}
    style={{ background: 'none', border: 'none', color: panels.length <= 1 ? '#2a3344' : '#ff5a5f', cursor: panels.length <= 1 ? 'default' : 'pointer', fontSize: 13, padding: '2px 4px', borderRadius: 3 }}
  >
    ✕
  </button>
</div>
```

- [ ] Replace the icon group in `Toolbar.tsx`.

### Step 2.3: Add i18n key

Open `packages/frontend/src/i18n/` — find the German and English locale files (likely `de.json` and `en.json` or inside a `locales/` folder). Add to the `toolbar` section:

```json
"duplicatePanel": "Panel duplizieren"
```

- [ ] Add i18n key for `toolbar.duplicatePanel` in all locale files.

### Step 2.4: Manual test

Run `npm run dev`, open Companion Webpanel, switch to Edit-Mode, open the panel dropdown. Verify ⧉ icon appears between ✎ and ✕. Click it — a new panel `"<Name> Copy"` should appear and become active.

- [ ] Manual test: duplicate icon visible, click creates copy with elements.

### Step 2.5: Commit

```bash
git add packages/frontend/src/components/Toolbar/Toolbar.tsx packages/frontend/src/i18n/
git commit -m "feat(toolbar): add panel duplicate button ⧉ in panel dropdown"
```

- [ ] Commit.

---

## Task 3: Copy-to-Panel Toolbar Button

**Files:**
- Modify: `packages/frontend/src/components/Toolbar/Toolbar.tsx`

### Step 3.1: Add store selectors

In `Toolbar.tsx`, after the `duplicatePanel` selector, add:

```typescript
  const copyElementsToPanel = useAppStore((s) => s.copyElementsToPanel)
  const selectedIds = useAppStore((s) => s.selectedIds)
```

- [ ] Add selectors.

### Step 3.2: Add local state for copy dropdown

After the existing `const [addMenuOpen, setAddMenuOpen] = useState(false)` (around line 99), add:

```typescript
  const [copyMenuOpen, setCopyMenuOpen] = useState(false)
  const copyBtnRef = useRef<HTMLButtonElement>(null)
```

- [ ] Add state and ref.

### Step 3.3: Add copy dropdown close-on-outside-click

After the existing `useEffect` for `dropdownOpen` (around line 122), add:

```typescript
  useEffect(() => {
    if (!copyMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (copyBtnRef.current && !copyBtnRef.current.closest('[data-copy-dropdown]') &&
          !(e.target as Node).closest?.('[data-copy-dropdown]')) {
        setCopyMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [copyMenuOpen])
```

- [ ] Add useEffect.

### Step 3.4: Add Copy-to-Panel button in JSX

In the Toolbar JSX, find the Edit-mode section that renders the `+` Add button (around line 351–366):

```tsx
{mode === 'edit' && (
  <>
    <div style={dividerStyle} />
    <button ref={addBtnRef} ... >+</button>
  </>
)}
```

Extend it to also render the copy button when elements are selected:

```tsx
{mode === 'edit' && (
  <>
    <div style={dividerStyle} />
    <button
      ref={addBtnRef}
      style={{
        ...modeButtonStyle(addMenuOpen),
        width: 32, padding: 0, textAlign: 'center', fontSize: 18,
      }}
      onClick={handleAddClick}
      title={t('toolbar.addElement')}
    >
      +
    </button>

    {selectedIds.size > 0 && (
      <div style={{ position: 'relative' }} data-copy-dropdown>
        <button
          ref={copyBtnRef}
          style={{
            ...modeButtonStyle(copyMenuOpen),
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '0 10px', height: 32, fontSize: 13,
          }}
          onClick={() => setCopyMenuOpen((o) => !o)}
          title={t('toolbar.copyToPanel')}
        >
          <span className="material-icons" style={{ fontSize: 16 }}>content_copy</span>
          <span style={{ fontSize: 10, color: '#4a5568' }}>{copyMenuOpen ? '▲' : '▼'}</span>
        </button>

        {copyMenuOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: '#1a2030', border: '1px solid #2a3344', borderRadius: 6,
            minWidth: 180, zIndex: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}>
            {panels.filter((p) => p.id !== activePanelId).length === 0 ? (
              <div style={{ padding: '10px 14px', color: '#4a5568', fontSize: 13 }}>
                {t('toolbar.noOtherPanels')}
              </div>
            ) : (
              panels
                .filter((p) => p.id !== activePanelId)
                .map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      copyElementsToPanel(activePanelId!, p.id, [...selectedIds])
                      onSave?.()
                      setCopyMenuOpen(false)
                    }}
                    style={{
                      padding: '9px 14px', fontSize: 13, color: '#e9edf2',
                      cursor: 'pointer', borderBottom: '1px solid #1a2030',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(74,158,255,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {p.name}
                  </div>
                ))
            )}
          </div>
        )}
      </div>
    )}
  </>
)}
```

- [ ] Replace the Edit-mode section with the extended version above.

### Step 3.5: Add i18n keys

Add to all locale files:

```json
"copyToPanel": "In Panel kopieren",
"noOtherPanels": "Kein anderes Panel vorhanden"
```

- [ ] Add i18n keys.

### Step 3.6: Manual test

Run `npm run dev`, switch to Edit-Mode. Select one or more elements. Verify the copy button appears in the toolbar. Click → see panel list. Select a target panel. Switch to that panel — elements should be there with +75px offset.

- [ ] Manual test: copy button appears, elements appear in target panel.

### Step 3.7: Commit

```bash
git add packages/frontend/src/components/Toolbar/Toolbar.tsx packages/frontend/src/i18n/
git commit -m "feat(toolbar): add copy-to-panel button for selected elements"
```

- [ ] Commit.

---

## Task 4: HostManagerModal — caps-disabled Info-Box

**Files:**
- Modify: `packages/frontend/src/components/HostManager/HostManagerModal.tsx`

### Step 4.1: Add info-box after `caps-disabled` host card

In `HostManagerModal.tsx`, find the host card render loop (around line 473). Each card ends with the optional inline-edit form. After the closing `</div>` of the host card div (after the `{isEditing && ...}` block, around line 566), add a conditional info-box:

Find this closing sequence:
```tsx
                  {/* Inline-Edit-Form */}
                  {isEditing && (
                    <div style={{ padding: '0 14px 14px', borderTop: '1px solid #2a3344', paddingTop: 14 }}>
                      ...
                    </div>
                  )}
                </div>
```

After `</div>` (closing the host card div), add:

```tsx
                {status === 'caps-disabled' && (
                  <div style={{
                    marginTop: 4,
                    background: 'rgba(255,138,61,0.08)',
                    border: '1px solid #ff8a3d',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: '#ff8a3d',
                    lineHeight: 1.5,
                  }}>
                    <strong>Button Subscriptions API nicht aktiv.</strong>
                    {' '}Aktivieren unter:{' '}
                    <strong>Companion → Settings → Protocols → „Button Subscriptions API"</strong>
                  </div>
                )}
```

- [ ] Add the info-box after each host card.

### Step 4.2: Manual test

Set a host to `caps-disabled` status (or temporarily hardcode `status === 'caps-disabled'` in the condition to test visually). Open HostManager → info-box with orange border appears below the host card.

- [ ] Manual test: info-box visible for caps-disabled hosts.

### Step 4.3: Commit

```bash
git add packages/frontend/src/components/HostManager/HostManagerModal.tsx
git commit -m "feat(host-manager): show caps-disabled hint with Companion settings path"
```

- [ ] Commit.

---

## Task 5: HostManagerModal — Eigenes Edit-Modal

**Files:**
- Modify: `packages/frontend/src/components/HostManager/HostManagerModal.tsx`

### Step 5.1: Add `HostEditModal` component

In `HostManagerModal.tsx`, after the `HostForm` function definition (around line 160), add a new inner component `HostEditModal`:

```tsx
interface HostEditModalProps {
  host: HostProfile | null        // null = neuer Host
  onSave: (host: HostProfile) => void
  onCancel: () => void
}

function HostEditModal({ host, onSave, onCancel }: HostEditModalProps) {
  const { t } = useTranslation()
  const [formValue, setFormValue] = useState<Omit<HostProfile, 'id'>>(
    host
      ? { name: host.name, host: host.host, satellite: host.satellite, notes: host.notes ?? '',
          autoConnect: host.autoConnect, showInToolbar: host.showInToolbar,
          gridCols: host.gridCols, gridRows: host.gridRows, maxPages: host.maxPages, pageNames: host.pageNames }
      : emptyHost()
  )

  const isNew = host === null
  const canSave = formValue.name.trim() !== '' && formValue.host.trim() !== ''

  function handleSave() {
    if (!canSave) return
    onSave({ id: host?.id ?? crypto.randomUUID(), ...formValue })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}>
      <div style={{
        background: '#1a2030', border: '1px solid #2a3344', borderRadius: 12,
        width: 560, maxWidth: '90vw', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #2a3344', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#e9edf2' }}>
            {isNew ? t('hostManager.addHost') : t('hostManager.editHost')}
          </span>
          <button style={{ background: 'none', border: 'none', color: '#8896aa', fontSize: 18, cursor: 'pointer', lineHeight: 1 }} onClick={onCancel}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <HostForm value={formValue} onChange={setFormValue} />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #2a3344', flexShrink: 0 }}>
          <button style={btnSecondary} onClick={onCancel}>{t('hostManager.cancel')}</button>
          <button
            style={{ ...btnPrimary, opacity: canSave ? 1 : 0.5 }}
            disabled={!canSave}
            onClick={handleSave}
          >
            {isNew ? t('hostManager.addHost') : t('hostManager.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] Add `HostEditModal` component after `HostForm`.

### Step 5.2: Replace state in `HostManagerModal`

In `HostManagerModal` (the main component function), replace the existing editing state:

**Remove:**
```typescript
  const [editing, setEditing] = useState<string | null>(null)
  const [formValue, setFormValue] = useState<Omit<HostProfile, 'id'>>(emptyHost())
```

**Add:**
```typescript
  const [editTarget, setEditTarget] = useState<HostProfile | null | 'new'>(null)
```

- [ ] Replace state declaration.

### Step 5.3: Replace edit helper functions

**Remove** `startAdd`, `startEdit`, `cancelEdit`, `saveEdit` functions. **Add:**

```typescript
  function openAdd() { setEditTarget('new') }
  function openEdit(host: HostProfile) { setEditTarget(host) }

  function handleEditSave(savedHost: HostProfile) {
    let next: Settings
    if (editTarget === 'new') {
      next = { ...s, hosts: [...s.hosts, savedHost] }
    } else {
      next = { ...s, hosts: s.hosts.map((h) => h.id === savedHost.id ? savedHost : h) }
    }
    saveSettings(next)
    setEditTarget(null)
  }
```

- [ ] Replace the helper functions.

### Step 5.4: Remove inline edit form from host card + update button

In the host card JSX:

**Remove** `isEditing` references and the entire `{isEditing && <div>...<HostForm.../></div>}` block.

**Change** the Edit button (inside the action buttons area) from:
```tsx
<button style={{ ...btnSecondary, padding: '5px 12px' }} onClick={() => startEdit(host)}>{t('hostManager.edit')}</button>
```
to:
```tsx
<button style={{ ...btnSecondary, padding: '5px 12px' }} onClick={() => openEdit(host)}>{t('hostManager.edit')}</button>
```

Also update the card's border (it currently changes color when `isEditing`):
```tsx
border: `1px solid ${isEditing ? '#4a9eff' : '#2a3344'}`,
```
→ remove the `isEditing` reference:
```tsx
border: '1px solid #2a3344',
```

- [ ] Remove inline form, update Edit button, fix card border.

### Step 5.5: Update Footer button

Replace:
```tsx
<button style={{ ...btnPrimary, marginRight: 'auto' }} onClick={startAdd} disabled={editing !== null}>
  + {t('hostManager.addHost')}
</button>
```
with:
```tsx
<button style={{ ...btnPrimary, marginRight: 'auto' }} onClick={openAdd}>
  + {t('hostManager.addHost')}
</button>
```

- [ ] Update footer button.

### Step 5.6: Render `HostEditModal`

At the end of the main `return (...)` in `HostManagerModal`, after the `{deleteTarget && <DeleteDialog .../>}` block and before the closing `</>`, add:

```tsx
      {editTarget !== null && (
        <HostEditModal
          host={editTarget === 'new' ? null : editTarget}
          onSave={handleEditSave}
          onCancel={() => setEditTarget(null)}
        />
      )}
```

- [ ] Add `HostEditModal` render.

### Step 5.7: Add i18n key

Add to all locale files in the `hostManager` section:

```json
"editHost": "Host bearbeiten"
```

- [ ] Add `hostManager.editHost` i18n key.

### Step 5.8: Manual test

Run `npm run dev`. Open HostManager:
- Click "+ Host hinzufügen" → second modal opens with empty form, Save/Cancel in footer
- Click "Bearbeiten" on existing host → second modal opens pre-filled, all fields visible including Page-Names accordion (no clipping)
- Save → modal closes, host updated
- Cancel → modal closes, no change

- [ ] Manual test: both add and edit flows work, Page-Names accessible.

### Step 5.9: Commit

```bash
git add packages/frontend/src/components/HostManager/HostManagerModal.tsx packages/frontend/src/i18n/
git commit -m "feat(host-manager): replace inline edit with dedicated HostEditModal"
```

- [ ] Commit.

---

## Task 6: CompanionButtonMultiProps

**Files:**
- Create: `packages/frontend/src/components/PropertiesPanel/CompanionButtonMultiProps.tsx`
- Modify: `packages/frontend/src/components/PropertiesPanel/PropertiesPanel.tsx`

### Step 6.1: Create `CompanionButtonMultiProps.tsx`

Create `packages/frontend/src/components/PropertiesPanel/CompanionButtonMultiProps.tsx` with:

```tsx
import React, { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CompanionButtonElement } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'

interface Props {
  elements: CompanionButtonElement[]
  panelId: string
}

// Returns the common value if all elements share it, or null if mixed.
function common<T>(elements: CompanionButtonElement[], getter: (el: CompanionButtonElement) => T): T | null {
  const vals = elements.map(getter)
  return vals.every((v) => v === vals[0]) ? vals[0] : null
}

// Checkbox that supports indeterminate (mixed) state.
function MixedCheckbox({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = value === null
  }, [value])
  return (
    <input
      type="checkbox"
      ref={ref}
      checked={value === true}
      onChange={(e) => onChange(e.target.checked)}
      style={{ width: 20, height: 20, cursor: 'pointer' }}
    />
  )
}

export function CompanionButtonMultiProps({ elements, panelId }: Props) {
  const { t } = useTranslation()
  const setSettings = useAppStore((s) => s.setSettings)
  const settings = useAppStore((s) => s.settings)
  const hosts = settings?.hosts ?? []

  const lbl: React.CSSProperties = { fontSize: 12, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }
  const sel: React.CSSProperties = { background: '#1a2030', border: '1px solid #2a3344', color: '#e9edf2', borderRadius: 4, padding: '8px 10px', fontSize: 14 }

  // Patch render fields on all selected companionButton elements
  const patchRender = (patch: Partial<NonNullable<CompanionButtonElement['render']>>) => {
    if (!settings) return
    const ids = new Set(elements.map((e) => e.id))
    setSettings({
      ...settings,
      panels: settings.panels.map((p) =>
        p.id !== panelId ? p : {
          ...p,
          elements: p.elements.map((el) =>
            el.type !== 'companionButton' || !ids.has(el.id)
              ? el
              : { ...el, render: { ...(el as CompanionButtonElement).render, ...patch } },
          ),
        },
      ),
    })
  }

  // Patch ref.hostId on all selected elements
  const patchHostId = (hostId: string) => {
    if (!settings) return
    const ids = new Set(elements.map((e) => e.id))
    setSettings({
      ...settings,
      panels: settings.panels.map((p) =>
        p.id !== panelId ? p : {
          ...p,
          elements: p.elements.map((el) =>
            el.type !== 'companionButton' || !ids.has(el.id)
              ? el
              : { ...el, ref: { ...(el as CompanionButtonElement).ref, hostId } },
          ),
        },
      ),
    })
  }

  const r = (el: CompanionButtonElement) => el.render ?? {}
  const tog = (v: boolean | undefined, d: boolean) => v === undefined ? d : v

  const commonHostId = common(elements, (el) => el.ref.hostId)
  const commonShowBgColor = common(elements, (el) => tog(r(el).showBgColor, true))
  const commonShowBitmap = common(elements, (el) => tog(r(el).showBitmap, false))
  const commonShowText = common(elements, (el) => tog(r(el).showText, true))
  const commonTextAlign = common(elements, (el) => r(el).textAlign ?? 'center')
  const commonBorderRadius = common(elements, (el) => r(el).borderRadius)
  const commonPhysicalStyle = common(elements, (el) => tog(r(el).physicalStyle, false))
  const commonFontSize = common(elements, (el) => r(el).fontSize)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ ...lbl, marginBottom: 2 }}>
        CompanionButton <span style={{ color: '#4a9eff' }}>×{elements.length}</span>
      </div>

      {/* Host */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.host')}</span>
        <select
          style={{ ...sel, fontSize: 13, padding: '4px 8px' }}
          value={commonHostId ?? ''}
          onChange={(e) => e.target.value && patchHostId(e.target.value)}
        >
          {commonHostId === null && <option value="">—</option>}
          {hosts.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </div>

      {/* showBgColor */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.showBgColor')}</span>
        <MixedCheckbox value={commonShowBgColor} onChange={(v) => patchRender({ showBgColor: v })} />
      </div>

      {/* showBitmap */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.showBitmap')}</span>
        <MixedCheckbox value={commonShowBitmap} onChange={(v) => patchRender({ showBitmap: v })} />
      </div>

      {/* showText */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.showText')}</span>
        <MixedCheckbox value={commonShowText} onChange={(v) => patchRender({ showText: v })} />
      </div>

      {/* textAlign */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.textAlign')}</span>
        <select
          style={{ ...sel, fontSize: 13, padding: '4px 8px' }}
          value={commonTextAlign ?? ''}
          onChange={(e) => e.target.value && patchRender({ textAlign: e.target.value as 'center' | 'top' | 'bottom' })}
        >
          {commonTextAlign === null && <option value="">—</option>}
          <option value="center">{t('propertiesPanel.alignCenter')}</option>
          <option value="top">{t('propertiesPanel.alignTop')}</option>
          <option value="bottom">{t('propertiesPanel.alignBottom')}</option>
        </select>
      </div>

      {/* borderRadius */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.borderRadius')}</span>
        <input
          type="number"
          min={0}
          max={50}
          placeholder="—"
          value={commonBorderRadius ?? ''}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (!isNaN(v)) patchRender({ borderRadius: v })
          }}
          style={{
            width: 70, background: '#1a2030', border: '1px solid #2a3344',
            color: '#e9edf2', borderRadius: 4, padding: '4px 8px',
            fontSize: 13, textAlign: 'right',
          }}
        />
      </div>

      {/* physicalStyle */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.physicalStyle')}</span>
        <MixedCheckbox value={commonPhysicalStyle} onChange={(v) => patchRender({ physicalStyle: v })} />
      </div>

      {/* fontSize */}
      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.fontSize')}</span>
        <input
          type="number"
          min={6}
          max={72}
          placeholder="—"
          value={commonFontSize ?? ''}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (!isNaN(v)) patchRender({ fontSize: v })
          }}
          style={{
            width: 70, background: '#1a2030', border: '1px solid #2a3344',
            color: '#e9edf2', borderRadius: 4, padding: '4px 8px',
            fontSize: 13, textAlign: 'right',
          }}
        />
      </div>
    </div>
  )
}
```

- [ ] Create `CompanionButtonMultiProps.tsx` with the full content above.

### Step 6.2: Integrate into `PropertiesPanel.tsx`

In `PropertiesPanel.tsx`, add the import at the top:

```typescript
import { CompanionButtonMultiProps } from './CompanionButtonMultiProps'
```

Then find the content-determination block (around line 153):

```typescript
  } else if (selectedElements.length >= 1) {
    specificContent = (
      <GeometryBlock elements={selectedElements} panelId={panel!.id} />
    )
    if (singleEl) {
      if (singleEl.type === 'companionButton') {
```

After the GeometryBlock assignment, add a new condition **before** the `if (singleEl)` check:

```typescript
    // Multi-select: alle CompanionButtons → Batch-Edit
    const allCompanionButtons =
      selectedElements.length >= 2 &&
      selectedElements.every((el) => el.type === 'companionButton')

    if (allCompanionButtons) {
      specificContent = (
        <>
          {specificContent}
          <div style={{ borderTop: '1px solid #2a3344', paddingTop: 12 }}>
            <CompanionButtonMultiProps
              elements={selectedElements as any}
              panelId={panel!.id}
            />
          </div>
        </>
      )
    } else if (singleEl) {
```

And close the `else if (singleEl)` block at the end (remove the naked `if (singleEl) {` and replace with `else if (singleEl) {` as shown above).

- [ ] Add import and update `PropertiesPanel.tsx`.

### Step 6.3: Check for required i18n keys

The component uses these keys — check they exist in the locale files, add if missing:

```json
"propertiesPanel.host": "Host",
"propertiesPanel.textAlign": "Text-Ausrichtung",
"propertiesPanel.alignCenter": "Mitte",
"propertiesPanel.alignTop": "Oben",
"propertiesPanel.alignBottom": "Unten",
"propertiesPanel.borderRadius": "Abrundung",
"propertiesPanel.physicalStyle": "Physical Style",
"propertiesPanel.fontSize": "Schriftgröße"
```

- [ ] Check and add missing i18n keys.

### Step 6.4: TypeScript check

```bash
cd packages/frontend && npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] Run TypeScript check, fix any type errors.

### Step 6.5: Manual test

Run `npm run dev`. In Edit-Mode, select 2+ CompanionButton elements (Shift+click or Lasso):
- PropertiesPanel shows "CompanionButton ×N" section
- Fields with mixed values show "—" / empty / indeterminate checkbox
- Fields with same value show that value
- Changing a field updates all selected buttons immediately

- [ ] Manual test: multi-edit UI works as expected.

### Step 6.6: Commit

```bash
git add packages/frontend/src/components/PropertiesPanel/CompanionButtonMultiProps.tsx packages/frontend/src/components/PropertiesPanel/PropertiesPanel.tsx packages/frontend/src/i18n/
git commit -m "feat(properties): add multi-button batch editing for CompanionButton"
```

- [ ] Commit.

---

## Self-Review Checklist (completed inline)

**Spec coverage:**
- ✅ Feature 1 (Edit-Modal): Task 5
- ✅ Feature 2 (caps-disabled hint): Task 4
- ✅ Feature 3 (Multi-Button Editing): Task 6
- ✅ Feature 4 (Copy-to-Panel): Task 3
- ✅ Feature 5 (Panel Duplicate): Tasks 1 + 2

**Placeholders:** None found.

**Type consistency:**
- `duplicatePanel` returns `Panel` — `Panel` is imported from `@cwp/shared` in the store file ✅
- `copyElementsToPanel` uses `string[]` for `elementIds`, spread via `[...selectedIds]` from `Set<string>` ✅
- `CompanionButtonMultiProps` uses `CompanionButtonElement[]` — matches import from `@cwp/shared` ✅
- `editTarget: HostProfile | null | 'new'` — `HostProfile` already imported in the modal file ✅

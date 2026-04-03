# Add Element Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Im Edit-Mode können CompanionButton, Label und Shape-Elemente über einen Toolbar-`+`-Button und per Rechtsklick-Kontextmenü auf dem Canvas hinzugefügt werden.

**Architecture:** Geteiltes `AddElementMenu`-Popup wird von Toolbar und Canvas-Rechtsklick geöffnet. Für CompanionButton öffnet sich ein `CompanionButtonPickerDialog` mit Mini-Grid aus Store-State. Label/Shape werden direkt mit Defaults platziert. Store-Erweiterung: `addElement()` + `addPageAssignment()`.

**Tech Stack:** React + TypeScript, Zustand (useAppStore), Vitest

---

## File-Übersicht

| Datei | Aktion | Verantwortung |
|---|---|---|
| `packages/frontend/src/store/useAppStore.ts` | Modify | `addElement()` + `addPageAssignment()` |
| `packages/frontend/src/store/useAppStore.test.ts` | Modify | Tests für neue Store-Actions |
| `packages/frontend/src/components/AddElement/AddElementMenu.tsx` | Create | Popup mit 3 Einträgen (Button/Label/Shape) |
| `packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx` | Create | Host-Dropdown, Page-Dropdown, Mini-Grid |
| `packages/frontend/src/components/Toolbar/Toolbar.tsx` | Modify | `+`-Button nur im Edit-Mode |
| `packages/frontend/src/components/Canvas/Canvas.tsx` | Modify | `onContextMenu` Handler |

---

### Task 1: Store — `addElement` + `addPageAssignment`

**Files:**
- Modify: `packages/frontend/src/store/useAppStore.ts`
- Modify: `packages/frontend/src/store/useAppStore.test.ts`

- [ ] **Step 1: Test schreiben**

In `useAppStore.test.ts` am Ende anfügen:

```typescript
describe('addElement', () => {
  it('fügt Element ans Ende von panel.elements hinzu', () => {
    const el: import('@cwp/shared').AnyElement = {
      id: 'new-1', type: 'label', x: 10, y: 20, w: 200, h: 40, z: 3, text: 'Neu', style: {},
    }
    useAppStore.getState().addElement('panel-1', el)
    const panel = useAppStore.getState().settings!.panels.find(p => p.id === 'panel-1')!
    expect(panel.elements.at(-1)?.id).toBe('new-1')
  })

  it('setzt selectedIds auf das neue Element', () => {
    const el: import('@cwp/shared').AnyElement = {
      id: 'new-2', type: 'shape', x: 0, y: 0, w: 160, h: 100, z: 2, style: { fill: '#ff0000' },
    }
    useAppStore.getState().addElement('panel-1', el)
    expect(useAppStore.getState().selectedIds.has('new-2')).toBe(true)
    expect(useAppStore.getState().selectedIds.size).toBe(1)
  })
})

describe('addPageAssignment', () => {
  it('legt neues pageAssignment mit Default-SurfaceConfig an', () => {
    useAppStore.getState().addPageAssignment('h1', 99)
    const pa = useAppStore.getState().settings!.wizard?.pageAssignments?.['h1:99']
    expect(pa).toBeDefined()
    expect(pa!.surfaceConfig).toEqual({ keysPerRow: 8, rows: 8 })
    expect(pa!.page).toBe(99)
  })

  it('überschreibt kein bestehendes pageAssignment', () => {
    useAppStore.getState().addPageAssignment('h1', 99)
    useAppStore.getState().addPageAssignment('h1', 99) // zweiter Aufruf
    const pa = useAppStore.getState().settings!.wizard?.pageAssignments?.['h1:99']
    expect(pa!.surfaceConfig.keysPerRow).toBe(8) // unveränderter Default
  })
})
```

- [ ] **Step 2: Test zum Scheitern bringen**

```bash
cd "packages/frontend" && npm run test -- --reporter=verbose 2>&1 | tail -20
```

Erwartet: FAIL — `addElement is not a function`

- [ ] **Step 3: Interface in AppStore ergänzen**

In `useAppStore.ts` das `AppStore`-Interface (Zeilen 14–64) erweitern — nach `deleteElements`:

```typescript
  addElement: (panelId: string, element: AnyElement) => void
  addPageAssignment: (hostId: string, page: number) => void
```

- [ ] **Step 4: Implementierung hinzufügen**

Im `create<AppStore>(...)` Block nach `deleteElements`:

```typescript
  addElement: (panelId, element) =>
    set((s) => {
      if (!s.settings) return s
      const maxZ = s.settings.panels
        .find((p) => p.id === panelId)
        ?.elements.reduce((m, e) => Math.max(m, e.z ?? 0), 0) ?? 0
      const withZ = { ...element, z: maxZ + 1 }
      return {
        selectedIds: new Set([element.id]),
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p) =>
            p.id !== panelId ? p : { ...p, elements: [...p.elements, withZ] },
          ),
        },
      }
    }),

  addPageAssignment: (hostId, page) =>
    set((s) => {
      if (!s.settings) return s
      const key = `${hostId}:${page}`
      const existing = s.settings.wizard?.pageAssignments?.[key]
      if (existing) return s
      return {
        settings: {
          ...s.settings,
          wizard: {
            ...s.settings.wizard,
            pageAssignments: {
              ...s.settings.wizard?.pageAssignments,
              [key]: {
                page,
                instructionShown: false,
                surfaceConfig: { keysPerRow: 8, rows: 8 },
              },
            },
          },
        },
      }
    }),
```

- [ ] **Step 5: Tests ausführen**

```bash
cd "packages/frontend" && npm run test -- --reporter=verbose 2>&1 | tail -20
```

Erwartet: alle Tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/store/useAppStore.ts packages/frontend/src/store/useAppStore.test.ts
git commit -m "feat: addElement + addPageAssignment Store-Actions"
```

---

### Task 2: `AddElementMenu` — Popup mit 3 Einträgen

**Files:**
- Create: `packages/frontend/src/components/AddElement/AddElementMenu.tsx`

- [ ] **Step 1: File anlegen**

```tsx
/**
 * AddElementMenu.tsx
 *
 * Kleines Popup-Menü mit 3 Einträgen (CompanionButton, Label, Shape).
 * Wird von Toolbar-+ und Canvas-Rechtsklick geöffnet.
 * canvasPos = Zielposition auf dem Canvas für die Platzierung (Element wird zentriert).
 */
import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { AnyElement } from '@cwp/shared'
import { CompanionButtonPickerDialog } from './CompanionButtonPickerDialog'

export interface AddElementMenuProps {
  /** Bildschirm-Position des Popups (clientX/clientY oder Button-Anker) */
  screenPos: { x: number; y: number }
  /** Zielposition auf dem Canvas — Element wird hier zentriert platziert */
  canvasPos: { x: number; y: number }
  panelId: string
  onClose: () => void
}

const MENU_ITEMS = [
  { type: 'companionButton', label: 'Companion Button', icon: '⊞' },
  { type: 'label',           label: 'Label',            icon: 'T' },
  { type: 'shape',           label: 'Shape',            icon: '▭' },
] as const

function makeDefault(
  type: 'companionButton' | 'label' | 'shape',
  canvasPos: { x: number; y: number },
  ref?: { hostId: string; page: number; row: number; col: number },
): AnyElement {
  const id = crypto.randomUUID()
  if (type === 'label') {
    const w = 200, h = 40
    return { id, type, x: Math.round(canvasPos.x - w / 2), y: Math.round(canvasPos.y - h / 2), w, h, z: 0, text: 'Label', style: {} }
  }
  if (type === 'shape') {
    const w = 160, h = 100
    return { id, type, x: Math.round(canvasPos.x - w / 2), y: Math.round(canvasPos.y - h / 2), w, h, z: 0,
      style: { fill: '#1a2030', stroke: '#2a3344', strokeWidth: 1, borderRadius: 6 } }
  }
  // companionButton — ref wird vom Picker geliefert
  const w = 120, h = 120
  return { id, type: 'companionButton',
    x: Math.round(canvasPos.x - w / 2), y: Math.round(canvasPos.y - h / 2), w, h, z: 0,
    ref: ref!,
    render: { textAlign: 'center', showText: true, showBgColor: true },
  }
}

export function AddElementMenu({ screenPos, canvasPos, panelId, onClose }: AddElementMenuProps) {
  const addElement = useAppStore((s) => s.addElement)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Schließen bei Klick außerhalb (nur wenn Picker nicht offen)
  useEffect(() => {
    if (pickerOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen, onClose])

  const handleSelect = (type: 'companionButton' | 'label' | 'shape') => {
    if (type === 'companionButton') {
      setPickerOpen(true)
      return
    }
    addElement(panelId, makeDefault(type, canvasPos))
    onClose()
  }

  const handlePickerConfirm = (ref: { hostId: string; page: number; row: number; col: number }) => {
    addElement(panelId, makeDefault('companionButton', canvasPos, ref))
    onClose()
  }

  return (
    <>
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          left: screenPos.x,
          top: screenPos.y,
          background: '#1a2030',
          border: '1px solid #2a3344',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          zIndex: 1000,
          minWidth: 180,
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        <div style={{ padding: '6px 0' }}>
          {MENU_ITEMS.map(({ type, label, icon }) => (
            <div
              key={type}
              onClick={() => handleSelect(type)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 14px',
                fontSize: 13, color: '#e9edf2', cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#243040')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 14, color: '#4a9eff', width: 16, textAlign: 'center' }}>{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </div>

      {pickerOpen && (
        <CompanionButtonPickerDialog
          onConfirm={handlePickerConfirm}
          onClose={() => { setPickerOpen(false); onClose() }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: TypeScript-Build prüfen**

```bash
cd "packages/frontend" && npx tsc --noEmit 2>&1 | head -30
```

Erwartet: Fehler nur wegen fehlendem `CompanionButtonPickerDialog` (noch nicht angelegt) — kein anderer Fehler

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/AddElement/AddElementMenu.tsx
git commit -m "feat: AddElementMenu — Popup mit 3 Einträgen"
```

---

### Task 3: `CompanionButtonPickerDialog`

**Files:**
- Create: `packages/frontend/src/components/AddElement/CompanionButtonPickerDialog.tsx`

- [ ] **Step 1: File anlegen**

```tsx
/**
 * CompanionButtonPickerDialog.tsx
 *
 * Modal-Dialog zur Auswahl eines Companion-Buttons.
 * Zeigt nur verbundene Hosts (sessionStatus === 'connected').
 * Page-Dropdown: konfigurierte Pages + "+" für neue Page.
 * Mini-Grid: bgColor + Text aus Store, Klick → row/col setzen.
 */
import React, { useState, useMemo } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { pageKey } from '@cwp/shared'

interface Props {
  onConfirm: (ref: { hostId: string; page: number; row: number; col: number }) => void
  onClose: () => void
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1100,
}

const DIALOG: React.CSSProperties = {
  background: '#1a2030',
  border: '1px solid #2a3344',
  borderRadius: 12,
  padding: 20,
  width: 440,
  maxWidth: '95vw',
  boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
  color: '#e9edf2',
}

const LABEL_STYLE: React.CSSProperties = { fontSize: 11, color: '#8896aa', marginBottom: 4 }

const SELECT_STYLE: React.CSSProperties = {
  width: '100%', background: '#121821', border: '1px solid #2a3344',
  borderRadius: 6, color: '#e9edf2', fontSize: 13, padding: '6px 8px',
}

export function CompanionButtonPickerDialog({ onConfirm, onClose }: Props) {
  const settings = useAppStore((s) => s.settings)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const buttons = useAppStore((s) => s.buttons)
  const addPageAssignment = useAppStore((s) => s.addPageAssignment)

  // Nur verbundene Hosts
  const connectedHosts = useMemo(() => {
    if (!settings) return []
    return settings.hosts.filter((h) =>
      Object.entries(sessionStatus).some(([k, v]) => k.startsWith(h.id + ':') && v === 'connected'),
    )
  }, [settings, sessionStatus])

  const [hostId, setHostId] = useState<string>(connectedHosts[0]?.id ?? '')
  const [pageNum, setPageNum] = useState<number | null>(null)
  const [newPageInput, setNewPageInput] = useState('')
  const [showNewPageInput, setShowNewPageInput] = useState(false)
  const [selectedKey, setSelectedKey] = useState<number | null>(null) // keyIndex

  // Pages für gewählten Host
  const pages = useMemo(() => {
    if (!settings || !hostId) return []
    const pa = settings.wizard?.pageAssignments ?? {}
    return Object.entries(pa)
      .filter(([k]) => k.startsWith(hostId + ':'))
      .map(([k, v]) => ({ key: k, page: v.page, surfaceConfig: v.surfaceConfig }))
      .sort((a, b) => a.page - b.page)
  }, [settings, hostId])

  const activePage = pages.find((p) => p.page === pageNum)
  const keysPerRow = activePage?.surfaceConfig.keysPerRow ?? 8
  const rows = activePage?.surfaceConfig.rows ?? 8

  // Mini-Grid Button-States
  const gridCells = useMemo(() => {
    if (pageNum === null) return []
    const prefix = pageKey(hostId, pageNum)
    const cells: Array<{ keyIndex: number; bgColor?: string; text?: string }> = []
    for (let i = 0; i < keysPerRow * rows; i++) {
      const state = buttons[`${prefix}:${i}`]
      cells.push({ keyIndex: i, bgColor: state?.bgColor, text: state?.text })
    }
    return cells
  }, [buttons, hostId, pageNum, keysPerRow, rows])

  const selectedRow = selectedKey !== null ? Math.floor(selectedKey / keysPerRow) : null
  const selectedCol = selectedKey !== null ? selectedKey % keysPerRow : null

  const handleHostChange = (id: string) => {
    setHostId(id)
    setPageNum(null)
    setSelectedKey(null)
    setShowNewPageInput(false)
  }

  const handlePageChange = (value: string) => {
    if (value === '__new__') {
      setShowNewPageInput(true)
      setPageNum(null)
      setSelectedKey(null)
    } else {
      setShowNewPageInput(false)
      setPageNum(Number(value))
      setSelectedKey(null)
    }
  }

  const handleNewPageConfirm = () => {
    const n = parseInt(newPageInput, 10)
    if (!n || n < 1) return
    addPageAssignment(hostId, n)
    setPageNum(n)
    setShowNewPageInput(false)
    setNewPageInput('')
    setSelectedKey(null)
  }

  const handleConfirm = () => {
    if (pageNum === null || selectedKey === null) return
    onConfirm({ hostId, page: pageNum, row: selectedRow!, col: selectedCol! })
  }

  // Zellgröße: max 48px, passt in 400px Dialog-Breite
  const cellSize = Math.min(48, Math.floor(400 / keysPerRow))

  return (
    <div style={OVERLAY} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={DIALOG}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Companion Button wählen</div>

        {connectedHosts.length === 0 ? (
          <div style={{ color: '#8896aa', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            Kein Host verbunden
          </div>
        ) : (
          <>
            {/* Host + Page Zeile */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={LABEL_STYLE}>Host</div>
                <select style={SELECT_STYLE} value={hostId} onChange={(e) => handleHostChange(e.target.value)}>
                  {connectedHosts.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={LABEL_STYLE}>Page</div>
                <select
                  style={SELECT_STYLE}
                  value={showNewPageInput ? '__new__' : (pageNum ?? '')}
                  onChange={(e) => handlePageChange(e.target.value)}
                >
                  <option value="" disabled>— wählen —</option>
                  {pages.map((p) => (
                    <option key={p.key} value={p.page}>Page {p.page}</option>
                  ))}
                  <option value="__new__">+ Neue Page…</option>
                </select>
              </div>
            </div>

            {/* Neue Page Input */}
            {showNewPageInput && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <div style={LABEL_STYLE}>Page-Nummer</div>
                  <input
                    type="number" min={1} max={99}
                    value={newPageInput}
                    onChange={(e) => setNewPageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleNewPageConfirm()}
                    style={{ ...SELECT_STYLE, width: '100%', boxSizing: 'border-box' }}
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleNewPageConfirm}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: '1px solid #4a9eff',
                    background: 'rgba(74,158,255,0.12)', color: '#4a9eff', fontSize: 13, cursor: 'pointer',
                  }}
                >
                  OK
                </button>
              </div>
            )}

            {/* Mini-Grid */}
            {pageNum !== null && (
              <div style={{ marginBottom: 16 }}>
                <div style={LABEL_STYLE}>Button wählen</div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${keysPerRow}, ${cellSize}px)`,
                  gap: 2,
                  background: '#0f141a',
                  padding: 8,
                  borderRadius: 8,
                  border: '1px solid #2a3344',
                  overflowX: 'auto',
                }}>
                  {gridCells.map(({ keyIndex, bgColor, text }) => {
                    const isSelected = selectedKey === keyIndex
                    return (
                      <div
                        key={keyIndex}
                        onClick={() => setSelectedKey(keyIndex)}
                        title={`Row ${Math.floor(keyIndex / keysPerRow)}, Col ${keyIndex % keysPerRow}`}
                        style={{
                          width: cellSize, height: cellSize,
                          background: bgColor ?? '#1a2030',
                          border: isSelected ? '2px solid #4a9eff' : '1px solid #2a3344',
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, color: '#e9edf2',
                          overflow: 'hidden',
                          boxSizing: 'border-box',
                          transition: 'border-color 0.1s',
                        }}
                      >
                        {text && (
                          <span style={{ fontSize: 8, lineHeight: 1.1, textAlign: 'center', padding: '0 2px', overflow: 'hidden' }}>
                            {text.split('\n')[0]}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {selectedKey !== null && (
                  <div style={{ fontSize: 11, color: '#8896aa', marginTop: 6 }}>
                    Zeile {selectedRow! + 1}, Spalte {selectedCol! + 1}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px', borderRadius: 6, border: '1px solid #2a3344',
              background: '#121821', color: '#8896aa', fontSize: 13, cursor: 'pointer',
            }}
          >
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            disabled={pageNum === null || selectedKey === null}
            style={{
              padding: '7px 16px', borderRadius: 6, border: '1px solid #4a9eff',
              background: pageNum !== null && selectedKey !== null ? 'rgba(74,158,255,0.15)' : '#1a2030',
              color: pageNum !== null && selectedKey !== null ? '#4a9eff' : '#4a5568',
              fontSize: 13, cursor: pageNum !== null && selectedKey !== null ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript-Build prüfen**

```bash
cd "packages/frontend" && npx tsc --noEmit 2>&1 | head -30
```

Erwartet: keine Fehler

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/AddElement/
git commit -m "feat: CompanionButtonPickerDialog — Host/Page-Dropdown + Mini-Grid"
```

---

### Task 4: Toolbar `+`-Button

**Files:**
- Modify: `packages/frontend/src/components/Toolbar/Toolbar.tsx`

- [ ] **Step 1: `AddElementMenu` in Toolbar integrieren**

In `Toolbar.tsx`:

1. Zeile 1 anpassen — `useCallback` ergänzen (der Rest ist bereits vorhanden):

```typescript
import React, { useState, useRef, useEffect, useCallback } from 'react'
```

2. `AddElementMenu` importieren (nach dem `useAppStore`-Import):

```typescript
import { AddElementMenu } from '../AddElement/AddElementMenu'
```

3. In der `Toolbar`-Funktion nach den bestehenden State-Deklarationen (`dropdownOpen`, `dropdownRef`) einfügen:

```typescript
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addBtnRef = useRef<HTMLButtonElement>(null)
```

> `activePanel` ist bereits als `const activePanel = panels.find(...)` definiert — das ist dasselbe wie `panel` im Plan, nutze `activePanel`.

4. Handler und Position-Helfer einfügen (nach `dropdownRef`-Declaration):

```typescript
  const handleAddClick = useCallback(() => {
    setAddMenuOpen((o) => !o)
  }, [])

  const getAddMenuPos = useCallback(() => {
    const rect = addBtnRef.current?.getBoundingClientRect()
    return rect ? { x: rect.left, y: rect.bottom + 4 } : { x: 0, y: 60 }
  }, [])
```

5. Den `+`-Button einfügen — direkt **nach** dem `Edit`-Button und **vor** `<div style={{ flex: 1 }} />`:

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
            title="Element hinzufügen"
          >
            +
          </button>
        </>
      )}
```

6. `AddElementMenu` am Ende des Toolbar-`<div>` rendern (vor dem schließenden Tag):

```tsx
      {addMenuOpen && activePanel && (
        <AddElementMenu
          screenPos={getAddMenuPos()}
          canvasPos={{
            x: (activePanel?.canvas?.width ?? 1920) / 2,
            y: (activePanel?.canvas?.height ?? 1080) / 2,
          }}
          panelId={activePanel!.id}
          onClose={() => setAddMenuOpen(false)}
        />
      )}
```

- [ ] **Step 2: TypeScript-Build prüfen**

```bash
cd "packages/frontend" && npx tsc --noEmit 2>&1 | head -20
```

Erwartet: keine Fehler

- [ ] **Step 3: Manuell testen**
  - Frontend läuft auf `:5173` / `:5174`
  - In Edit-Mode wechseln → `+`-Button erscheint
  - Klick → Popup zeigt 3 Einträge
  - Label wählen → Element erscheint auf Canvas, ist selektiert
  - Shape wählen → Element erscheint auf Canvas
  - CompanionButton wählen → Picker-Dialog öffnet sich

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/Toolbar/Toolbar.tsx
git commit -m "feat: Toolbar + Button öffnet AddElementMenu im Edit-Mode"
```

---

### Task 5: Canvas Rechtsklick-Kontextmenü

**Files:**
- Modify: `packages/frontend/src/components/Canvas/Canvas.tsx`

- [ ] **Step 1: State und Handler in Canvas hinzufügen**

In `Canvas.tsx` nach den bestehenden Imports:

```typescript
import { AddElementMenu } from '../AddElement/AddElementMenu'
```

In der `Canvas`-Funktion nach den bestehenden State-Deklarationen:

```typescript
  const [contextMenu, setContextMenu] = useState<{
    screenPos: { x: number; y: number }
    canvasPos: { x: number; y: number }
  } | null>(null)
```

Handler-Funktion:

```typescript
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'edit') return
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    const canvasPos = rect
      ? { x: e.clientX - rect.left, y: e.clientY - rect.top }
      : { x: e.clientX, y: e.clientY }
    setContextMenu({ screenPos: { x: e.clientX, y: e.clientY }, canvasPos })
  }, [mode])
```

- [ ] **Step 2: `onContextMenu` auf Canvas-Container setzen**

Den inneren scrollbaren Canvas-Container (die `div` mit `ref={containerRef}`) um `onContextMenu` erweitern:

```tsx
          onContextMenu={handleContextMenu}
```

- [ ] **Step 3: `AddElementMenu` rendern**

Am Ende der `content`-Variable, direkt vor `{mode === 'edit' && <PropertiesPanel />}`:

```tsx
      {mode === 'edit' && contextMenu && panel && (
        <AddElementMenu
          screenPos={contextMenu.screenPos}
          canvasPos={contextMenu.canvasPos}
          panelId={panel.id}
          onClose={() => setContextMenu(null)}
        />
      )}
```

- [ ] **Step 4: TypeScript-Build prüfen**

```bash
cd "packages/frontend" && npx tsc --noEmit 2>&1 | head -20
```

Erwartet: keine Fehler

- [ ] **Step 5: Manuell testen**
  - In Edit-Mode: Rechtsklick auf Canvas → Popup erscheint an Mausposition
  - Label hinzufügen → erscheint dort wo geklickt wurde (zentriert)
  - In View-Mode: Rechtsklick → kein Menü (Browser-Default)
  - Rechtsklick auf bestehendes Element → Menü erscheint (da Canvas `onContextMenu` bubbles)

- [ ] **Step 6: Alle Tests ausführen**

```bash
cd "packages/frontend" && npm run test -- --reporter=verbose 2>&1
```

Erwartet: alle bisherigen Tests PASS, keine Regressions

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/src/components/Canvas/Canvas.tsx
git commit -m "feat: Canvas Rechtsklick öffnet AddElementMenu im Edit-Mode"
```

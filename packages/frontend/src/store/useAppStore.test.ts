import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './useAppStore'
import type { Settings } from '@cwp/shared'

const makeSettings = (): Settings => ({
  version: '1.1.0',
  activeHostId: 'h1',
  hosts: [{ id: 'h1', name: 'H1', host: '127.0.0.1', satellite: { wsPort: 16623 } }],
  panels: [{
    id: 'panel-1',
    name: 'Test',
    zoom: 1,
    defaultMode: 'view',
    grid: { enabled: true, size: 40, snap: true },
    elements: [
      { id: 'e1', type: 'label', x: 10, y: 20, w: 100, h: 50, z: 0, text: 'Hello', style: {} },
      { id: 'e2', type: 'shape', x: 200, y: 100, w: 80, h: 80, z: 1, style: { fill: '#ff0000' } },
    ],
  }],
})

beforeEach(() => {
  useAppStore.getState().setSettings(makeSettings())
  useAppStore.getState().clearSelection()
})

describe('selectElement', () => {
  it('selektiert ein Element', () => {
    useAppStore.getState().selectElement('e1', false)
    expect(useAppStore.getState().selectedIds.has('e1')).toBe(true)
  })
  it('ersetzt Selektion ohne Shift', () => {
    useAppStore.getState().selectElement('e1', false)
    useAppStore.getState().selectElement('e2', false)
    expect(useAppStore.getState().selectedIds.size).toBe(1)
    expect(useAppStore.getState().selectedIds.has('e2')).toBe(true)
  })
  it('fügt zur Selektion hinzu mit Shift', () => {
    useAppStore.getState().selectElement('e1', false)
    useAppStore.getState().selectElement('e2', true)
    expect(useAppStore.getState().selectedIds.size).toBe(2)
  })
  it('entfernt aus Selektion bei Shift+Klick auf selektiertes', () => {
    useAppStore.getState().selectElement('e1', false)
    useAppStore.getState().selectElement('e1', true)
    expect(useAppStore.getState().selectedIds.has('e1')).toBe(false)
  })
})

describe('clearSelection', () => {
  it('leert die Selektion', () => {
    useAppStore.getState().selectElement('e1', false)
    useAppStore.getState().clearSelection()
    expect(useAppStore.getState().selectedIds.size).toBe(0)
  })
})

describe('updateElementGeometry', () => {
  it('aktualisiert Position und Größe', () => {
    useAppStore.getState().updateElementGeometry('panel-1', 'e1', { x: 50, y: 60 })
    const el = useAppStore.getState().settings!.panels[0].elements.find(e => e.id === 'e1')!
    expect(el.x).toBe(50)
    expect(el.y).toBe(60)
    expect(el.w).toBe(100)
  })
})

describe('undo/redo', () => {
  it('undo stellt vorherigen Zustand wieder her', () => {
    useAppStore.getState().saveUndoSnapshot(['e1'])
    useAppStore.getState().updateElementGeometry('panel-1', 'e1', { x: 999 })
    useAppStore.getState().undo()
    const el = useAppStore.getState().settings!.panels[0].elements.find(e => e.id === 'e1')!
    expect(el.x).toBe(10)
  })
  it('redo stellt wiederhergestellten Zustand zurück', () => {
    useAppStore.getState().saveUndoSnapshot(['e1'])
    useAppStore.getState().updateElementGeometry('panel-1', 'e1', { x: 999 })
    useAppStore.getState().undo()
    useAppStore.getState().redo()
    const el = useAppStore.getState().settings!.panels[0].elements.find(e => e.id === 'e1')!
    expect(el.x).toBe(999)
  })
})

describe('duplicateElements', () => {
  it('dupliziert ein Element mit Offset +75', () => {
    useAppStore.getState().duplicateElements('panel-1', ['e1'])
    const elements = useAppStore.getState().settings!.panels[0].elements
    expect(elements).toHaveLength(3)
    const copy = elements[2]
    expect(copy.x).toBe(10 + 75)
    expect(copy.y).toBe(20 + 75)
    expect(copy.id).not.toBe('e1')
  })
  it('Selektion zeigt auf Kopien', () => {
    useAppStore.getState().duplicateElements('panel-1', ['e1'])
    const elements = useAppStore.getState().settings!.panels[0].elements
    const copyId = elements[2].id
    expect(useAppStore.getState().selectedIds.has(copyId)).toBe(true)
    expect(useAppStore.getState().selectedIds.has('e1')).toBe(false)
  })
})

describe('deleteElements', () => {
  it('entfernt Elemente', () => {
    useAppStore.getState().deleteElements('panel-1', ['e1'])
    const elements = useAppStore.getState().settings!.panels[0].elements
    expect(elements.find(e => e.id === 'e1')).toBeUndefined()
    expect(elements).toHaveLength(1)
  })
  it('leert Selektion nach Delete', () => {
    useAppStore.getState().selectElement('e1', false)
    useAppStore.getState().deleteElements('panel-1', ['e1'])
    expect(useAppStore.getState().selectedIds.size).toBe(0)
  })
})

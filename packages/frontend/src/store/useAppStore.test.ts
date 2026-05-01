import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './useAppStore'
import type { Settings } from '@cwp/shared'

const makeSettings = (): Settings => ({
  version: '1.7.0',
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
    expect(elements).toHaveLength(4)
    const copy = elements[3]
    expect(copy.x).toBe(10 + 75)
    expect(copy.y).toBe(20 + 75)
    expect(copy.id).not.toBe('e1')
  })
  it('Selektion zeigt auf Kopien', () => {
    useAppStore.getState().duplicateElements('panel-1', ['e1'])
    const elements = useAppStore.getState().settings!.panels[0].elements
    const copyId = elements[3].id
    expect(useAppStore.getState().selectedIds.has(copyId)).toBe(true)
    expect(useAppStore.getState().selectedIds.has('e1')).toBe(false)
  })
})

describe('deleteElements', () => {
  it('entfernt Elemente', () => {
    useAppStore.getState().deleteElements('panel-1', ['e1'])
    const elements = useAppStore.getState().settings!.panels[0].elements
    expect(elements.find(e => e.id === 'e1')).toBeUndefined()
    expect(elements).toHaveLength(2)
  })
  it('leert Selektion nach Delete', () => {
    useAppStore.getState().selectElement('e1', false)
    useAppStore.getState().deleteElements('panel-1', ['e1'])
    expect(useAppStore.getState().selectedIds.size).toBe(0)
  })
})

describe('addElement', () => {
  it('fügt Element ans Ende von panel.elements hinzu', () => {
    const el: import('@cwp/shared').AnyElement = {
      id: 'new-1', type: 'label', x: 10, y: 20, w: 200, h: 40, z: 3, text: 'Neu', style: {},
    }
    useAppStore.getState().addElement('panel-1', el)
    const panel = useAppStore.getState().settings!.panels.find(p => p.id === 'panel-1')!
    expect(panel.elements[panel.elements.length - 1]?.id).toBe('new-1')
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

describe('applyDelta / getButtonState', () => {
  it('speichert Button-State per row/col', () => {
    useAppStore.getState().applyDelta({
      t: 'delta', hostId: 'h1', page: 1, row: 0, col: 2,
      bgColor: '#ff0000', text: 'Live',
    })
    const state = useAppStore.getState().getButtonState('h1', 1, 0, 2)
    expect(state?.bgColor).toBe('#ff0000')
    expect(state?.text).toBe('Live')
  })
})

describe('applySessionStatus / getSessionStatus', () => {
  it('speichert Status pro Host', () => {
    useAppStore.getState().applySessionStatus({ t: 'sessionStatus', hostId: 'h1', status: 'connected' })
    expect(useAppStore.getState().getSessionStatus('h1')).toBe('connected')
  })
  it('markAllSessionsStale setzt alle auf stale', () => {
    useAppStore.getState().applySessionStatus({ t: 'sessionStatus', hostId: 'h1', status: 'connected' })
    useAppStore.getState().markAllSessionsStale()
    expect(useAppStore.getState().getSessionStatus('h1')).toBe('stale')
  })
  it('speichert caps-disabled Status', () => {
    useAppStore.getState().applySessionStatus({ t: 'sessionStatus', hostId: 'h1', status: 'caps-disabled' })
    expect(useAppStore.getState().getSessionStatus('h1')).toBe('caps-disabled')
  })
  it('markAllSessionsStale setzt caps-disabled auf stale', () => {
    useAppStore.getState().applySessionStatus({ t: 'sessionStatus', hostId: 'h1', status: 'caps-disabled' })
    useAppStore.getState().markAllSessionsStale()
    expect(useAppStore.getState().getSessionStatus('h1')).toBe('stale')
  })
})

describe('applyHostInfo', () => {
  it('speichert companionVersion und apiVersion pro Host', () => {
    useAppStore.getState().applyHostInfo({
      t: 'hostInfo', hostId: 'h1',
      companionVersion: '4.3.0+9146', apiVersion: '1.10.0',
    })
    const info = useAppStore.getState().hostInfo['h1']
    expect(info?.companionVersion).toBe('4.3.0+9146')
    expect(info?.apiVersion).toBe('1.10.0')
  })
  it('überschreibt vorherige Version-Info', () => {
    useAppStore.getState().applyHostInfo({ t: 'hostInfo', hostId: 'h1', companionVersion: 'old', apiVersion: '1.0' })
    useAppStore.getState().applyHostInfo({ t: 'hostInfo', hostId: 'h1', companionVersion: 'new', apiVersion: '2.0' })
    expect(useAppStore.getState().hostInfo['h1']?.companionVersion).toBe('new')
  })
})

describe('Host CRUD', () => {
  const newHost: import('@cwp/shared').HostProfile = {
    id: 'h2', name: 'Studio B', host: '10.0.0.2', satellite: { wsPort: 16623 }, autoConnect: true,
  }

  it('addHost fügt Host zu settings.hosts hinzu', () => {
    useAppStore.getState().addHost(newHost)
    const hosts = useAppStore.getState().settings!.hosts
    expect(hosts).toHaveLength(2)
    expect(hosts.find(h => h.id === 'h2')?.name).toBe('Studio B')
  })

  it('updateHost ersetzt bestehenden Host', () => {
    useAppStore.getState().updateHost({ ...newHost, id: 'h1', name: 'Updated' })
    const hosts = useAppStore.getState().settings!.hosts
    expect(hosts[0].name).toBe('Updated')
    expect(hosts).toHaveLength(1)
  })

  it('removeHost entfernt Host ohne Refs löschen', () => {
    useAppStore.getState().removeHost('h1', false)
    const hosts = useAppStore.getState().settings!.hosts
    expect(hosts).toHaveLength(0)
  })

  it('removeHost mit deleteRefs=true löscht verknüpfte companionButton-Elemente', () => {
    // Panel mit einem companionButton der h1 referenziert anlegen
    const settingsWithBtn: import('@cwp/shared').Settings = {
      version: '1.7.0',
      activeHostId: 'h1',
      hosts: [{ id: 'h1', name: 'H1', host: '127.0.0.1', satellite: { wsPort: 16623 } }],
      panels: [{
        id: 'p1', name: 'P', zoom: 1, defaultMode: 'view',
        grid: { enabled: true, size: 40, snap: true },
        elements: [
          { id: 'cb1', type: 'companionButton', x: 0, y: 0, w: 72, h: 72, z: 0,
            ref: { hostId: 'h1', page: 1, row: 0, col: 0 } },
          { id: 'lbl1', type: 'label', x: 0, y: 0, w: 100, h: 30, z: 1, text: 'X', style: {} },
        ],
      }],
    }
    useAppStore.getState().setSettings(settingsWithBtn)
    useAppStore.getState().removeHost('h1', true)
    const elements = useAppStore.getState().settings!.panels[0].elements
    expect(elements.find(e => e.id === 'cb1')).toBeUndefined()
    expect(elements.find(e => e.id === 'lbl1')).toBeDefined() // Label bleibt
  })

  it('removeHost mit deleteRefs=false lässt Elemente stehen', () => {
    const settingsWithBtn: import('@cwp/shared').Settings = {
      version: '1.7.0',
      activeHostId: 'h1',
      hosts: [{ id: 'h1', name: 'H1', host: '127.0.0.1', satellite: { wsPort: 16623 } }],
      panels: [{
        id: 'p1', name: 'P', zoom: 1, defaultMode: 'view',
        grid: { enabled: true, size: 40, snap: true },
        elements: [
          { id: 'cb1', type: 'companionButton', x: 0, y: 0, w: 72, h: 72, z: 0,
            ref: { hostId: 'h1', page: 1, row: 0, col: 0 } },
        ],
      }],
    }
    useAppStore.getState().setSettings(settingsWithBtn)
    useAppStore.getState().removeHost('h1', false)
    const elements = useAppStore.getState().settings!.panels[0].elements
    expect(elements.find(e => e.id === 'cb1')).toBeDefined() // Button bleibt (zeigt ⛔)
  })
})

describe('Panel CRUD', () => {
  it('createPanel fügt neues Panel hinzu und aktiviert es', () => {
    const panel = useAppStore.getState().createPanel('Live Show')
    const state = useAppStore.getState()
    expect(state.settings!.panels).toHaveLength(2)
    expect(panel.name).toBe('Live Show')
    expect(state.activePanelId).toBe(panel.id)
  })

  it('renamePanel benennt Panel um', () => {
    useAppStore.getState().renamePanel('panel-1', 'Renamed')
    expect(useAppStore.getState().settings!.panels[0].name).toBe('Renamed')
  })

  it('deletePanel entfernt Panel und gibt true zurück', () => {
    const panel2 = useAppStore.getState().createPanel('Panel 2')
    const result = useAppStore.getState().deletePanel(panel2.id)
    expect(result).toBe(true)
    expect(useAppStore.getState().settings!.panels).toHaveLength(1)
  })

  it('deletePanel gibt false zurück wenn letztes Panel', () => {
    const result = useAppStore.getState().deletePanel('panel-1')
    expect(result).toBe(false)
    expect(useAppStore.getState().settings!.panels).toHaveLength(1)
  })

  it('deletePanel wechselt activePanelId wenn aktives Panel gelöscht wird', () => {
    const panel2 = useAppStore.getState().createPanel('Panel 2')
    // panel2 ist jetzt aktiv
    expect(useAppStore.getState().activePanelId).toBe(panel2.id)
    useAppStore.getState().deletePanel(panel2.id)
    // zurück auf panel-1
    expect(useAppStore.getState().activePanelId).toBe('panel-1')
  })
})

describe('hostExists', () => {
  it('gibt true zurück wenn Host in settings ist', () => {
    expect(useAppStore.getState().hostExists('h1')).toBe(true)
  })
  it('gibt false zurück für unbekannten Host', () => {
    expect(useAppStore.getState().hostExists('unknown-xyz')).toBe(false)
  })
  it('gibt false zurück nach removeHost', () => {
    useAppStore.getState().removeHost('h1', false)
    expect(useAppStore.getState().hostExists('h1')).toBe(false)
  })
})

describe('setZoom', () => {
  it('setzt Zoom für ein Panel', () => {
    useAppStore.getState().setZoom('panel-1', 1.5)
    const panel = useAppStore.getState().settings?.panels.find((p) => p.id === 'panel-1')
    expect(panel?.zoom).toBe(1.5)
  })

  it('klemmt Zoom auf Minimum 0.2', () => {
    useAppStore.getState().setZoom('panel-1', 0.05)
    const panel = useAppStore.getState().settings?.panels.find((p) => p.id === 'panel-1')
    expect(panel?.zoom).toBe(0.2)
  })

  it('klemmt Zoom auf Maximum 2.0', () => {
    useAppStore.getState().setZoom('panel-1', 5.0)
    const panel = useAppStore.getState().settings?.panels.find((p) => p.id === 'panel-1')
    expect(panel?.zoom).toBe(2.0)
  })

  it('ignoriert unbekannte Panel-ID (kein Crash)', () => {
    expect(() => useAppStore.getState().setZoom('no-such-panel', 1.5)).not.toThrow()
    expect(useAppStore.getState().settings?.panels.length).toBe(1)
  })
})

describe('virtualKeys — applyVDelta', () => {
  it('speichert Virtual-Key-State nach vDelta', () => {
    useAppStore.getState().applyVDelta({ t: 'vDelta', deviceId: 'cwp-a1b2c3d4', keyIndex: 3, bgColor: '#f00' })
    const state = useAppStore.getState().getVirtualKeyState('cwp-a1b2c3d4', 3)
    expect(state?.bgColor).toBe('#f00')
  })

  it('merged vDelta auf bestehenden State', () => {
    useAppStore.getState().applyVDelta({ t: 'vDelta', deviceId: 'cwp-a1b2c3d4', keyIndex: 0, bgColor: '#f00' })
    useAppStore.getState().applyVDelta({ t: 'vDelta', deviceId: 'cwp-a1b2c3d4', keyIndex: 0, text: 'LIVE' })
    const state = useAppStore.getState().getVirtualKeyState('cwp-a1b2c3d4', 0)
    expect(state?.bgColor).toBe('#f00')
    expect(state?.text).toBe('LIVE')
  })
})

describe('virtualKeys — applyVSnapshot', () => {
  it('ersetzt alle Keys eines Devices nach vSnapshot', () => {
    useAppStore.getState().applyVDelta({ t: 'vDelta', deviceId: 'cwp-a1b2c3d4', keyIndex: 0, bgColor: '#f00' })
    useAppStore.getState().applyVSnapshot({ t: 'vSnapshot', deviceId: 'cwp-a1b2c3d4', keys: { '1': { bgColor: '#0f0' } } })
    // Key 0 weg (replaced), Key 1 vorhanden
    expect(useAppStore.getState().getVirtualKeyState('cwp-a1b2c3d4', 0)).toBeUndefined()
    expect(useAppStore.getState().getVirtualKeyState('cwp-a1b2c3d4', 1)?.bgColor).toBe('#0f0')
  })
})

describe('virtualSessionStatus', () => {
  it('speichert vSessionStatus', () => {
    useAppStore.getState().applyVSessionStatus({ t: 'vSessionStatus', deviceId: 'cwp-a1b2c3d4', status: 'connected' })
    expect(useAppStore.getState().getVirtualSessionStatus('cwp-a1b2c3d4')).toBe('connected')
  })
})

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
    const copy = store.duplicatePanel(original.id)
    expect(useAppStore.getState().activePanelId).toBe(copy.id)
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

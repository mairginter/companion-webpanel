// packages/backend/src/state/StateStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { StateStore } from './StateStore'

describe('StateStore — virtual keys', () => {
  let store: StateStore

  beforeEach(() => { store = new StateStore() })

  it('setVirtualKey gibt Delta zurück wenn sich etwas ändert', () => {
    const delta = store.setVirtualKey('cwp-a1b2c3d4', 3, { bgColor: '#ff0000' })
    expect(delta).toEqual({ bgColor: '#ff0000' })
  })

  it('setVirtualKey gibt null zurück wenn kein Unterschied', () => {
    store.setVirtualKey('cwp-a1b2c3d4', 3, { bgColor: '#ff0000' })
    const delta = store.setVirtualKey('cwp-a1b2c3d4', 3, { bgColor: '#ff0000' })
    expect(delta).toBeNull()
  })

  it('getVirtualSnapshot gibt alle Keys für ein Device zurück', () => {
    store.setVirtualKey('cwp-a1b2c3d4', 0, { bgColor: '#f00', text: 'A' })
    store.setVirtualKey('cwp-a1b2c3d4', 1, { bgColor: '#0f0' })
    const snap = store.getVirtualSnapshot('cwp-a1b2c3d4')
    expect(snap['0']).toMatchObject({ bgColor: '#f00', text: 'A' })
    expect(snap['1']).toMatchObject({ bgColor: '#0f0' })
  })

  it('clearVirtualKeys löscht alle Keys eines Devices', () => {
    store.setVirtualKey('cwp-a1b2c3d4', 0, { bgColor: '#f00' })
    store.clearVirtualKeys('cwp-a1b2c3d4')
    const snap = store.getVirtualSnapshot('cwp-a1b2c3d4')
    expect(Object.keys(snap).length).toBe(0)
  })

  it('clearVirtualKeys löscht nur das angegebene Device', () => {
    store.setVirtualKey('cwp-a1b2c3d4', 0, { bgColor: '#f00' })
    store.setVirtualKey('cwp-b9c8d7e6', 0, { bgColor: '#0f0' })
    store.clearVirtualKeys('cwp-a1b2c3d4')
    const snap = store.getVirtualSnapshot('cwp-b9c8d7e6')
    expect(snap['0']).toMatchObject({ bgColor: '#0f0' })
  })
})

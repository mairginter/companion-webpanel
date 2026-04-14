// packages/backend/src/VirtualSurfaceManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VirtualSurfaceManager } from './VirtualSurfaceManager'
import { StateStore } from './state/StateStore'
import type { Settings, VirtualCompanionDeckElement, VDeltaMessage, VSessionStatusMessage } from '@cwp/shared'

// Wir mocken VirtualSurfaceSession komplett
const mockStart = vi.fn()
const mockStop = vi.fn().mockResolvedValue(undefined)
const mockGetStatus = vi.fn().mockReturnValue('connecting')
const mockOn = vi.fn()

vi.mock('./satellite/VirtualSurfaceSession', () => ({
  VirtualSurfaceSession: vi.fn().mockImplementation(function (this: any, deviceId: string) {
    this.deviceId = deviceId
    this.start = mockStart
    this.stop = mockStop
    this.getStatus = mockGetStatus
    this.on = mockOn
  }),
}))

const makeSettings = (elements: VirtualCompanionDeckElement[] = []): Settings => ({
  version: '1.4.0' as any,
  activeHostId: 'h1',
  hosts: [{ id: 'h1', name: 'H1', host: '127.0.0.1', satellite: { wsPort: 16623 } }],
  panels: [{ id: 'p1', name: 'P1', zoom: 1, defaultMode: 'view',
    grid: { enabled: false, size: 40, snap: false }, elements }],
})

const makeDeckElement = (): VirtualCompanionDeckElement => ({
  id: 'el-1', type: 'virtualCompanionDeck',
  x: 0, y: 0, w: 400, h: 200, z: 0,
  hostId: 'h1', deviceId: 'cwp-a1b2c3d4',
  surfaceName: 'Test', grid: { cols: 8, rows: 4 },
  style: { fill: '#1e3a5f', opacity: 0.85, borderRadius: 8, padding: 8, gap: 5 },
})

describe('VirtualSurfaceManager', () => {
  let store: StateStore
  let broadcast: (msg: VDeltaMessage | VSessionStatusMessage) => void
  let manager: VirtualSurfaceManager

  beforeEach(() => {
    vi.clearAllMocks()
    store = new StateStore()
    broadcast = vi.fn() as (msg: VDeltaMessage | VSessionStatusMessage) => void
    manager = new VirtualSurfaceManager(store, broadcast)
  })

  it('startet eine Session für jedes virtualCompanionDeck-Element', () => {
    manager.sync(makeSettings([makeDeckElement()]))
    expect(mockStart).toHaveBeenCalledTimes(1)
  })

  it('stoppt Session wenn Element entfernt wird', async () => {
    manager.sync(makeSettings([makeDeckElement()]))
    await manager.sync(makeSettings([]))
    expect(mockStop).toHaveBeenCalledTimes(1)
  })

  it('startet keine doppelte Session für gleiche deviceId', () => {
    manager.sync(makeSettings([makeDeckElement()]))
    manager.sync(makeSettings([makeDeckElement()]))
    expect(mockStart).toHaveBeenCalledTimes(1)
  })

  it('stoppt alle Sessions bei stop()', async () => {
    manager.sync(makeSettings([makeDeckElement()]))
    await manager.stop()
    expect(mockStop).toHaveBeenCalledTimes(1)
  })
})

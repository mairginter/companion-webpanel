// packages/backend/src/satellite/VirtualSurfaceSession.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

// vi.hoisted() läuft vor dem Hoist von vi.mock() — so kann der Mock die Variable referenzieren
const { getMockWs, setMockWs } = vi.hoisted(() => {
  let _mockWs: any = null
  return {
    getMockWs: () => _mockWs,
    setMockWs: (ws: any) => { _mockWs = ws },
  }
})

vi.mock('ws', () => {
  // EventEmitter via require() laden — import-Bindings sind beim Mock-Hoist noch nicht verfügbar
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter: EE } = require('events')
  // Muss eine echte Klasse sein (function constructor) damit `new WebSocket(...)` funktioniert
  class MockWebSocket extends EE {
    static OPEN = 1
    readyState = 1
    sent: string[] = []
    constructor(_url: string) {
      super()
      setMockWs(this)
    }
    send(data: string) { (this as any).sent.push(data) }
    close() { (this as any).readyState = 3; (this as any).emit('close') }
  }
  return { default: MockWebSocket, WebSocket: MockWebSocket }
})

import { VirtualSurfaceSession } from './VirtualSurfaceSession'

describe('VirtualSurfaceSession', () => {
  let session: VirtualSurfaceSession

  beforeEach(() => {
    session = new VirtualSurfaceSession('cwp-a1b2c3d4', 'Test Surface', 8, 4, '127.0.0.1', 16623)
  })

  it('sendet ADD-DEVICE nach BEGIN', () => {
    session.start()
    const ws = getMockWs()
    ws.emit('open')
    ws.emit('message', 'BEGIN CompanionVersion="4.3.0" ApiVersion="1.10.0"\n')
    expect(ws.sent.some((s: string) =>
      s.includes('ADD-DEVICE') &&
      s.includes('cwp-a1b2c3d4') &&
      s.includes('KEYS_TOTAL=32') &&
      s.includes('KEYS_PER_ROW=8')
    )).toBe(true)
  })

  it('setzt Status auf connected nach ADD-DEVICE OK', () => {
    session.start()
    const ws = getMockWs()
    ws.emit('open')
    ws.emit('message', 'BEGIN CompanionVersion="4.3.0" ApiVersion="1.10.0"\n')
    ws.emit('message', 'ADD-DEVICE OK\n')
    expect(session.getStatus()).toBe('connected')
  })

  it('emittiert keyState bei KEY-STATE Nachricht', () => {
    const handler = vi.fn()
    session.on('keyState', handler)
    session.start()
    const ws = getMockWs()
    ws.emit('open')
    ws.emit('message', 'BEGIN CompanionVersion="4.3.0" ApiVersion="1.10.0"\n')
    ws.emit('message', 'ADD-DEVICE OK\n')
    ws.emit('message', 'KEY-STATE DEVICEID="cwp-a1b2c3d4" KEY=3 TYPE=BUTTON COLOR=#ff0000\n')
    expect(handler).toHaveBeenCalledWith(3, expect.objectContaining({ bgColor: '#ff0000' }))
  })

  it('sendet KEY-PRESS wenn verbunden', () => {
    session.start()
    const ws = getMockWs()
    ws.emit('open')
    ws.emit('message', 'BEGIN CompanionVersion="4.3.0" ApiVersion="1.10.0"\n')
    ws.emit('message', 'ADD-DEVICE OK\n')
    ws.sent = []
    session.sendKeyPress(5, true)
    expect(ws.sent.some((s: string) =>
      s.includes('KEY-PRESS') && s.includes('KEY=5') && s.includes('PRESSED=true')
    )).toBe(true)
  })

  it('setzt Status auf stale nach Disconnect', () => {
    const statusHandler = vi.fn()
    session.on('status', statusHandler)
    session.start()
    const ws = getMockWs()
    ws.emit('open')
    ws.emit('message', 'BEGIN CompanionVersion="4.3.0" ApiVersion="1.10.0"\n')
    ws.emit('message', 'ADD-DEVICE OK\n')
    ws.emit('close')
    expect(statusHandler).toHaveBeenCalledWith('stale')
  })
})

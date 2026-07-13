// packages/backend/src/satellite/SatelliteClient.test.ts
//
// Tests für die Button Subscriptions API — insbesondere die Bitmap-Format-
// Negotiation ab Companion 5.0 (CAPS BITMAP_FORMATS → ADD-SUB BITMAP_FORMAT).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

import { SatelliteClient } from './SatelliteClient'

describe('SatelliteClient', () => {
  let client: SatelliteClient

  beforeEach(() => {
    client = new SatelliteClient('host1', '127.0.0.1', 16623)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Handshake bis inkl. CAPS durchspielen und den Mock-Socket zurückgeben. */
  function boot(capsLine: string) {
    client.start()
    const ws = getMockWs()
    ws.emit('open')
    ws.emit('message', 'BEGIN CompanionVersion="5.0.0" ApiVersion="1.12.0"\n')
    ws.emit('message', capsLine + '\n')
    return ws
  }

  it('sendet ADD-SUB mit BITMAP_FORMAT=webp wenn CAPS webp annonciert', () => {
    client.subscribe('cwp/1/0/0', 1, 0, 0, 72)
    const ws = boot('CAPS SUBSCRIPTIONS=1 NONSQUARE=1 BITMAP_FORMATS="rgb,png,webp"')
    const addSub = ws.sent.find((s: string) => s.startsWith('ADD-SUB'))
    expect(addSub).toBeDefined()
    // Legacy-Params bleiben, BITMAP_FORMAT kommt zusätzlich dazu
    expect(addSub).toContain('BITMAP=72 COLORS=hex TEXT=true TEXT_STYLE=true')
    expect(addSub).toContain('BITMAP_FORMAT=webp')
  })

  it('bevorzugt png wenn webp nicht annonciert wird', () => {
    client.subscribe('cwp/1/0/0', 1, 0, 0, 72)
    const ws = boot('CAPS SUBSCRIPTIONS=1 BITMAP_FORMATS="rgb,png"')
    const addSub = ws.sent.find((s: string) => s.startsWith('ADD-SUB'))
    expect(addSub).toContain('BITMAP_FORMAT=png')
  })

  it('sendet KEIN BITMAP_FORMAT bei CAPS ohne BITMAP_FORMATS (Companion 4.3)', () => {
    client.subscribe('cwp/1/0/0', 1, 0, 0, 72)
    const ws = boot('CAPS SUBSCRIPTIONS=1')
    const addSub = ws.sent.find((s: string) => s.startsWith('ADD-SUB'))
    // Wire-Format für 4.3 muss byte-identisch zum bisherigen Verhalten bleiben
    expect(addSub).toBe(
      'ADD-SUB SUBID=cwp/1/0/0 LOCATION=1/0/0 BITMAP=72 COLORS=hex TEXT=true TEXT_STYLE=true\n',
    )
  })

  it('reicht Data-URL-BITMAP (webp) im SUB-STATE unverändert durch', () => {
    const handler = vi.fn()
    client.on('subState', handler)
    client.subscribe('cwp/1/0/0', 1, 0, 0, 72)
    const ws = boot('CAPS SUBSCRIPTIONS=1 BITMAP_FORMATS="rgb,png,webp"')
    const dataUrl = 'data:image/webp;base64,UklGRn4DAABXRUJQ'
    ws.emit('message', `SUB-STATE SUBID="cwp/1/0/0" TYPE=BUTTON COLOR=#112233 BITMAP="${dataUrl}"\n`)
    expect(handler).toHaveBeenCalledWith(
      'cwp/1/0/0', 1, 0, 0,
      expect.objectContaining({ bitmap: dataUrl, bgColor: '#112233' }),
    )
  })

  it('fällt bei Reconnect auf Server ohne BITMAP_FORMATS auf rgb zurück', () => {
    vi.useFakeTimers()
    client.subscribe('cwp/1/0/0', 1, 0, 0, 72)
    // Erster Connect: Companion 5.0 mit webp
    const ws1 = boot('CAPS SUBSCRIPTIONS=1 BITMAP_FORMATS="rgb,png,webp"')
    expect(ws1.sent.find((s: string) => s.startsWith('ADD-SUB'))).toContain('BITMAP_FORMAT=webp')
    // Disconnect → Reconnect (Backoff-Stufe 1 = 1000 ms) auf älteren Server (kein BITMAP_FORMATS)
    ws1.emit('close')
    vi.advanceTimersByTime(1000)
    const ws2 = getMockWs()
    expect(ws2).not.toBe(ws1)
    ws2.emit('open')
    ws2.emit('message', 'BEGIN CompanionVersion="4.3.0" ApiVersion="1.10.0"\n')
    ws2.emit('message', 'CAPS SUBSCRIPTIONS=1\n')
    const addSub = ws2.sent.find((s: string) => s.startsWith('ADD-SUB'))
    expect(addSub).toBeDefined()
    expect(addSub).not.toContain('BITMAP_FORMAT')
  })

  it('setzt Status caps-disabled bei CAPS SUBSCRIPTIONS=0', () => {
    boot('CAPS SUBSCRIPTIONS=0')
    expect(client.getStatus()).toBe('caps-disabled')
  })

  it('sendet STYLE-basiertes ADD-SUB für non-square wenn NONSQUARE + Format annonciert', () => {
    client.subscribe('cwp/1/0/0', 1, 0, 0, 144, 72)
    const ws = boot('CAPS SUBSCRIPTIONS=1 NONSQUARE=1 BITMAP_FORMATS="rgb,png,webp"')
    const addSub = ws.sent.find((s: string) => s.startsWith('ADD-SUB'))
    const m = addSub?.match(/ STYLE=(\S+)/)
    expect(m).toBeTruthy()
    const style = JSON.parse(Buffer.from(m![1], 'base64').toString('utf8'))
    expect(style).toEqual({ bitmap: { w: 144, h: 72 }, text: true, textStyle: true, colors: 'hex' })
    // BITMAP_FORMAT bleibt separater Param; Simple-Style-Params entfallen bei STYLE
    expect(addSub).toContain('BITMAP_FORMAT=webp')
    expect(addSub).not.toContain(' BITMAP=')
    expect(addSub).not.toContain('COLORS=')
    expect(addSub).not.toContain(' TEXT=')
  })

  it('fällt ohne NONSQUARE-CAP auf quadratisches Legacy-Format zurück (BITMAP=lange Seite)', () => {
    client.subscribe('cwp/1/0/0', 1, 0, 0, 200, 100)
    const ws = boot('CAPS SUBSCRIPTIONS=1 BITMAP_FORMATS="rgb,png,webp"')
    const addSub = ws.sent.find((s: string) => s.startsWith('ADD-SUB'))
    expect(addSub).toContain('BITMAP=200 COLORS=hex TEXT=true TEXT_STYLE=true')
    expect(addSub).not.toMatch(/ STYLE=/) // Achtung: 'TEXT_STYLE=' enthält 'STYLE=' — Anker nötig
    expect(addSub).toContain('BITMAP_FORMAT=webp')
  })

  it('nutzt Legacy-Format für quadratische Subs auch mit NONSQUARE-CAP', () => {
    client.subscribe('cwp/1/0/0', 1, 0, 0, 72, 72)
    const ws = boot('CAPS SUBSCRIPTIONS=1 NONSQUARE=1 BITMAP_FORMATS="rgb,png,webp"')
    const addSub = ws.sent.find((s: string) => s.startsWith('ADD-SUB'))
    expect(addSub).toContain('BITMAP=72 COLORS=hex TEXT=true TEXT_STYLE=true')
    expect(addSub).not.toMatch(/ STYLE=/)
  })
})

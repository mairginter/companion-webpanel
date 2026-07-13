// packages/backend/src/discovery/DiscoveryService.test.ts
//
// Tests für die mDNS-Auto-Discovery (Companion 5.0 announced _companion-satellite-ws._tcp).
// Bonjour komplett gemockt — getestet wird Mapping, Dedupe, IPv4-Wahl und Watchdog.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getMockBrowser, setMockBrowser, getMockBonjour, setMockBonjour } = vi.hoisted(() => {
  let _browser: any = null
  let _bonjour: any = null
  return {
    getMockBrowser: () => _browser,
    setMockBrowser: (b: any) => { _browser = b },
    getMockBonjour: () => _bonjour,
    setMockBonjour: (b: any) => { _bonjour = b },
  }
})

vi.mock('@julusian/bonjour-service', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter: EE } = require('events')
  class MockBrowser extends EE {
    update = vi.fn()
    stop = vi.fn()
  }
  class MockBonjour {
    destroy = vi.fn()
    find(_opts: any) {
      const browser = new MockBrowser()
      setMockBrowser(browser)
      return browser
    }
    constructor() { setMockBonjour(this) }
  }
  return { Bonjour: MockBonjour, default: MockBonjour }
})

import { DiscoveryService } from './DiscoveryService'

/** Baut ein DiscoveredService-Objekt wie es bonjour-service liefert. */
function service(overrides: Record<string, unknown> = {}) {
  return {
    fqdn: 'Companion Studio._companion-satellite-ws._tcp.local',
    name: 'Companion Studio',
    addresses: ['fe80::1234', '192.168.144.102'],
    host: 'studio.local',
    port: 16623,
    txt: { protocolVersion: '1.12.0' },
    ...overrides,
  }
}

describe('DiscoveryService', () => {
  let svc: DiscoveryService

  beforeEach(() => {
    vi.useFakeTimers()
    svc = new DiscoveryService()
  })

  afterEach(() => {
    svc.stop()
    vi.useRealTimers()
  })

  it('mappt up-Events auf DiscoveredHost und emittiert update', () => {
    const handler = vi.fn()
    svc.on('update', handler)
    svc.start()
    getMockBrowser().emit('up', service())
    expect(svc.getHosts()).toEqual([{
      id: 'Companion Studio._companion-satellite-ws._tcp.local',
      name: 'Companion Studio',
      address: '192.168.144.102',
      port: 16623,
      apiVersion: '1.12.0',
    }])
    expect(handler).toHaveBeenCalledWith(svc.getHosts())
  })

  it('entfernt Hosts bei down-Event', () => {
    svc.start()
    getMockBrowser().emit('up', service())
    getMockBrowser().emit('down', service())
    expect(svc.getHosts()).toEqual([])
  })

  it('dedupliziert per fqdn (zweites up ersetzt statt dupliziert)', () => {
    svc.start()
    getMockBrowser().emit('up', service())
    getMockBrowser().emit('up', service({ txt: { protocolVersion: '1.12.1' } }))
    expect(svc.getHosts()).toHaveLength(1)
    expect(svc.getHosts()[0].apiVersion).toBe('1.12.1')
  })

  it('wählt die erste nicht-link-locale IPv4 und ignoriert Services ohne IPv4', () => {
    svc.start()
    getMockBrowser().emit('up', service({ addresses: ['fe80::1', '169.254.10.20', '10.0.0.5'] }))
    expect(svc.getHosts()[0].address).toBe('10.0.0.5')
    getMockBrowser().emit('up', service({ fqdn: 'v6only.local', addresses: ['fe80::2'] }))
    expect(svc.getHosts()).toHaveLength(1) // v6only wurde ignoriert
  })

  it('pollt periodisch mit browser.update()', () => {
    svc.start()
    vi.advanceTimersByTime(30_000)
    expect(getMockBrowser().update.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('stoppt automatisch nach 5 Minuten (Watchdog)', () => {
    svc.start()
    getMockBrowser().emit('up', service())
    vi.advanceTimersByTime(5 * 60_000)
    expect(getMockBonjour().destroy).toHaveBeenCalled()
    expect(svc.getHosts()).toEqual([])
  })

  it('start ist idempotent (zweiter Aufruf erzeugt keinen zweiten Browser)', () => {
    svc.start()
    const first = getMockBrowser()
    svc.start()
    expect(getMockBrowser()).toBe(first)
  })

  it('stop leert die Host-Liste und emittiert update([])', () => {
    const handler = vi.fn()
    svc.start()
    getMockBrowser().emit('up', service())
    svc.on('update', handler)
    svc.stop()
    expect(handler).toHaveBeenCalledWith([])
    expect(svc.getHosts()).toEqual([])
  })
})

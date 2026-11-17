/**
 * deviceView.test.ts — Tests für die geräte-lokalen Ansichts-Helfer
 * (Fit-Berechnung, Panel-Auflösung aus URL/localStorage, Kiosk/Lock-Flags).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Panel } from '@cwp/shared'
import {
  computeFitZoom,
  effectiveAutoZoom,
  resolvePanelRef,
  pickInitialPanelId,
  rememberActivePanel,
  loadKiosk,
  persistKiosk,
  loadLocked,
  persistLocked,
  buildDeviceUrl,
  isLoopbackHost,
  consumeLinksParam,
} from './deviceView'

const panel = (id: string, name: string, canvas?: Panel['canvas']): Panel => ({
  id, name, zoom: 1, defaultMode: 'view',
  grid: { enabled: true, size: 40, snap: true },
  canvas, elements: [],
})

const panels = [panel('id-a', 'Video'), panel('id-b', 'Audio Mix')]

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('computeFitZoom', () => {
  it('begrenzt durch die Breite (16:9-Canvas auf 4:3-Schirm, z.B. iPad)', () => {
    expect(computeFitZoom(1920, 1080, 1024, 768)).toBeCloseTo(1024 / 1920)
  })
  it('begrenzt durch die Höhe (4:3-Canvas auf 16:9-Schirm)', () => {
    expect(computeFitZoom(1024, 768, 2560, 1384)).toBeCloseTo(1384 / 768)
  })
  it('skaliert über 200% hinaus hoch', () => {
    expect(computeFitZoom(800, 600, 3840, 2160)).toBeCloseTo(3.6)
  })
  it('liefert 1 bei ungültigen Maßen', () => {
    expect(computeFitZoom(0, 1080, 100, 100)).toBe(1)
    expect(computeFitZoom(1920, 1080, 0, 0)).toBe(1)
  })
})

describe('effectiveAutoZoom', () => {
  const fixed = panel('f', 'F', { width: 1920, height: 1080 })
  it('Default: Fit bei fixem Canvas, kein Fit bei dynamischem', () => {
    expect(effectiveAutoZoom(fixed, undefined)).toBe(true)
    expect(effectiveAutoZoom(panels[0], undefined)).toBe(false)
  })
  it('gespeicherte Präferenz hat Vorrang — außer ohne feste Größe', () => {
    expect(effectiveAutoZoom(fixed, { zoom: 1, autoZoom: false })).toBe(false)
    expect(effectiveAutoZoom(panels[0], { zoom: 1, autoZoom: true })).toBe(false)
  })
})

describe('Panel-Auswahl', () => {
  it('löst ID und Name (case-insensitive) auf', () => {
    expect(resolvePanelRef(panels, 'id-b')).toBe('id-b')
    expect(resolvePanelRef(panels, 'audio mix')).toBe('id-b')
    expect(resolvePanelRef(panels, 'gibt-es-nicht')).toBeNull()
    expect(resolvePanelRef(panels, null)).toBeNull()
  })
  it('URL-Parameter schlägt localStorage schlägt erstes Panel', () => {
    expect(pickInitialPanelId(panels)).toBe('id-a')
    rememberActivePanel(panels[1])
    // rememberActivePanel führt die URL nach → Lesezeichen-tauglich
    expect(new URLSearchParams(window.location.search).get('panel')).toBe('Audio Mix')
    window.history.replaceState(null, '', '/')
    expect(pickInitialPanelId(panels)).toBe('id-b')
    window.history.replaceState(null, '', '/?panel=Video')
    expect(pickInitialPanelId(panels)).toBe('id-a')
  })
  it('fällt bei unbekanntem URL-Panel auf das erste zurück', () => {
    window.history.replaceState(null, '', '/?panel=Unbekannt')
    expect(pickInitialPanelId(panels)).toBe('id-a')
  })
})

describe('Kiosk / Lock', () => {
  it('sind standardmäßig aus', () => {
    expect(loadKiosk()).toBe(false)
    expect(loadLocked()).toBe(false)
  })
  it('werden aus der URL gelesen', () => {
    window.history.replaceState(null, '', '/?kiosk=1&lock=true')
    expect(loadKiosk()).toBe(true)
    expect(loadLocked()).toBe(true)
  })
  it('URL-Wert 0 überstimmt localStorage', () => {
    persistKiosk(true)
    window.history.replaceState(null, '', '/?kiosk=0')
    expect(loadKiosk()).toBe(false)
  })
  it('persistieren in localStorage und URL', () => {
    persistLocked(true)
    expect(new URLSearchParams(window.location.search).get('lock')).toBe('1')
    window.history.replaceState(null, '', '/')
    expect(loadLocked()).toBe(true)
    persistLocked(false)
    expect(loadLocked()).toBe(false)
  })
})

describe('Geräte-Links', () => {
  it('baut eine Adresse nur aus gesetzten Optionen', () => {
    expect(buildDeviceUrl('http://192.168.1.20:8080', {})).toBe('http://192.168.1.20:8080/')
    expect(buildDeviceUrl('http://192.168.1.20:8080/', { panel: 'Audio', kiosk: true }))
      .toBe('http://192.168.1.20:8080/?panel=Audio&kiosk=1')
    expect(buildDeviceUrl('http://h:8080', { kiosk: false, lock: true, lang: 'de' }))
      .toBe('http://h:8080/?lock=1&lang=de')
  })
  it('kodiert Panel-Namen so, dass resolvePanelRef sie wieder findet', () => {
    const url = buildDeviceUrl('http://h:8080', { panel: 'Audio Mix' })
    const ref = new URL(url).searchParams.get('panel')
    expect(resolvePanelRef(panels, ref)).toBe('id-b')
  })
  it('erkennt Loopback-Adressen', () => {
    expect(isLoopbackHost('localhost')).toBe(true)
    expect(isLoopbackHost('127.0.0.1')).toBe(true)
    expect(isLoopbackHost('192.168.1.20')).toBe(false)
  })
  it('links-Parameter wird einmalig gelesen und entfernt', () => {
    window.history.replaceState(null, '', '/?links=1&kiosk=1')
    expect(consumeLinksParam()).toBe(true)
    expect(window.location.search).toBe('?kiosk=1')
    expect(consumeLinksParam()).toBe(false)
  })
})

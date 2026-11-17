/**
 * deviceView.ts
 *
 * Geräte-lokale Ansichts-Einstellungen — alles, was NICHT in die gemeinsame
 * Settings-Datei gehört, weil es pro Gerät/Browser unterschiedlich ist:
 *
 *  - Zoom / Fit-to-Window pro Panel        → localStorage 'cwp-view-prefs'
 *  - zuletzt aktives Panel                  → localStorage 'cwp-active-panel'
 *  - Kiosk (Toolbar im View-Mode versteckt) → localStorage 'cwp-kiosk'
 *  - Show-Lock (Edit + Shortcuts gesperrt)  → localStorage 'cwp-lock'
 *
 * Zusätzlich dient die URL als "Profil" — Parameter haben beim Laden Vorrang
 * vor localStorage und werden bei Änderungen per history.replaceState
 * nachgeführt, sodass die aktuelle Adresse jederzeit als Lesezeichen taugt:
 *
 *   http://host:8080/?panel=Audio&kiosk=1&lock=1
 *
 *   panel = Panel-Name (case-insensitive) oder Panel-ID
 *   kiosk = 1|0   Toolbar im View-Mode ausblenden
 *   lock  = 1|0   Edit-Mode + Tastatur-Shortcuts sperren
 *
 * Alle Storage-/History-Zugriffe sind in try/catch gekapselt (Private-Mode,
 * Tests, eingebettete Kontexte) — die App muss auch ohne sie funktionieren.
 */
import type { Panel } from '@cwp/shared'

/** Zoom-Einstellung eines Panels auf DIESEM Gerät */
export interface ViewPref {
  /** Aktueller Zoom-Faktor (bei Fit: der zuletzt berechnete Fit-Wert) */
  zoom: number
  /** true = Fit-to-Window, false = manuell, undefined = Default (Fit bei fixem Canvas) */
  autoZoom?: boolean
}

const LS_VIEW_PREFS = 'cwp-view-prefs'
const LS_ACTIVE_PANEL = 'cwp-active-panel'
const LS_KIOSK = 'cwp-kiosk'
const LS_LOCK = 'cwp-lock'

/** Grenzen für manuellen Zoom (Slider, Ctrl+Scroll) */
export const MANUAL_ZOOM_MIN = 0.2
export const MANUAL_ZOOM_MAX = 2.0
/** Grenzen für Fit-Zoom — bewusst weit, damit ein kleines Panel auch einen 4K-Schirm füllt */
export const FIT_ZOOM_MIN = 0.05
export const FIT_ZOOM_MAX = 10

// ─── Storage-Helfer ──────────────────────────────────────────────────────────

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function lsSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch { /* Storage nicht verfügbar — ignorieren */ }
}

// ─── URL-Helfer ──────────────────────────────────────────────────────────────

function urlParam(key: string): string | null {
  try { return new URLSearchParams(window.location.search).get(key) } catch { return null }
}

/** Setzt/entfernt einen Query-Parameter ohne Reload (Adresse bleibt als Lesezeichen gültig). */
function setUrlParam(key: string, value: string | null): void {
  try {
    const url = new URL(window.location.href)
    if (value === null) url.searchParams.delete(key)
    else url.searchParams.set(key, value)
    window.history.replaceState(window.history.state, '', url)
  } catch { /* z.B. file://-Kontext — ignorieren */ }
}

/** '1'/'true' → true, '0'/'false' → false, sonst null (= nicht gesetzt) */
function parseFlag(raw: string | null): boolean | null {
  if (raw === null) return null
  const v = raw.trim().toLowerCase()
  if (v === '1' || v === 'true' || v === '') return true
  if (v === '0' || v === 'false') return false
  return null
}

// ─── Zoom-Prefs ──────────────────────────────────────────────────────────────

export function loadViewPrefs(): Record<string, ViewPref> {
  const raw = lsGet(LS_VIEW_PREFS)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, ViewPref>) : {}
  } catch {
    return {}
  }
}

export function saveViewPrefs(prefs: Record<string, ViewPref>): void {
  lsSet(LS_VIEW_PREFS, JSON.stringify(prefs))
}

/** Fit ist nur sinnvoll, wenn das Panel eine feste Canvas-Größe hat. */
export function hasFixedCanvas(panel: Panel | null | undefined): boolean {
  return !!panel?.canvas?.width && !!panel?.canvas?.height
}

/**
 * Effektiver Fit-Zustand: ohne gespeicherte Präferenz ist Fit der Default —
 * so zeigt jedes Gerät (27"-Monitor wie iPad) das Panel sofort passend skaliert.
 */
export function effectiveAutoZoom(panel: Panel | null | undefined, pref: ViewPref | undefined): boolean {
  if (!hasFixedCanvas(panel)) return false
  return pref?.autoZoom ?? true
}

/** Größter Zoom, bei dem der Canvas vollständig in den verfügbaren Bereich passt ("contain"). */
export function computeFitZoom(canvasW: number, canvasH: number, availW: number, availH: number): number {
  if (canvasW <= 0 || canvasH <= 0 || availW <= 0 || availH <= 0) return 1
  const fit = Math.min(availW / canvasW, availH / canvasH)
  return Math.max(FIT_ZOOM_MIN, Math.min(FIT_ZOOM_MAX, fit))
}

// ─── Aktives Panel ───────────────────────────────────────────────────────────

/** Löst eine Panel-Referenz (ID oder Name, case-insensitive) zu einer Panel-ID auf. */
export function resolvePanelRef(panels: Panel[], ref: string | null): string | null {
  if (!ref) return null
  const byId = panels.find((p) => p.id === ref)
  if (byId) return byId.id
  const lower = ref.trim().toLowerCase()
  return panels.find((p) => p.name.trim().toLowerCase() === lower)?.id ?? null
}

/** Start-Panel dieses Geräts: URL-Parameter → zuletzt aktives Panel → erstes Panel. */
export function pickInitialPanelId(panels: Panel[]): string | null {
  return (
    resolvePanelRef(panels, urlParam('panel')) ??
    resolvePanelRef(panels, lsGet(LS_ACTIVE_PANEL)) ??
    panels[0]?.id ??
    null
  )
}

/** Merkt das aktive Panel lokal und führt den URL-Parameter nach. */
export function rememberActivePanel(panel: Panel | null | undefined): void {
  if (!panel) return
  lsSet(LS_ACTIVE_PANEL, panel.id)
  setUrlParam('panel', panel.name)
}

// ─── Kiosk / Lock ────────────────────────────────────────────────────────────

export function loadKiosk(): boolean {
  return parseFlag(urlParam('kiosk')) ?? lsGet(LS_KIOSK) === '1'
}

export function persistKiosk(value: boolean): void {
  lsSet(LS_KIOSK, value ? '1' : null)
  setUrlParam('kiosk', value ? '1' : null)
}

export function loadLocked(): boolean {
  return parseFlag(urlParam('lock')) ?? lsGet(LS_LOCK) === '1'
}

export function persistLocked(value: boolean): void {
  lsSet(LS_LOCK, value ? '1' : null)
  setUrlParam('lock', value ? '1' : null)
}

// ─── Geräte-Links ────────────────────────────────────────────────────────────

/** Optionen eines Geräte-Links (siehe DeviceLinksModal) */
export interface DeviceUrlOptions {
  /** Panel-Name (oder ID) */
  panel?: string
  kiosk?: boolean
  lock?: boolean
  /** Sprachcode, z.B. 'de' — weglassen = Geräte-Einstellung bleibt */
  lang?: string
}

/**
 * Baut eine Geräte-Adresse aus Basis-Adresse + Optionen, z.B.
 *   buildDeviceUrl('http://192.168.1.20:8080', { panel: 'Audio', kiosk: true })
 *   → 'http://192.168.1.20:8080/?panel=Audio&kiosk=1'
 * Nur gesetzte Optionen landen in der Adresse — sie bleibt so kurz wie möglich.
 */
export function buildDeviceUrl(origin: string, opts: DeviceUrlOptions): string {
  const params = new URLSearchParams()
  if (opts.panel) params.set('panel', opts.panel)
  if (opts.kiosk) params.set('kiosk', '1')
  if (opts.lock) params.set('lock', '1')
  if (opts.lang) params.set('lang', opts.lang)
  const query = params.toString()
  const base = origin.replace(/\/+$/, '')
  return query ? `${base}/?${query}` : `${base}/`
}

/** true für Adressen, die nur auf dem eigenen Rechner funktionieren. */
export function isLoopbackHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase()
  return h === 'localhost' || h === '::1' || h === '[::1]' || h.startsWith('127.')
}

/**
 * Prüft den einmaligen URL-Parameter ?links=1 ("Geräte-Links-Dialog sofort öffnen" —
 * so ruft ihn das Electron-Startfenster auf) und entfernt ihn wieder aus der Adresse,
 * damit er nicht in Lesezeichen oder kopierten Links landet.
 */
export function consumeLinksParam(): boolean {
  const open = parseFlag(urlParam('links')) === true
  if (open) setUrlParam('links', null)
  return open
}

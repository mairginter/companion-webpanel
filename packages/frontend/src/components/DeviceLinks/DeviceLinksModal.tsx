/**
 * DeviceLinksModal.tsx
 *
 * "Geräte-Links": macht die URL-Profile (?panel=…&kiosk=1&lock=1&lang=…) sichtbar und
 * bedienbar. Vorher musste man die Parameter kennen und von Hand in die Adresszeile tippen.
 *
 * Der Dialog
 *  - baut aus Panel + Kiosk + Show-Lock + Sprache eine fertige Adresse,
 *  - bietet dafür die NETZWERK-Adressen dieses Rechners an (GET /api/server-info) —
 *    ein Tablet erreicht das Panel nicht über "localhost",
 *  - kann die Adresse kopieren oder in einem neuen Tab öffnen,
 *  - kann dieselbe Auswahl direkt auf DIESEM Gerät anwenden (Kiosk sofort starten).
 *
 * Geöffnet über den Geräte-Links-Button in der Toolbar oder per URL-Parameter ?links=1
 * (so öffnet ihn das Electron-Startfenster). ESC und Backdrop-Klick schließen.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { AVAILABLE_LANGUAGES } from '../../i18n'
import { buildDeviceUrl, isLoopbackHost } from '../../utils/deviceView'

// Im Dev-Modus läuft das Backend auf :8080, das Frontend auf dem Vite-Port
const BACKEND_BASE = import.meta.env.DEV ? `http://${window.location.hostname}:8080` : ''

interface Props {
  onClose: () => void
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200,
}

const MODAL: React.CSSProperties = {
  background: '#1a2030', border: '1px solid #2a3344', borderRadius: 12,
  width: 560, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto',
  padding: 20, color: '#e9edf2', boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
  display: 'flex', flexDirection: 'column', gap: 14,
}

const LBL: React.CSSProperties = { fontSize: 11, color: '#8896aa', marginBottom: 4 }

const SELECT: React.CSSProperties = {
  width: '100%', height: 34, background: '#121821', border: '1px solid #2a3344',
  borderRadius: 6, color: '#e9edf2', fontSize: 13, padding: '0 8px',
}

const CHECK_ROW: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', minHeight: 28,
}

const btn = (primary: boolean): React.CSSProperties => ({
  height: 34, padding: '0 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500,
  display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
  border: `1px solid ${primary ? '#4a9eff' : '#2a3344'}`,
  background: primary ? 'rgba(74,158,255,0.15)' : '#121821',
  color: primary ? '#4a9eff' : '#c8d0dc',
})

export function DeviceLinksModal({ onClose }: Props) {
  const { t } = useTranslation()
  const panels = useAppStore((s) => s.settings?.panels ?? [])
  const activePanelId = useAppStore((s) => s.activePanelId)
  const kioskNow = useAppStore((s) => s.kiosk)
  const lockedNow = useAppStore((s) => s.locked)

  // Auswahl — startet mit dem aktuellen Zustand dieses Geräts
  const [panelId, setPanelId] = useState<string>(activePanelId ?? panels[0]?.id ?? '')
  const [kiosk, setKiosk] = useState(kioskNow)
  const [lock, setLock] = useState(lockedNow)
  const [lang, setLang] = useState('') // '' = keinen lang-Parameter setzen
  const [copied, setCopied] = useState(false)
  const urlInputRef = useRef<HTMLInputElement>(null)

  // Adress-Kandidaten: aktuelle Adresse + Netzwerk-Adressen vom Backend
  const currentOrigin = window.location.origin
  const [origins, setOrigins] = useState<string[]>([currentOrigin])
  const [origin, setOrigin] = useState(currentOrigin)

  useEffect(() => {
    let cancelled = false
    fetch(`${BACKEND_BASE}/api/server-info`)
      .then((r) => r.json())
      .then((info: { addresses?: string[] }) => {
        if (cancelled) return
        // Port des Frontends verwenden (im Electron-/Release-Betrieb = Backend-Port)
        const port = window.location.port ? `:${window.location.port}` : ''
        const lan = (info.addresses ?? []).map((a) => `${window.location.protocol}//${a}${port}`)
        const all = [...new Set([...lan, currentOrigin])]
        setOrigins(all)
        // Wird die Seite über localhost bedient, ist die erste Netzwerk-Adresse der
        // sinnvollere Vorschlag — der Link ist ja für ein ANDERES Gerät gedacht.
        if (isLoopbackHost(window.location.hostname) && lan.length > 0) setOrigin(lan[0])
      })
      .catch(() => { /* ohne Backend-Info bleibt die aktuelle Adresse die einzige Option */ })
    return () => { cancelled = true }
  }, [currentOrigin])

  // ESC schließt
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const panel = panels.find((p) => p.id === panelId)
  const url = useMemo(
    () => buildDeviceUrl(origin, { panel: panel?.name, kiosk, lock, lang: lang || undefined }),
    [origin, panel?.name, kiosk, lock, lang],
  )

  const handleCopy = async () => {
    let ok = false
    try {
      // navigator.clipboard gibt es nur in sicheren Kontexten (https / localhost) —
      // über http://192.168.x.x ist es undefined.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        ok = true
      }
    } catch { /* Fallback unten */ }
    if (!ok) {
      const input = urlInputRef.current
      if (input) {
        input.focus()
        input.select()
        try { ok = document.execCommand('copy') } catch { ok = false }
      }
    }
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } else {
      useAppStore.getState().showToast({ kind: 'warn', text: t('deviceLinks.copyFailed') })
    }
  }

  /** Wendet die Auswahl sofort auf diesem Gerät an (Panel wechseln, Lock, Kiosk). */
  const handleApplyHere = () => {
    const store = useAppStore.getState()
    if (panel) store.setActivePanelId(panel.id)
    store.setLocked(lock)
    if (kiosk) store.setMode('view') // Kiosk wirkt nur im View-Mode
    store.setKiosk(kiosk)
    if (kiosk) store.showToast({ kind: 'info', text: t('deviceLinks.kioskStarted') })
    onClose()
  }

  return (
    <div style={OVERLAY} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={MODAL} role="dialog" aria-label={t('deviceLinks.title')}>
        {/* Kopf */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-icons" style={{ fontSize: 22, color: '#4a9eff' }}>devices</span>
          <div style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>{t('deviceLinks.title')}</div>
          <button
            onClick={onClose}
            title={t('deviceLinks.close')}
            aria-label={t('deviceLinks.close')}
            style={{ ...btn(false), width: 34, padding: 0, justifyContent: 'center' }}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
        <div style={{ fontSize: 13, color: '#8896aa', lineHeight: 1.5 }}>{t('deviceLinks.intro')}</div>

        {/* Adresse + Panel */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div style={LBL}>{t('deviceLinks.address')}</div>
            <select style={SELECT} value={origin} onChange={(e) => setOrigin(e.target.value)}>
              {origins.map((o) => {
                let local = false
                try { local = isLoopbackHost(new URL(o).hostname) } catch { /* ungültig → nicht markieren */ }
                return (
                  <option key={o} value={o}>
                    {local ? `${o} (${t('deviceLinks.thisComputerOnly')})` : o}
                  </option>
                )
              })}
            </select>
          </div>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <div style={LBL}>{t('deviceLinks.panel')}</div>
            <select style={SELECT} value={panelId} onChange={(e) => setPanelId(e.target.value)}>
              {panels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#6a7a8a', marginTop: -8 }}>{t('deviceLinks.addressHint')}</div>

        {/* Optionen */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={CHECK_ROW}>
            <input type="checkbox" style={{ width: 20, height: 20 }} checked={kiosk} onChange={(e) => setKiosk(e.target.checked)} />
            <span className="material-icons" style={{ fontSize: 18, color: '#8896aa' }}>fullscreen</span>
            {t('deviceLinks.kiosk')}
          </label>
          <label style={CHECK_ROW}>
            <input type="checkbox" style={{ width: 20, height: 20 }} checked={lock} onChange={(e) => setLock(e.target.checked)} />
            <span className="material-icons" style={{ fontSize: 18, color: '#8896aa' }}>lock</span>
            {t('deviceLinks.lock')}
          </label>
        </div>
        <div style={{ maxWidth: 260 }}>
          <div style={LBL}>{t('deviceLinks.language')}</div>
          <select style={SELECT} value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="">{t('deviceLinks.languageDevice')}</option>
            {AVAILABLE_LANGUAGES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
        </div>

        {/* Ergebnis */}
        <div>
          <div style={LBL}>{t('deviceLinks.link')}</div>
          <input
            ref={urlInputRef}
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              width: '100%', height: 38, boxSizing: 'border-box', background: '#0d1117',
              border: '1px solid #2a3344', borderRadius: 6, color: '#4a9eff', padding: '0 10px',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 13, outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button style={btn(true)} onClick={handleCopy}>
              <span className="material-icons" style={{ fontSize: 16 }}>{copied ? 'check' : 'content_copy'}</span>
              {copied ? t('deviceLinks.copied') : t('deviceLinks.copy')}
            </button>
            <button style={btn(false)} onClick={() => window.open(url, '_blank', 'noopener')}>
              <span className="material-icons" style={{ fontSize: 16 }}>open_in_new</span>
              {t('deviceLinks.open')}
            </button>
          </div>
        </div>

        {/* Auf diesem Gerät anwenden */}
        <div style={{ borderTop: '1px solid #2a3344', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <button style={btn(false)} onClick={handleApplyHere} disabled={!panel}>
              <span className="material-icons" style={{ fontSize: 16 }}>play_arrow</span>
              {t('deviceLinks.applyHere')}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#6a7a8a', lineHeight: 1.5 }}>
            {t('deviceLinks.applyHereHint')}<br />
            {t('deviceLinks.kioskExitHint')}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * CanvasSettings.tsx — Canvas-Einstellungen im Properties-Panel.
 *
 * Zeigt Größen-Preset-Dropdown, manuelle W/H-Inputs, Hintergrundfarbe und Textur.
 *
 * Schlüssel-Design:
 * - selectValue ist lokaler State, NICHT von detectPreset abgeleitet.
 *   Dadurch rubber-bandet das Select nicht (z.B. custom → 1920x1080 → '1920x1080' preset).
 * - Sync auf Panel-ID-Wechsel: wenn der User ein anderes Panel öffnet, wird
 *   selectValue auf detectPreset(neues Panel) zurückgesetzt.
 * - History: letzte 5 manuell eingegebene Größen in localStorage.
 *   800 ms Debounce — speichert nur wenn Größe nicht im Fixed-Preset ist.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Panel } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { ColorPicker } from './ColorPicker'
import { NumericInput } from './NumericInput'
import { TEXTURES, TextureOption } from '../../utils/textures'

interface Props { panel: Panel; panelId: string }

// ── History ──────────────────────────────────────────────────────────────────

const HISTORY_KEY = 'cwp-canvas-size-history'
const MAX_HISTORY = 5

type HistoryEntry = { w: number; h: number }

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') }
  catch { return [] }
}

function saveToHistory(w: number, h: number): HistoryEntry[] {
  const prev = loadHistory().filter((e) => !(e.w === w && e.h === h))
  const next = [{ w, h }, ...prev].slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  return next
}

// ── Presets ───────────────────────────────────────────────────────────────────

type FixedPreset = 'dynamic' | '1920x1080' | '1440x900' | '1280x720' | 'custom'

const FIXED_PRESET_DEFS: Array<{ value: FixedPreset; w?: number; h?: number }> = [
  { value: 'dynamic' },
  { value: '1920x1080', w: 1920, h: 1080 },
  { value: '1440x900',  w: 1440, h: 900  },
  { value: '1280x720',  w: 1280, h: 720  },
]

function histKey(w: number, h: number) { return `hist_${w}x${h}` }

/** Leitet initial selectValue aus Panel-Dimensionen ab. */
function detectPreset(panel: Panel, history: HistoryEntry[]): string {
  const w = panel.canvas?.width
  const h = panel.canvas?.height
  if (!w || !h) return 'dynamic'
  const fixed = FIXED_PRESET_DEFS.find((p) => p.w === w && p.h === h)
  if (fixed) return fixed.value
  if (history.some((e) => e.w === w && e.h === h)) return histKey(w, h)
  return 'custom'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CanvasSettings({ panel, panelId }: Props) {
  const { t } = useTranslation()
  const setSettings = useAppStore((s) => s.setSettings)
  const settings    = useAppStore((s) => s.settings)

  // Verfügbarer Canvas-Bereich in CSS-Pixeln (Fenster minus Toolbar-Höhe 56px).
  // Aktualisiert bei resize.
  const TOOLBAR_H = 56
  const getArea = () => ({ w: window.innerWidth, h: window.innerHeight - TOOLBAR_H })
  const [winSize, setWinSize] = useState(getArea)
  useEffect(() => {
    const update = () => setWinSize(getArea())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)

  // selectValue treibt das Select-Element. Wird NICHT bei jedem Store-Update
  // überschrieben — nur beim Panel-ID-Wechsel (anderes Panel geöffnet).
  const [selectValue, setSelectValue] = useState(() => detectPreset(panel, history))
  const prevPanelId = useRef(panelId)
  useEffect(() => {
    if (panelId !== prevPanelId.current) {
      prevPanelId.current = panelId
      setSelectValue(detectPreset(panel, history))
    }
  }, [panelId, panel, history])

  const updateCanvas = useCallback((patch: Partial<NonNullable<Panel['canvas']>>) => {
    if (!settings) return
    setSettings({
      ...settings,
      panels: settings.panels.map((p) =>
        p.id !== panelId ? p : { ...p, canvas: { ...p.canvas, ...patch } },
      ),
    })
  }, [settings, setSettings, panelId])

  // History-Speicherung: 800 ms Debounce nach Dimensionsänderung.
  // Nur für nicht-fixed-Preset-Größen.
  useEffect(() => {
    const w = panel.canvas?.width
    const h = panel.canvas?.height
    if (!w || !h) return
    if (FIXED_PRESET_DEFS.some((p) => p.w === w && p.h === h)) return
    const timer = setTimeout(() => {
      setHistory(saveToHistory(w, h))
    }, 800)
    return () => clearTimeout(timer)
  }, [panel.canvas?.width, panel.canvas?.height])

  const isCustom = selectValue === 'custom' || selectValue.startsWith('hist_')

  const lbl: React.CSSProperties = { fontSize: 12, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }
  const sel: React.CSSProperties = { background: '#1a2030', border: '1px solid #2a3344', color: '#e9edf2', borderRadius: 4, padding: '8px 10px', fontSize: 14, width: '100%' }

  const handlePresetChange = (value: string) => {
    setSelectValue(value)   // sofort — kein Rubber-Band

    if (value === 'dynamic') {
      updateCanvas({ width: undefined, height: undefined })
      return
    }
    if (value === 'custom') {
      // Inputs zeigen aktuelle Dimensionen. Wenn Panel noch dynamic war,
      // setze einen Startwert der NICHT im Fixed-Preset ist (sonst würde
      // detectPreset beim nächsten Panel-Wechsel einen Fixed-Preset erkennen).
      if (!panel.canvas?.width || !panel.canvas?.height) {
        updateCanvas({ width: 1600, height: 900 })
      }
      return
    }
    if (value.startsWith('hist_')) {
      const [w, h] = value.replace('hist_', '').split('x').map(Number)
      if (w && h) updateCanvas({ width: w, height: h })
      return
    }
    const fixed = FIXED_PRESET_DEFS.find((p) => p.value === value)
    if (fixed?.w && fixed?.h) updateCanvas({ width: fixed.w, height: fixed.h })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={lbl}>{t('propertiesPanel.canvasSettings')}</div>

      {/* Size preset */}
      <div>
        <div style={lbl}>{t('propertiesPanel.size')}</div>
        <select value={selectValue} style={sel} onChange={(e) => handlePresetChange(e.target.value)}>
          {FIXED_PRESET_DEFS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.value === 'dynamic' ? t('propertiesPanel.dynamic') : `${p.w} × ${p.h}`}
            </option>
          ))}
          {history.length > 0 && (
            <option disabled value="">{t('propertiesPanel.recentSizes')}</option>
          )}
          {history.map((e) => (
            <option key={histKey(e.w, e.h)} value={histKey(e.w, e.h)}>
              {e.w} × {e.h}
            </option>
          ))}
          <option value="custom">{t('propertiesPanel.custom')}</option>
        </select>
      </div>

      {/* Manual W/H inputs — visible for custom and history selections */}
      {isCustom && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <NumericInput label={t('propertiesPanel.width')} value={panel.canvas?.width ?? 1600} min={200} compact
            onChange={(v) => updateCanvas({ width: v })} />
          <NumericInput label={t('propertiesPanel.height')} value={panel.canvas?.height ?? 900} min={100} compact
            onChange={(v) => updateCanvas({ height: v })} />
        </div>
      )}

      {/* Window size & DPI hint */}
      {(() => {
        const dpr = Math.round(window.devicePixelRatio * 100) / 100
        const physW = Math.round(winSize.w * dpr)
        const physH = Math.round(winSize.h * dpr)
        const scaled = dpr > 1.01  // tolerance for values near 1.0
        return (
          <div style={{ background: '#111827', border: '1px solid #2a3344', borderRadius: 4, padding: '8px 10px', fontSize: 12, color: '#8896aa', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{t('propertiesPanel.availableAreaLabel')}</div>
            <div style={{ color: '#e9edf2', fontFamily: "'JetBrains Mono', monospace" }}>
              {winSize.w} × {winSize.h} <span style={{ color: '#4a5568' }}>{t('propertiesPanel.cssPixels')}</span>
            </div>
            {scaled && (
              <div style={{ color: '#f59e0b', fontSize: 11, lineHeight: 1.4 }}>
                {t('propertiesPanel.dpiWarning', { factor: dpr })}<br />
                {physW}×{physH} px
              </div>
            )}
            <button
              onClick={() => {
                updateCanvas({ width: winSize.w, height: winSize.h })
                setSelectValue('custom')
              }}
              style={{
                marginTop: 2, padding: '5px 8px', fontSize: 12, borderRadius: 4,
                background: '#1e3a5f', border: '1px solid #2563eb', color: '#93c5fd',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              {t('propertiesPanel.useAvailableAreaBtn', { w: winSize.w, h: winSize.h })}
            </button>
          </div>
        )
      })()}

      <ColorPicker label={t('propertiesPanel.backgroundColor')} value={panel.canvas?.background ?? '#0f141a'}
        onChange={(v) => updateCanvas({ background: v })} />

      {/* Texture */}
      <div>
        <div style={lbl}>{t('propertiesPanel.texture')}</div>
        <select
          value={panel.canvas?.texture ?? 'none'}
          style={sel}
          onChange={(e) => updateCanvas({ texture: e.target.value === 'none' ? undefined : e.target.value })}
        >
          {TEXTURES.map((tex) => (
            <option key={tex.id} value={tex.id}>{tex.label}</option>
          ))}
        </select>
      </div>

      {/* Texture preview strip */}
      {panel.canvas?.texture && panel.canvas.texture !== 'none' && (() => {
        const tex: TextureOption | undefined = TEXTURES.find((tx) => tx.id === panel.canvas?.texture)
        return tex ? (
          <div style={{
            height: 28, borderRadius: 4,
            border: '1px solid #2a3344',
            background: panel.canvas?.background ?? '#0f141a',
            backgroundImage: tex.css,
            backgroundSize: tex.backgroundSize,
          }} />
        ) : null
      })()}

      {/* Button-Style — GLOBALE Einstellung (Settings.buttonStyle), gilt app-weit.
          'broadcast-led' stülpt sich als Overlay über alle CompanionButtons:
          Companion-bgColor wird zur LED-Signalfarbe (Spec: BroadcastLED-Style.md). */}
      <div>
        <div style={lbl}>{t('propertiesPanel.buttonStyle')}</div>
        <select
          value={settings?.buttonStyle ?? 'default'}
          style={sel}
          onChange={(e) => {
            if (!settings) return
            const v = e.target.value as 'default' | 'broadcast-led'
            // 'default' → Feld weglassen, hält die Settings-Datei schlank
            setSettings({ ...settings, buttonStyle: v === 'default' ? undefined : v })
          }}
        >
          <option value="default">{t('propertiesPanel.styleDefault')}</option>
          <option value="broadcast-led">{t('propertiesPanel.styleBroadcastLed')}</option>
        </select>
        <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4, lineHeight: 1.4 }}>
          {t('propertiesPanel.buttonStyleHint')}
        </div>
      </div>
    </div>
  )
}

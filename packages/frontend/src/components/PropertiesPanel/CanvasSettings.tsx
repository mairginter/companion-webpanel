import React from 'react'
import { Panel } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { ColorPicker } from './ColorPicker'
import { NumericInput } from './NumericInput'
import { TEXTURES, TextureOption } from '../../utils/textures'

interface Props { panel: Panel; panelId: string }

type SizePreset = 'dynamic' | '1920x1080' | '1440x900' | '1280x720' | 'custom'

const PRESETS: Array<{ label: string; value: SizePreset; w?: number; h?: number }> = [
  { label: 'Dynamisch (Fenster)', value: 'dynamic' },
  { label: '1920 x 1080', value: '1920x1080', w: 1920, h: 1080 },
  { label: '1440 x 900', value: '1440x900', w: 1440, h: 900 },
  { label: '1280 x 720', value: '1280x720', w: 1280, h: 720 },
  { label: 'Benutzerdefiniert', value: 'custom' },
]

function detectPreset(panel: Panel): SizePreset {
  const w = panel.canvas?.width
  const h = panel.canvas?.height
  if (!w || !h) return 'dynamic'
  const found = PRESETS.find((p) => p.w === w && p.h === h)
  return found?.value ?? 'custom'
}

export function CanvasSettings({ panel, panelId }: Props) {
  const setSettings = useAppStore((s) => s.setSettings)
  const settings = useAppStore((s) => s.settings)

  const updateCanvas = (patch: Partial<NonNullable<Panel['canvas']>>) => {
    if (!settings) return
    setSettings({
      ...settings,
      panels: settings.panels.map((p) =>
        p.id !== panelId ? p : { ...p, canvas: { ...p.canvas, ...patch } },
      ),
    })
  }

  const preset = detectPreset(panel)
  const lbl: React.CSSProperties = { fontSize: 12, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }
  const sel: React.CSSProperties = { background: '#1a2030', border: '1px solid #2a3344', color: '#e9edf2', borderRadius: 4, padding: '8px 10px', fontSize: 14, width: '100%' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={lbl}>Canvas-Einstellungen</div>
      <div>
        <div style={lbl}>Größe</div>
        <select value={preset} style={sel}
          onChange={(e) => {
            const p = PRESETS.find((x) => x.value === e.target.value)
            if (p?.w && p?.h) updateCanvas({ width: p.w, height: p.h })
            else if (e.target.value === 'dynamic') updateCanvas({ width: undefined, height: undefined })
          }}>
          {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      {preset === 'custom' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <NumericInput label="Breite" value={panel.canvas?.width ?? 1920} min={200}
            onChange={(v) => updateCanvas({ width: v })} />
          <NumericInput label="Höhe" value={panel.canvas?.height ?? 1080} min={100}
            onChange={(v) => updateCanvas({ height: v })} />
        </div>
      )}
      <ColorPicker label="Hintergrundfarbe" value={panel.canvas?.background ?? '#0f141a'}
        onChange={(v) => updateCanvas({ background: v })} />

      {/* Textur */}
      <div>
        <div style={lbl}>Textur</div>
        <select
          value={panel.canvas?.texture ?? 'none'}
          style={sel}
          onChange={(e) => updateCanvas({ texture: e.target.value === 'none' ? undefined : e.target.value })}
        >
          {TEXTURES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Vorschau-Streifen */}
      {panel.canvas?.texture && panel.canvas.texture !== 'none' && (() => {
        const tex: TextureOption | undefined = TEXTURES.find((t) => t.id === panel.canvas?.texture)
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
    </div>
  )
}

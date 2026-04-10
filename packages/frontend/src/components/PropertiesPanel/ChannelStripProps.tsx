/**
 * ChannelStripProps.tsx
 *
 * Properties Panel Section für das ChannelStrip-Element.
 * Sections: Refs, Text-Parsing, Style
 * Alle Wizard-Felder sind hier auch im Edit-Mode zugänglich.
 */
import React from 'react'
import { ChannelStripElement, CompanionRef } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { NumericInput } from './NumericInput'
import { ColorPicker } from './ColorPicker'

interface Props {
  element: ChannelStripElement
  panelId: string
}

const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#8896aa', letterSpacing: 1,
  textTransform: 'uppercase', padding: '10px 14px 4px', borderTop: '1px solid #1e2535',
}
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', padding: '4px 14px', gap: 8 }
const lbl: React.CSSProperties = { fontSize: 12, color: '#8896aa', flex: 1, minWidth: 0 }
const inputStyle: React.CSSProperties = {
  flex: 1, background: '#121821', border: '1px solid #2a3344', borderRadius: 4,
  color: '#e9edf2', fontSize: 13, padding: '4px 8px', minWidth: 0,
}

function refLabel(ref: CompanionRef | undefined): string {
  if (!ref) return '—'
  return `${ref.page}/${ref.row}/${ref.col} @ ${ref.hostId.slice(0, 8)}`
}

export function ChannelStripProps({ element, panelId }: Props) {
  const updateElement = useAppStore((s) => s.updateElement)

  function patch(partial: Partial<ChannelStripElement>) {
    updateElement(panelId, element.id, partial)
  }

  function patchStyle(partial: Partial<ChannelStripElement['style']>) {
    patch({ style: { ...element.style, ...partial } })
  }

  function patchButton(partial: Partial<ChannelStripElement['refs']['button']>) {
    patch({ refs: { ...element.refs, button: { ...element.refs.button, ...partial } } })
  }

  const { style, refs } = element

  return (
    <>
      {/* ── Refs ───────────────────────────────────────────── */}
      <div style={sectionTitle}>Refs</div>

      <div style={row}>
        <span style={lbl}>Button (Main)</span>
        <span style={{ fontSize: 11, color: '#4a9eff', fontFamily: "'JetBrains Mono', monospace" }}>
          {refLabel(refs.button.ref)}
        </span>
      </div>

      <div style={row}>
        <span style={lbl}>Solo (optional)</span>
        <span style={{ fontSize: 11, color: refs.solo ? '#4a9eff' : '#4a5568', fontFamily: "'JetBrains Mono', monospace" }}>
          {refLabel(refs.solo)}
        </span>
      </div>

      <div style={row}>
        <span style={lbl}>Pan (optional)</span>
        <span style={{ fontSize: 11, color: refs.pan ? '#4a9eff' : '#4a5568', fontFamily: "'JetBrains Mono', monospace" }}>
          {refLabel(refs.pan)}
        </span>
      </div>

      {/* ── Text-Parsing ────────────────────────────────────── */}
      <div style={sectionTitle}>Text-Parsing</div>

      <div style={row}>
        <span style={lbl}>Separator</span>
        <input
          style={{ ...inputStyle, maxWidth: 50 }}
          value={refs.button.textSeparator ?? '|'}
          onChange={(e) => patchButton({ textSeparator: e.target.value })}
        />
      </div>

      <NumericInput label="Meter L Index" value={refs.button.meterLIndex ?? 0} min={0}
        onChange={(v) => patchButton({ meterLIndex: v })} />

      <div style={row}>
        <span style={lbl}>Meter R Index</span>
        <input
          type="number" min={0}
          style={{ ...inputStyle, maxWidth: 60 }}
          value={refs.button.meterRIndex ?? ''}
          placeholder="—"
          onChange={(e) => {
            const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10)
            patchButton({ meterRIndex: v })
          }}
        />
      </div>

      <div style={row}>
        <span style={lbl}>Level Index</span>
        <input
          type="number" min={0}
          style={{ ...inputStyle, maxWidth: 60 }}
          value={refs.button.levelIndex ?? ''}
          placeholder="—"
          onChange={(e) => {
            const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10)
            patchButton({ levelIndex: v })
          }}
        />
      </div>

      <div style={row}>
        <span style={lbl}>Name Index</span>
        <input
          type="number" min={0}
          style={{ ...inputStyle, maxWidth: 60 }}
          value={refs.button.nameIndex ?? ''}
          placeholder="—"
          onChange={(e) => {
            const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10)
            patchButton({ nameIndex: v })
          }}
        />
      </div>

      {/* ── Style ───────────────────────────────────────────── */}
      <div style={sectionTitle}>Style</div>

      <div style={row}>
        <span style={lbl}>Stripe Color</span>
        <ColorPicker value={style.color} onChange={(c) => patchStyle({ color: c })} />
      </div>

      <div style={row}>
        <span style={lbl}>Name (Fallback)</span>
        <input
          style={inputStyle}
          value={style.name ?? ''}
          placeholder="Channel"
          onChange={(e) => patchStyle({ name: e.target.value || undefined })}
        />
      </div>

      <div style={row}>
        <span style={lbl}>Mono</span>
        <input
          type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }}
          checked={style.mono === true}
          onChange={(e) => patchStyle({ mono: e.target.checked || undefined })}
        />
      </div>

      <NumericInput label="Clip Threshold (dBFS)" value={style.clipThreshold ?? 0} min={-60}
        onChange={(v) => patchStyle({ clipThreshold: Math.min(0, v) })} />

      <NumericInput label="Coarse Multiplier" value={style.coarseMultiplier ?? 10} min={1}
        onChange={(v) => patchStyle({ coarseMultiplier: Math.min(100, v) })} />
    </>
  )
}

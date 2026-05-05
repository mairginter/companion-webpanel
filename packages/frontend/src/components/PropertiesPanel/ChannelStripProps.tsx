/**
 * ChannelStripProps.tsx
 *
 * Properties Panel Section für das ChannelStrip-Element.
 * Sections: Refs (mit Button-Picker), Text-Parsing, Style
 */
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { ChannelStripElement, CompanionRef } from '@cwp/shared'
import { useAppStore } from '../../store/useAppStore'
import { ColorPicker } from './ColorPicker'
import { CompanionButtonPickerDialog } from '../AddElement/CompanionButtonPickerDialog'

interface Props {
  element: ChannelStripElement
  panelId: string
  side?: 'left' | 'right'
  panelWidth?: number
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
const inputNum: React.CSSProperties = {
  background: '#121821', border: '1px solid #2a3344', borderRadius: 4,
  color: '#e9edf2', fontSize: 13, padding: '4px 8px', maxWidth: 60,
}
const pickerBtn = (connected: boolean): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 6, border: '1px solid #2a3344',
  background: '#1a2030', color: connected ? '#4a9eff' : '#4a5568', fontSize: 12,
  cursor: connected ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', flexShrink: 0,
})

function refLabel(ref: CompanionRef | undefined): string {
  if (!ref) return '—'
  return `P${ref.page} · R${ref.row}/C${ref.col}`
}

export function ChannelStripProps({ element, panelId, side = 'right', panelWidth = 320 }: Props) {
  const { t } = useTranslation()
  const updateElement = useAppStore((s) => s.updateElement)
  const settings = useAppStore((s) => s.settings)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const [pickerTarget, setPickerTarget] = useState<'button' | 'solo' | 'pan' | null>(null)

  function patch(partial: Partial<ChannelStripElement>) {
    updateElement(panelId, element.id, partial)
  }

  function patchStyle(partial: Partial<ChannelStripElement['style']>) {
    patch({ style: { ...element.style, ...partial } })
  }

  function patchButton(partial: Partial<ChannelStripElement['refs']['button']>) {
    patch({ refs: { ...element.refs, button: { ...element.refs.button, ...partial } } })
  }

  const handlePickerConfirm = (refs: CompanionRef[]) => {
    if (refs.length === 0) return
    const ref = refs[0]
    if (pickerTarget === 'button') patchButton({ ref })
    else if (pickerTarget === 'solo') patch({ refs: { ...element.refs, solo: ref } })
    else if (pickerTarget === 'pan') patch({ refs: { ...element.refs, pan: ref } })
    setPickerTarget(null)
  }

  const { style, refs } = element
  const buttonConnected = sessionStatus[refs.button.ref.hostId] === 'connected'

  return (
    <>
      {/* ── Refs ───────────────────────────────────────────── */}
      <div style={sectionTitle}>{t('propertiesPanel.refs')}</div>

      {/* Button (Main) */}
      <div style={{ ...row, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <span style={lbl}>Button (Main) — {refLabel(refs.button.ref)}</span>
        <button
          style={pickerBtn(buttonConnected)}
          disabled={!buttonConnected}
          onClick={() => buttonConnected && setPickerTarget('button')}
        >
          {buttonConnected ? t('propertiesPanel.change') : t('propertiesPanel.hostOffline')}
        </button>
      </div>

      {/* Solo */}
      <div style={{ ...row, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <span style={lbl}>Solo (optional) — {refLabel(refs.solo)}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={pickerBtn(buttonConnected)}
            disabled={!buttonConnected}
            onClick={() => buttonConnected && setPickerTarget('solo')}
          >
            {buttonConnected ? (refs.solo ? t('propertiesPanel.change') : t('propertiesPanel.selectBtn')) : t('propertiesPanel.hostOffline')}
          </button>
          {refs.solo && (
            <button
              style={{ ...pickerBtn(true), color: '#ff5a5f' }}
              onClick={() => patch({ refs: { ...element.refs, solo: undefined } })}
            >
              {t('propertiesPanel.remove')}
            </button>
          )}
        </div>
      </div>

      {/* Pan */}
      <div style={{ ...row, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <span style={lbl}>Pan (optional) — {refLabel(refs.pan)}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={pickerBtn(buttonConnected)}
            disabled={!buttonConnected}
            onClick={() => buttonConnected && setPickerTarget('pan')}
          >
            {buttonConnected ? (refs.pan ? t('propertiesPanel.change') : t('propertiesPanel.selectBtn')) : t('propertiesPanel.hostOffline')}
          </button>
          {refs.pan && (
            <button
              style={{ ...pickerBtn(true), color: '#ff5a5f' }}
              onClick={() => patch({ refs: { ...element.refs, pan: undefined } })}
            >
              {t('propertiesPanel.remove')}
            </button>
          )}
        </div>
      </div>

      {/* ── Text-Parsing ────────────────────────────────────── */}
      <div style={sectionTitle}>{t('propertiesPanel.textParsing')}</div>

      {/* Index explanation */}
      <div style={{ padding: '2px 14px 6px', fontSize: 11, color: '#4a9eff', fontFamily: "'JetBrains Mono', monospace" }}>
        {t('propertiesPanel.textParsingIndexHint')}
      </div>

      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.separator')}</span>
        <input
          style={{ ...inputStyle, maxWidth: 50 }}
          value={refs.button.textSeparator ?? '|'}
          onChange={(e) => patchButton({ textSeparator: e.target.value })}
        />
      </div>

      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.meterLIndex')}</span>
        <input
          type="number" min={0}
          style={inputNum}
          value={refs.button.meterLIndex ?? 0}
          onChange={(e) => patchButton({ meterLIndex: Math.max(0, parseInt(e.target.value, 10) || 0) })}
        />
      </div>

      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.meterRIndex')} {t('propertiesPanel.meterRMono')}</span>
        <input
          type="number" min={0}
          style={inputNum}
          value={refs.button.meterRIndex ?? ''}
          placeholder={t('propertiesPanel.emptyOptional')}
          onChange={(e) => {
            const v = e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10))
            patchButton({ meterRIndex: v })
          }}
        />
      </div>

      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.faderLevelIndex')}</span>
        <input
          type="number" min={0}
          style={inputNum}
          value={refs.button.levelIndex ?? ''}
          placeholder={t('propertiesPanel.emptyOptional')}
          onChange={(e) => {
            const v = e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10))
            patchButton({ levelIndex: v })
          }}
        />
      </div>

      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.channelNameIndex')}</span>
        <input
          type="number" min={0}
          style={inputNum}
          value={refs.button.nameIndex ?? ''}
          placeholder={t('propertiesPanel.emptyOptional')}
          onChange={(e) => {
            const v = e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10))
            patchButton({ nameIndex: v })
          }}
        />
      </div>

      {/* ── Style ───────────────────────────────────────────── */}
      <div style={sectionTitle}>{t('propertiesPanel.style')}</div>

      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.accentColor')}</span>
        <ColorPicker value={style.color} onChange={(c) => patchStyle({ color: c })} />
      </div>

      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.channelName')}</span>
        <input
          style={inputStyle}
          value={style.name ?? ''}
          placeholder="Channel"
          onChange={(e) => patchStyle({ name: e.target.value || undefined })}
        />
      </div>

      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.monoMode')}</span>
        <input
          type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }}
          checked={style.mono === true}
          onChange={(e) => patchStyle({ mono: e.target.checked || undefined })}
        />
      </div>

      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.invertMute')}</span>
        <input
          type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }}
          checked={style.invertMute === true}
          onChange={(e) => patchStyle({ invertMute: e.target.checked || undefined })}
        />
      </div>

      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.clipThreshold')}</span>
        <input
          key={`clip-${element.id}`}
          type="number"
          style={inputNum}
          defaultValue={style.clipThreshold ?? 0}
          onBlur={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) patchStyle({ clipThreshold: v })
          }}
        />
      </div>

      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.coarseMultiplier')}</span>
        <input
          type="number" min={1} max={100}
          style={inputNum}
          value={style.coarseMultiplier ?? 10}
          onChange={(e) => patchStyle({ coarseMultiplier: Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
        />
      </div>

      <div style={row}>
        <span style={lbl}>{t('propertiesPanel.showWheel')}</span>
        <input
          type="checkbox" style={{ width: 20, height: 20, cursor: 'pointer' }}
          checked={style.showWheel !== false}
          onChange={(e) => patchStyle({ showWheel: e.target.checked ? undefined : false })}
        />
      </div>

      {/* Button Picker — per Portal direkt in document.body */}
      {pickerTarget && createPortal(
        <CompanionButtonPickerDialog
          onConfirm={handlePickerConfirm}
          onClose={() => setPickerTarget(null)}
          alignSide={side}
          panelWidth={panelWidth}
          initialGridCols={
            settings?.hosts.find((h) => h.id === refs.button.ref.hostId)?.gridCols
          }
          initialGridRows={
            settings?.hosts.find((h) => h.id === refs.button.ref.hostId)?.gridRows
          }
        />,
        document.body,
      )}
    </>
  )
}

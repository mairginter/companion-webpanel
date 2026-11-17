/**
 * ChannelStripWizard.tsx
 *
 * 5-Schritt-Setup-Wizard für das ChannelStrip-Element.
 * Schritt 1: Haupt-Button wählen (Button Picker)
 * Schritt 2: Text-Variablen konfigurieren (Separator + Index-Mapping)
 * Schritt 3: Optionale Refs (Solo, Pan)
 * Schritt 4: Style (Farbe, Mono, Schwellenwerte)
 * Schritt 5: Zusammenfassung + Fertig
 *
 * Bei Fertig: onConfirm wird mit dem fertigen ChannelStripElement-Draft aufgerufen.
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ChannelStripElement, CompanionRef } from '@cwp/shared'
import { CompanionButtonPickerDialog } from './CompanionButtonPickerDialog'
import { ColorPicker } from '../PropertiesPanel/ColorPicker'
import { parseChannelStripText } from '../../utils/channelStrip'
import { useAppStore } from '../../store/useAppStore'

interface Props {
  canvasPos: { x: number; y: number }
  onConfirm: (element: Omit<ChannelStripElement, 'id'>) => void
  onClose: () => void
}

const overlay: React.CSSProperties = {
  // zIndex 1050: unterhalb des CompanionButtonPickerDialogs (zIndex 1100),
  // damit der Picker sichtbar über dem Wizard-Overlay liegt
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1050,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const modal: React.CSSProperties = {
  background: '#121821', border: '1px solid #2a3344', borderRadius: 12,
  width: 620, maxWidth: '96vw', maxHeight: '88vh', padding: '0 0 20px',
  boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
  display: 'flex', flexDirection: 'column', gap: 0,
}
const header: React.CSSProperties = {
  padding: '16px 20px 12px',
  borderBottom: '1px solid #1e2535',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}
const stepIndicator = (active: boolean): React.CSSProperties => ({
  width: 8, height: 8, borderRadius: '50%',
  background: active ? '#4a9eff' : '#2a3344',
  transition: 'background 0.2s',
})
const body: React.CSSProperties = { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1 }
const footer: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '0 20px' }
const btnPrimary: React.CSSProperties = {
  background: '#4a9eff', border: 'none', borderRadius: 6, color: '#fff',
  fontSize: 13, fontWeight: 600, padding: '8px 20px', cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = {
  background: 'transparent', border: '1px solid #2a3344', borderRadius: 6, color: '#8896aa',
  fontSize: 13, padding: '8px 20px', cursor: 'pointer',
}
const infoBox: React.CSSProperties = {
  background: '#0f141a', border: '1px solid #1e2535', borderRadius: 6,
  padding: '10px 12px', fontSize: 12, color: '#8896aa', lineHeight: 1.6,
}
const fieldRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const fieldLbl: React.CSSProperties = { fontSize: 12, color: '#8896aa', flex: 1 }
const fieldInput: React.CSSProperties = {
  background: '#0f141a', border: '1px solid #2a3344', borderRadius: 4,
  color: '#e9edf2', fontSize: 13, padding: '4px 8px', width: 60,
}

export function ChannelStripWizard({ canvasPos, onConfirm, onClose }: Props) {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const [step, setStep] = useState(1)
  const [pickerTarget, setPickerTarget] = useState<'button' | 'solo' | 'pan' | null>(null)

  const [buttonRef, setButtonRef] = useState<CompanionRef | null>(null)
  const [separator, setSeparator] = useState('|')
  const [meterLIndex, setMeterLIndex] = useState(0)
  const [meterRIndex, setMeterRIndex] = useState<number | undefined>(1)
  const [levelIndex, setLevelIndex] = useState<number | undefined>(2)
  const [nameIndex, setNameIndex] = useState<number | undefined>(3)
  const [soloRef, setSoloRef] = useState<CompanionRef | undefined>(undefined)
  const [panRef, setPanRef] = useState<CompanionRef | undefined>(undefined)
  const [color, setColor] = useState('#4a9eff')
  const [name, setName] = useState('')
  const [mono, setMono] = useState(false)
  const [invertMute, setInvertMute] = useState(false)
  const [clipThreshold, setClipThreshold] = useState(0)
  const [coarseMultiplier, setCoarseMultiplier] = useState(10)

  // Live preview of parsed text (Step 2)
  const buttonState = useAppStore((s) =>
    buttonRef ? s.getButtonState(buttonRef.hostId, buttonRef.page, buttonRef.row, buttonRef.col) : undefined
  )
  const parsedPreview = buttonRef
    ? parseChannelStripText(buttonState?.text ?? '', separator, { meterLIndex, meterRIndex, levelIndex, nameIndex })
    : null

  const handleConfirm = () => {
    if (!buttonRef) return
    const draft: Omit<ChannelStripElement, 'id'> = {
      type: 'channelStrip',
      x: canvasPos.x, y: canvasPos.y, w: 130, h: 500, z: 0,
      style: { color, name: name || undefined, mono: mono || undefined, clipThreshold, coarseMultiplier, invertMute: invertMute || undefined },
      refs: {
        button: { ref: buttonRef, textSeparator: separator, meterLIndex, meterRIndex, levelIndex, nameIndex },
        solo: soloRef,
        pan: panRef,
      },
    }
    onConfirm(draft)
  }

  // Schritt-Titel (Index = Schrittnummer, 0 unbenutzt)
  const TITLES = [
    '',
    t('channelStripWizard.stepButton'),
    t('channelStripWizard.stepText'),
    t('channelStripWizard.stepRefs'),
    t('channelStripWizard.stepStyle'),
    t('channelStripWizard.stepSummary'),
  ]

  return (
    <>
      <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div style={modal}>
          {/* Header */}
          <div style={header}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#e9edf2' }}>
                {t('channelStripWizard.title')}
              </div>
              <div style={{ fontSize: 12, color: '#8896aa', marginTop: 2 }}>
                {t('channelStripWizard.stepOf', { step, total: 5, title: TITLES[step] })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[1,2,3,4,5].map((s) => <div key={s} style={stepIndicator(s === step)} />)}
              <button onClick={onClose} style={{ ...btnSecondary, padding: '4px 8px', marginLeft: 8 }}>✕</button>
            </div>
          </div>

          {/* Step 1: Button Picker */}
          {step === 1 && (
            <div style={body}>
              <div style={infoBox}>
                <strong style={{ color: '#e9edf2' }}>{t('channelStripWizard.intro')}</strong>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>
                    <span style={{ color: '#ff5a5f', fontWeight: 600 }}>▶ Press-Action</span>
                    {' '}{t('channelStripWizard.pressDesc')}<br />
                    <span style={{ color: '#8896aa', fontSize: 11 }}>
                      vMix: <code>Input Mute</code> · Wing: <code>Ch Mute Toggle</code> · X32: <code>Channel Mute Toggle</code>
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#4a9eff', fontWeight: 600 }}>↻ Rotate-Action</span>
                    {' '}{t('channelStripWizard.rotateDesc')}<br />
                    <span style={{ color: '#8896aa', fontSize: 11 }}>
                      vMix: <code>Input Volume Adjust</code> ({t('channelStripWizard.stepHint')}) · Wing: <code>Ch Fader Adjust</code> · X32: <code>Channel Fader Adjust</code>
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#21d07a', fontWeight: 600 }}>■ Feedback bgColor</span>
                    {' '}{t('channelStripWizard.feedbackDesc')}<br />
                    <span style={{ color: '#8896aa', fontSize: 11 }}>
                      vMix: <code>Input Is Muted</code> ({t('channelStripWizard.colorWhenActive')}) · Wing/X32: <code>Mute Active</code> Feedback
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#ff8a3d', fontWeight: 600 }}>{t('channelStripWizard.textVar')}</span>
                    {' '}{t('channelStripWizard.textVarDesc')}<br />
                    <span style={{ color: '#8896aa', fontSize: 11 }}>
                      {t('channelStripWizard.textVarNext')}
                    </span>
                  </div>
                </div>
              </div>

              {/* vMix Beispiel */}
              <div style={{ ...infoBox, borderColor: '#1e3a5a' }}>
                <div style={{ color: '#4a9eff', fontWeight: 600, marginBottom: 4, fontSize: 11 }}>{t('channelStripWizard.example', { name: 'vMix' })}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#8896aa', lineHeight: 1.8 }}>
                  Text: <code style={{ color: '#e9edf2' }}>$(vmix:input_1_meterf1)|$(vmix:input_1_meterf2)|$(vmix:input_1_volume)|$(vmix:input_1_short_title)</code><br />
                  → Index 0 = Meter L (dB) · 1 = Meter R · 2 = Volume (0–100) · 3 = Name
                </div>
              </div>

              {/* Wing Beispiel */}
              <div style={{ ...infoBox, borderColor: '#1e3a2a' }}>
                <div style={{ color: '#21d07a', fontWeight: 600, marginBottom: 4, fontSize: 11 }}>{t('channelStripWizard.example', { name: 'Behringer Wing / X32' })}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#8896aa', lineHeight: 1.8 }}>
                  Text: <code style={{ color: '#e9edf2' }}>$(wing:ch1_meter_l)|$(wing:ch1_meter_r)|$(wing:ch1_fader_db)|$(wing:ch1_name)</code><br />
                  → Index 0 = Meter L · 1 = Meter R · 2 = Fader dB · 3 = Channel Name<br />
                  X32: <code style={{ color: '#e9edf2' }}>$(x32:ch01_meter_l)|$(x32:ch01_meter_r)|$(x32:ch01_fader_db)</code>
                </div>
              </div>

              <div style={{ color: '#8896aa', fontSize: 11 }}>
                {t('channelStripWizard.tip')}
              </div>

              <button
                style={{ ...btnPrimary, alignSelf: 'flex-start' }}
                onClick={() => setPickerTarget('button')}
              >
                {buttonRef ? `✓ Button: ${buttonRef.page}/${buttonRef.row}/${buttonRef.col}` : t('channelStripWizard.chooseButton')}
              </button>
              {buttonRef && (
                <div style={{ fontSize: 12, color: '#21d07a' }}>Host: {buttonRef.hostId}</div>
              )}
            </div>
          )}

          {/* Step 2: Text Variables */}
          {step === 2 && (
            <div style={body}>
              {/* Index explanation */}
              <div style={infoBox}>
                <strong style={{ color: '#e9edf2' }}>{t('channelStripWizard.indexTitle')}</strong>
                <div style={{ marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#8896aa' }}>
                  {t('channelStripWizard.textField')}{' '}
                  <code style={{ color: '#e9edf2' }}>
                    {[0, 1, 2, 3].map((i) => `${t('channelStripWizard.valueWord')}${i}`).join(separator)}
                  </code><br />
                  <span style={{ color: '#4a9eff' }}>Index 0</span> {t('channelStripWizard.indexFirst')} · <span style={{ color: '#4a9eff' }}>1</span> {t('channelStripWizard.indexSecond')}
                </div>
              </div>

              <div style={fieldRow}>
                <span style={fieldLbl}>{t('propertiesPanel.separator')}</span>
                <input
                  style={{ ...fieldInput, width: 60 }}
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                />
              </div>

              {parsedPreview && buttonState?.text && (
                <div style={{ ...infoBox, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                  <strong style={{ color: '#e9edf2' }}>{t('channelStripWizard.livePreview')}</strong><br />
                  {buttonState.text.split(separator).map((v, i) => (
                    <span key={i} style={{ marginRight: 8 }}>
                      <span style={{ color: '#4a9eff' }}>[{i}]</span>{' '}
                      <span style={{ color: '#e9edf2' }}>{v.trim() || '—'}</span>
                    </span>
                  ))}<br />
                  <span style={{ color: '#8896aa', fontSize: 10, marginTop: 4, display: 'block' }}>
                    Meter L: {parsedPreview.meterL?.toFixed(1) ?? '—'} ·
                    Meter R: {parsedPreview.meterR?.toFixed(1) ?? '—'} ·
                    Level: {parsedPreview.level?.toFixed(1) ?? '—'} ·
                    Name: {parsedPreview.name ?? '—'}
                  </span>
                </div>
              )}

              <div style={fieldRow}>
                <span style={fieldLbl}>{t('channelStripWizard.meterL')}</span>
                <input type="number" min={0} style={fieldInput}
                  value={meterLIndex}
                  onChange={(e) => setMeterLIndex(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
              </div>
              <div style={fieldRow}>
                <span style={fieldLbl}>{t('channelStripWizard.meterR')}</span>
                <input type="number" min={0} placeholder={t('propertiesPanel.emptyOptional')} value={meterRIndex ?? ''}
                  style={fieldInput}
                  onChange={(e) => setMeterRIndex(e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10)))}
                />
              </div>
              <div style={fieldRow}>
                <span style={fieldLbl}>{t('channelStripWizard.level')}</span>
                <input type="number" min={0} placeholder={t('propertiesPanel.emptyOptional')} value={levelIndex ?? ''}
                  style={fieldInput}
                  onChange={(e) => setLevelIndex(e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10)))}
                />
              </div>
              <div style={fieldRow}>
                <span style={fieldLbl}>{t('channelStripWizard.name')}</span>
                <input type="number" min={0} placeholder={t('propertiesPanel.emptyOptional')} value={nameIndex ?? ''}
                  style={fieldInput}
                  onChange={(e) => setNameIndex(e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10)))}
                />
              </div>
            </div>
          )}

          {/* Step 3: Optional Refs */}
          {step === 3 && (
            <div style={body}>
              <div>
                <div style={{ fontSize: 12, color: '#8896aa', marginBottom: 6 }}>{t('channelStripWizard.soloLabel')}</div>
                <button style={{ ...btnSecondary, fontSize: 12 }} onClick={() => setPickerTarget('solo')}>
                  {soloRef ? `Solo: ${soloRef.page}/${soloRef.row}/${soloRef.col}` : t('channelStripWizard.chooseSolo')}
                </button>
                {soloRef && (
                  <button style={{ ...btnSecondary, fontSize: 11, marginLeft: 8 }} onClick={() => setSoloRef(undefined)}>
                    {t('addElement.remove')}
                  </button>
                )}
                <div style={{ ...infoBox, marginTop: 8 }}>{t('channelStripWizard.soloHint')}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#8896aa', marginBottom: 6 }}>{t('channelStripWizard.panLabel')}</div>
                <button style={{ ...btnSecondary, fontSize: 12 }} onClick={() => setPickerTarget('pan')}>
                  {panRef ? `Pan: ${panRef.page}/${panRef.row}/${panRef.col}` : t('channelStripWizard.choosePan')}
                </button>
                {panRef && (
                  <button style={{ ...btnSecondary, fontSize: 11, marginLeft: 8 }} onClick={() => setPanRef(undefined)}>
                    {t('addElement.remove')}
                  </button>
                )}
                <div style={{ ...infoBox, marginTop: 8 }}>
                  {t('channelStripWizard.panHint')}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Style */}
          {step === 4 && (
            <div style={body}>
              <div style={fieldRow}>
                <span style={fieldLbl}>{t('channelStripWizard.stripeColor')}</span>
                <ColorPicker value={color} onChange={setColor} />
              </div>
              <div style={fieldRow}>
                <span style={fieldLbl}>{t('channelStripWizard.nameFallback')}</span>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={t('channelStripWizard.namePlaceholder')}
                  style={{ ...fieldInput, width: 'auto', flex: 1 }}
                />
              </div>
              <div style={fieldRow}>
                <span style={fieldLbl}>{t('propertiesPanel.monoMode')}</span>
                <input type="checkbox" style={{ width: 20, height: 20 }} checked={mono} onChange={(e) => setMono(e.target.checked)} />
              </div>
              <div style={fieldRow}>
                <span style={fieldLbl}>{t('propertiesPanel.invertMute')}</span>
                <input type="checkbox" style={{ width: 20, height: 20 }} checked={invertMute} onChange={(e) => setInvertMute(e.target.checked)} />
              </div>
              <div style={{ ...infoBox, fontSize: 11, color: '#6a7a8a' }}>
                {t('channelStripWizard.invertMuteHint')}
              </div>
              <div style={fieldRow}>
                <span style={fieldLbl}>{t('propertiesPanel.clipThreshold')}</span>
                <input
                  type="number"
                  style={fieldInput}
                  defaultValue={clipThreshold}
                  key="clip"
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v)) setClipThreshold(v)
                  }}
                />
              </div>
              <div style={fieldRow}>
                <span style={fieldLbl}>{t('channelStripWizard.coarse')}</span>
                <input type="number" min={1} max={100} style={fieldInput}
                  value={coarseMultiplier}
                  onChange={(e) => setCoarseMultiplier(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                />
              </div>
              <div style={infoBox}>
                {t('channelStripWizard.coarseHint', { n: coarseMultiplier })}
              </div>
            </div>
          )}

          {/* Step 5: Summary */}
          {step === 5 && (
            <div style={body}>
              <div style={{ ...infoBox, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div><strong style={{ color: '#e9edf2' }}>Button:</strong> {buttonRef ? `${buttonRef.page}/${buttonRef.row}/${buttonRef.col}` : '—'}</div>
                <div><strong style={{ color: '#e9edf2' }}>{t('propertiesPanel.separator')}:</strong> "{separator}"</div>
                <div><strong style={{ color: '#e9edf2' }}>Meter L/R:</strong> Index {meterLIndex} / {meterRIndex ?? '—'}</div>
                <div><strong style={{ color: '#e9edf2' }}>Level:</strong> Index {levelIndex ?? '—'}</div>
                <div><strong style={{ color: '#e9edf2' }}>Name:</strong> Index {nameIndex ?? '—'} (Fallback: "{name || '—'}")</div>
                <div><strong style={{ color: '#e9edf2' }}>Solo:</strong> {soloRef ? `${soloRef.page}/${soloRef.row}/${soloRef.col}` : '—'}</div>
                <div><strong style={{ color: '#e9edf2' }}>Pan:</strong> {panRef ? `${panRef.page}/${panRef.row}/${panRef.col}` : '—'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ color: '#e9edf2' }}>{t('channelStripWizard.stripeColor')}:</strong>
                  <div style={{ width: 16, height: 16, borderRadius: 3, background: color, border: '1px solid #2a3344' }} />
                  {color}
                </div>
                <div>
                  <strong style={{ color: '#e9edf2' }}>Mono:</strong> {mono ? t('addElement.yes') : t('addElement.no')}{' '}·{' '}
                  <strong style={{ color: '#e9edf2' }}>Clip:</strong> {clipThreshold} dBFS{' '}·{' '}
                  <strong style={{ color: '#e9edf2' }}>Coarse:</strong> {coarseMultiplier}×
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={footer}>
            <button style={btnSecondary} onClick={() => step > 1 ? setStep(step - 1) : onClose()}>
              {step === 1 ? t('addElement.cancel') : `← ${t('addElement.back')}`}
            </button>
            {step < 5 ? (
              <button
                style={{ ...btnPrimary, opacity: step === 1 && !buttonRef ? 0.5 : 1 }}
                disabled={step === 1 && !buttonRef}
                onClick={() => setStep(step + 1)}
              >
                {t('addElement.next')} →
              </button>
            ) : (
              <button style={btnPrimary} onClick={handleConfirm}>
                {t('channelStripWizard.finish')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Button Picker (Schritt 1, 3) — per Portal direkt in document.body, kein Stacking-Context-Problem */}
      {pickerTarget && createPortal(
        <CompanionButtonPickerDialog
          onConfirm={(refs) => {
            if (refs.length === 0) return
            const ref = refs[0]
            if (pickerTarget === 'button') setButtonRef(ref)
            else if (pickerTarget === 'solo') setSoloRef(ref)
            else if (pickerTarget === 'pan') setPanRef(ref)
            setPickerTarget(null)
          }}
          onClose={() => setPickerTarget(null)}
          initialGridCols={
            settings?.hosts.find((h) => h.id === (buttonRef?.hostId ?? settings?.hosts[0]?.id))?.gridCols
          }
          initialGridRows={
            settings?.hosts.find((h) => h.id === (buttonRef?.hostId ?? settings?.hosts[0]?.id))?.gridRows
          }
        />,
        document.body,
      )}
    </>
  )
}

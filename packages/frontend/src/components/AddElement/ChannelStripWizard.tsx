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
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const modal: React.CSSProperties = {
  background: '#121821', border: '1px solid #2a3344', borderRadius: 12,
  width: 420, maxWidth: '90vw', padding: '0 0 20px',
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
const body: React.CSSProperties = { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }
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
  const [step, setStep] = useState(1)
  const [pickerTarget, setPickerTarget] = useState<'button' | 'solo' | 'pan' | null>(null)

  const [buttonRef, setButtonRef] = useState<CompanionRef | null>(null)
  const [separator, setSeparator] = useState('|')
  const [meterLIndex, setMeterLIndex] = useState(0)
  const [meterRIndex, setMeterRIndex] = useState<number | undefined>(undefined)
  const [levelIndex, setLevelIndex] = useState<number | undefined>(undefined)
  const [nameIndex, setNameIndex] = useState<number | undefined>(undefined)
  const [soloRef, setSoloRef] = useState<CompanionRef | undefined>(undefined)
  const [panRef, setPanRef] = useState<CompanionRef | undefined>(undefined)
  const [color, setColor] = useState('#4a9eff')
  const [name, setName] = useState('')
  const [mono, setMono] = useState(false)
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
      x: canvasPos.x, y: canvasPos.y, w: 80, h: 240, z: 0,
      style: { color, name: name || undefined, mono: mono || undefined, clipThreshold, coarseMultiplier },
      refs: {
        button: { ref: buttonRef, textSeparator: separator, meterLIndex, meterRIndex, levelIndex, nameIndex },
        solo: soloRef,
        pan: panRef,
      },
    }
    onConfirm(draft)
  }

  const TITLES = ['', 'Haupt-Button', 'Text-Variablen', 'Optionale Refs', 'Style', 'Zusammenfassung']

  return (
    <>
      <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div style={modal}>
          {/* Header */}
          <div style={header}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#e9edf2' }}>
                Channel Strip einrichten
              </div>
              <div style={{ fontSize: 12, color: '#8896aa', marginTop: 2 }}>
                Schritt {step} von 5 — {TITLES[step]}
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
                Wähle den Button der Mute, Fader-Control und Messwerte enthält.<br />
                In Companion konfigurieren: <strong>Press</strong> = Mute-Action,{' '}
                <strong>Rotate</strong> = Fader-Action,{' '}
                <strong>Text-Feld</strong> = Variablen (z.B. <code>$(vmix:input_1_meterf1)|$(vmix:input_1_volume_db)</code>).
              </div>
              <button
                style={{ ...btnPrimary, alignSelf: 'flex-start' }}
                onClick={() => setPickerTarget('button')}
              >
                {buttonRef ? `Button: ${buttonRef.page}/${buttonRef.row}/${buttonRef.col}` : 'Button wählen...'}
              </button>
              {buttonRef && (
                <div style={{ fontSize: 12, color: '#21d07a' }}>✓ Host: {buttonRef.hostId}</div>
              )}
            </div>
          )}

          {/* Step 2: Text Variables */}
          {step === 2 && (
            <div style={body}>
              <div style={fieldRow}>
                <span style={fieldLbl}>Separator</span>
                <input
                  style={{ ...fieldInput, width: 60 }}
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                />
              </div>
              {parsedPreview && (
                <div style={{ ...infoBox, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                  <strong style={{ color: '#e9edf2' }}>Live-Vorschau:</strong><br />
                  Meter L: {parsedPreview.meterL ?? '—'}{' '}
                  Meter R: {parsedPreview.meterR ?? '—'}{' '}
                  Level: {parsedPreview.level ?? '—'}{' '}
                  Name: {parsedPreview.name ?? '—'}
                </div>
              )}
              <div style={fieldRow}>
                <span style={fieldLbl}>Meter L Index</span>
                <input type="number" min={0} style={fieldInput}
                  value={meterLIndex}
                  onChange={(e) => setMeterLIndex(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div style={fieldRow}>
                <span style={fieldLbl}>Meter R Index (optional)</span>
                <input type="number" min={0} placeholder="—" value={meterRIndex ?? ''}
                  style={fieldInput}
                  onChange={(e) => setMeterRIndex(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                />
              </div>
              <div style={fieldRow}>
                <span style={fieldLbl}>Fader Level Index (optional)</span>
                <input type="number" min={0} placeholder="—" value={levelIndex ?? ''}
                  style={fieldInput}
                  onChange={(e) => setLevelIndex(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                />
              </div>
              <div style={fieldRow}>
                <span style={fieldLbl}>Name Index (optional)</span>
                <input type="number" min={0} placeholder="—" value={nameIndex ?? ''}
                  style={fieldInput}
                  onChange={(e) => setNameIndex(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                />
              </div>
            </div>
          )}

          {/* Step 3: Optional Refs */}
          {step === 3 && (
            <div style={body}>
              <div>
                <div style={{ fontSize: 12, color: '#8896aa', marginBottom: 6 }}>Solo-Button (optional)</div>
                <button style={{ ...btnSecondary, fontSize: 12 }} onClick={() => setPickerTarget('solo')}>
                  {soloRef ? `Solo: ${soloRef.page}/${soloRef.row}/${soloRef.col}` : 'Solo-Button wählen...'}
                </button>
                {soloRef && (
                  <button style={{ ...btnSecondary, fontSize: 11, marginLeft: 8 }} onClick={() => setSoloRef(undefined)}>
                    entfernen
                  </button>
                )}
                <div style={{ ...infoBox, marginTop: 8 }}>Ohne Solo-Button: Solo-Taste ausgegraut</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#8896aa', marginBottom: 6 }}>Pan-Button (optional)</div>
                <button style={{ ...btnSecondary, fontSize: 12 }} onClick={() => setPickerTarget('pan')}>
                  {panRef ? `Pan: ${panRef.page}/${panRef.row}/${panRef.col}` : 'Pan-Button wählen...'}
                </button>
                {panRef && (
                  <button style={{ ...btnSecondary, fontSize: 11, marginLeft: 8 }} onClick={() => setPanRef(undefined)}>
                    entfernen
                  </button>
                )}
                <div style={{ ...infoBox, marginTop: 8 }}>
                  Pan aus Text-Variable, z.B. <code>$(vmix:input_1_pan)</code>. Formate: L20, R10, C, -0.5
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Style */}
          {step === 4 && (
            <div style={body}>
              <div style={fieldRow}>
                <span style={fieldLbl}>Stripe-Farbe</span>
                <ColorPicker value={color} onChange={setColor} />
              </div>
              <div style={fieldRow}>
                <span style={fieldLbl}>Channel-Name (Fallback)</span>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="z.B. Guitar"
                  style={{ ...fieldInput, width: 'auto', flex: 1 }}
                />
              </div>
              <div style={fieldRow}>
                <span style={fieldLbl}>Mono-Modus</span>
                <input type="checkbox" style={{ width: 20, height: 20 }} checked={mono} onChange={(e) => setMono(e.target.checked)} />
              </div>
              <div style={fieldRow}>
                <span style={fieldLbl}>Clip-Schwellenwert (dBFS)</span>
                <input type="number" min={-60} max={0} style={fieldInput}
                  value={clipThreshold}
                  onChange={(e) => setClipThreshold(Math.min(0, Math.max(-60, parseInt(e.target.value, 10) || 0)))}
                />
              </div>
              <div style={fieldRow}>
                <span style={fieldLbl}>Coarse-Multiplier (Shift+Scroll)</span>
                <input type="number" min={1} max={100} style={fieldInput}
                  value={coarseMultiplier}
                  onChange={(e) => setCoarseMultiplier(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                />
              </div>
              <div style={infoBox}>
                Shift+Scroll sendet {coarseMultiplier}× SUB-ROTATE.{' '}
                Passe an die Companion-Action-Schrittweite an.
              </div>
            </div>
          )}

          {/* Step 5: Summary */}
          {step === 5 && (
            <div style={body}>
              <div style={{ ...infoBox, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div><strong style={{ color: '#e9edf2' }}>Button:</strong> {buttonRef ? `${buttonRef.page}/${buttonRef.row}/${buttonRef.col}` : '—'}</div>
                <div><strong style={{ color: '#e9edf2' }}>Separator:</strong> "{separator}"</div>
                <div><strong style={{ color: '#e9edf2' }}>Meter L/R:</strong> Index {meterLIndex} / {meterRIndex ?? '—'}</div>
                <div><strong style={{ color: '#e9edf2' }}>Level:</strong> Index {levelIndex ?? '—'}</div>
                <div><strong style={{ color: '#e9edf2' }}>Name:</strong> Index {nameIndex ?? '—'} (Fallback: "{name || '—'}")</div>
                <div><strong style={{ color: '#e9edf2' }}>Solo:</strong> {soloRef ? `${soloRef.page}/${soloRef.row}/${soloRef.col}` : '—'}</div>
                <div><strong style={{ color: '#e9edf2' }}>Pan:</strong> {panRef ? `${panRef.page}/${panRef.row}/${panRef.col}` : '—'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ color: '#e9edf2' }}>Stripe-Farbe:</strong>
                  <div style={{ width: 16, height: 16, borderRadius: 3, background: color, border: '1px solid #2a3344' }} />
                  {color}
                </div>
                <div>
                  <strong style={{ color: '#e9edf2' }}>Mono:</strong> {mono ? 'Ja' : 'Nein'}{' '}·{' '}
                  <strong style={{ color: '#e9edf2' }}>Clip:</strong> {clipThreshold} dBFS{' '}·{' '}
                  <strong style={{ color: '#e9edf2' }}>Coarse:</strong> {coarseMultiplier}×
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={footer}>
            <button style={btnSecondary} onClick={() => step > 1 ? setStep(step - 1) : onClose()}>
              {step === 1 ? 'Abbrechen' : '← Zurück'}
            </button>
            {step < 5 ? (
              <button
                style={{ ...btnPrimary, opacity: step === 1 && !buttonRef ? 0.5 : 1 }}
                disabled={step === 1 && !buttonRef}
                onClick={() => setStep(step + 1)}
              >
                Weiter →
              </button>
            ) : (
              <button style={btnPrimary} onClick={handleConfirm}>
                Fertig — Element erstellen
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Button Picker (Schritt 1, 3) */}
      {pickerTarget && (
        <CompanionButtonPickerDialog
          onConfirm={(ref) => {
            if (pickerTarget === 'button') setButtonRef(ref)
            else if (pickerTarget === 'solo') setSoloRef(ref)
            else if (pickerTarget === 'pan') setPanRef(ref)
            setPickerTarget(null)
          }}
          onClose={() => setPickerTarget(null)}
        />
      )}
    </>
  )
}

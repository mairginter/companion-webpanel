/**
 * AddElementMenu.tsx
 *
 * Kleines Popup-Menü mit 3 Einträgen (CompanionButton, Label, Shape).
 * Wird von Toolbar-+ und Canvas-Rechtsklick geöffnet.
 * canvasPos = Zielposition auf dem Canvas — linke obere Ecke des neuen Elements.
 */
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { AnyElement } from '@cwp/shared'
import { CompanionButtonPickerDialog } from './CompanionButtonPickerDialog'
import { ChannelStripWizard } from './ChannelStripWizard'

export interface AddElementMenuProps {
  /** Bildschirm-Position des Popups (clientX/clientY oder Button-Anker) */
  screenPos: { x: number; y: number }
  /** Zielposition auf dem Canvas — Element wird hier zentriert platziert */
  canvasPos: { x: number; y: number }
  panelId: string
  onClose: () => void
}

const MENU_ITEMS = [
  { type: 'companionButton', label: 'Companion Button', icon: '⊞' },
  { type: 'channelStrip',    label: 'Channel Strip',    icon: '🎚' },
  { type: 'label',           label: 'Label',            icon: 'T' },
  { type: 'shape',           label: 'Shape',            icon: '▭' },
] as const

function makeDefault(
  type: 'companionButton' | 'label' | 'shape',
  canvasPos: { x: number; y: number },
  ref?: { hostId: string; page: number; row: number; col: number },
): AnyElement {
  const id = crypto.randomUUID()
  const x = Math.round(canvasPos.x), y = Math.round(canvasPos.y)
  if (type === 'label') {
    return { id, type, x, y, w: 200, h: 40, z: 0, text: 'Label', style: {} }
  }
  if (type === 'shape') {
    return { id, type, x, y, w: 160, h: 100, z: -1,
      style: { fill: '#1a2030', stroke: '#2a3344', strokeWidth: 1, borderRadius: 6 } }
  }
  // companionButton — ref wird vom Picker geliefert
  return { id, type: 'companionButton', x, y, w: 120, h: 120, z: 0,
    ref: ref!,
    render: { textAlign: 'center', showText: true, showBgColor: true },
  }
}

export function AddElementMenu({ screenPos, canvasPos, panelId, onClose }: AddElementMenuProps) {
  const addElement = useAppStore((s) => s.addElement)
  const settings = useAppStore((s) => s.settings)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)

  // Schließen bei Klick außerhalb (nur wenn Picker/Wizard nicht offen)
  useEffect(() => {
    if (pickerOpen || wizardOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen, wizardOpen, onClose])

  const handleSelect = (type: 'companionButton' | 'channelStrip' | 'label' | 'shape') => {
    if (type === 'companionButton') {
      setPickerOpen(true)
      return
    }
    if (type === 'channelStrip') {
      setWizardOpen(true)
      return
    }
    addElement(panelId, makeDefault(type, canvasPos))
    onClose()
  }

  const handlePickerConfirm = (ref: { hostId: string; page: number; row: number; col: number }) => {
    addElement(panelId, makeDefault('companionButton', canvasPos, ref))
    onClose()
  }

  const handleWizardConfirm = (draft: Omit<import('@cwp/shared').ChannelStripElement, 'id'>) => {
    const id = crypto.randomUUID()
    addElement(panelId, { id, ...draft } as import('@cwp/shared').AnyElement)
    onClose()
  }

  return (
    <>
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          left: screenPos.x,
          top: screenPos.y,
          background: '#1a2030',
          border: '1px solid #2a3344',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          zIndex: 1000,
          minWidth: 180,
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        <div style={{ padding: '6px 0' }}>
          {MENU_ITEMS.map(({ type, label, icon }) => (
            <div
              key={type}
              onClick={() => handleSelect(type)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 14px',
                fontSize: 13, color: '#e9edf2', cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#243040')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 14, color: '#4a9eff', width: 16, textAlign: 'center' }}>{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </div>

      {pickerOpen && (
        <CompanionButtonPickerDialog
          onConfirm={handlePickerConfirm}
          onClose={() => { setPickerOpen(false); onClose() }}
          initialGridCols={settings?.hosts.find((h) => sessionStatus[h.id] === 'connected')?.gridCols}
          initialGridRows={settings?.hosts.find((h) => sessionStatus[h.id] === 'connected')?.gridRows}
        />
      )}

      {wizardOpen && (
        <ChannelStripWizard
          canvasPos={canvasPos}
          onConfirm={handleWizardConfirm}
          onClose={() => { setWizardOpen(false); onClose() }}
        />
      )}
    </>
  )
}

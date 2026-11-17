/**
 * App.tsx
 *
 * App-Shell: Toolbar + Canvas + Modals + Toast, dazu die globalen Tastatur-Shortcuts.
 *
 * Live-Betrieb (geräte-lokal, siehe utils/deviceView.ts):
 *  - Geräte-Links: Dialog, der Adressen mit Panel/Kiosk/Lock/Sprache erzeugt
 *               (components/DeviceLinks/DeviceLinksModal.tsx).
 *  - Kiosk:     im View-Mode wird die Toolbar ausgeblendet; ein kleiner Griff oben
 *               mittig holt sie zurück.
 *  - Show-Lock: sperrt Edit-Mode UND alle Tastatur-Shortcuts — ein versehentliches
 *               "E" schaltet sonst mitten in der Show in den Edit-Mode.
 */
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useWebSocket } from './ws/useWebSocket'
import { useSettings } from './api/useSettings'
import { useAppStore } from './store/useAppStore'
import { Toolbar } from './components/Toolbar/Toolbar'
import { Canvas } from './components/Canvas/Canvas'
import { HostManagerModal } from './components/HostManager/HostManagerModal'
import { HelpModal } from './components/HelpModal/HelpModal'
import { Toast } from './components/Toast/Toast'
import { DeviceLinksModal } from './components/DeviceLinks/DeviceLinksModal'
import { consumeLinksParam } from './utils/deviceView'

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    background: '#0f141a',
    color: '#e9edf2',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    overflow: 'hidden',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
}

// Einmal beim Laden des Moduls auswerten — NICHT im useState-Initializer: der Aufruf
// entfernt den Parameter aus der Adresse (Seiteneffekt), und React ruft Initializer im
// StrictMode doppelt auf; der zweite Aufruf sähe den Parameter nicht mehr.
const OPEN_LINKS_ON_START = consumeLinksParam()

export function App() {
  const { sendPress, sendRotate, sendVPress } = useWebSocket()
  const { saveSettings } = useSettings()
  const mode = useAppStore((s) => s.mode)
  const toggleMode = useAppStore((s) => s.toggleMode)
  const [hostManagerOpen, setHostManagerOpen] = useState(false)
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  // Geräte-Links-Dialog — ?links=1 öffnet ihn direkt (Aufruf aus dem Electron-Startfenster)
  const [deviceLinksOpen, setDeviceLinksOpen] = useState(OPEN_LINKS_ON_START)

  const kiosk = useAppStore((s) => s.kiosk)
  const setKiosk = useAppStore((s) => s.setKiosk)
  const { t } = useTranslation()
  // Kiosk gilt nur im View-Mode — im Edit-Mode wird die Toolbar immer gebraucht
  const toolbarHidden = kiosk && mode === 'view'

  const handleSave = useCallback(async (): Promise<boolean> => {
    const s = useAppStore.getState().settings
    return s ? saveSettings(s) : false
  }, [saveSettings])

  // Vollständige Keyboard-Shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Kein Shortcut wenn User in einem Input/Textarea tippt
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const store = useAppStore.getState()
      // Show-Lock: sämtliche Shortcuts gesperrt (Schutz vor Fehleingaben im Live-Betrieb)
      if (store.locked) return
      const inEdit = store.mode === 'edit'

      // Ctrl-Shortcuts (auf dem Mac: Cmd)
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 's': {
            e.preventDefault()
            const s = store.settings
            if (s) void saveSettings(s)
            return
          }
          case 'z':
            e.preventDefault()
            if (inEdit) store.undo()
            return
          case 'y':
            e.preventDefault()
            if (inEdit) store.redo()
            return
          case 'd': {
            e.preventDefault()
            if (inEdit) {
              const panel = store.getActivePanel()
              if (panel) store.duplicateElements(panel.id, [...store.selectedIds])
            }
            return
          }
          case 'c': {
            if (!e.shiftKey) break
            e.preventDefault()
            if (inEdit) {
              const panel = store.getActivePanel()
              if (panel && store.selectedIds.size === 1) {
                store.copyElementStyle(panel.id, [...store.selectedIds][0])
              }
            }
            return
          }
          case 'v': {
            if (!e.shiftKey) break
            e.preventDefault()
            if (inEdit) {
              const panel = store.getActivePanel()
              if (panel && store.copiedStyle) {
                store.pasteElementStyle(panel.id, [...store.selectedIds])
              }
            }
            return
          }
        }
      }

      // Pfeiltasten: Nudge (nur Edit-Mode, kein Ctrl/Alt/Meta)
      if (inEdit && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const nudge = e.shiftKey ? 10 : 1
        const panel = store.getActivePanel()
        if (panel && store.selectedIds.size > 0) {
          let dx = 0; let dy = 0
          switch (e.key) {
            case 'ArrowLeft':  dx = -nudge; break
            case 'ArrowRight': dx =  nudge; break
            case 'ArrowUp':    dy = -nudge; break
            case 'ArrowDown':  dy =  nudge; break
          }
          if (dx !== 0 || dy !== 0) {
            e.preventDefault()
            store.saveUndoSnapshot([...store.selectedIds])
            for (const id of store.selectedIds) {
              const el = panel.elements.find((x) => x.id === id)
              if (el) store.updateElementGeometry(panel.id, id, { x: el.x + dx, y: el.y + dy })
            }
            return
          }
        }
      }

      // Einfache Keys (ohne Ctrl/Alt/Meta)
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            store.setMode('view')
            break
          case 'e':
            store.setMode('edit')
            break
          case 'g': {
            // Grid-Overlay toggle
            const panel = store.getActivePanel()
            const settings = store.settings
            if (!panel || !settings) break
            const currentEnabled = panel.grid?.enabled ?? true
            store.setSettings({
              ...settings,
              panels: settings.panels.map((p) =>
                p.id !== panel.id ? p : {
                  ...p,
                  grid: { size: p.grid?.size ?? 40, snap: p.grid?.snap ?? true, enabled: !currentEnabled },
                }
              ),
            })
            break
          }
          case 's': {
            // Snap toggle (nur Edit)
            if (!inEdit) break
            const panel = store.getActivePanel()
            const settings = store.settings
            if (!panel || !settings) break
            const currentSnap = panel.grid?.snap ?? true
            store.setSettings({
              ...settings,
              panels: settings.panels.map((p) =>
                p.id !== panel.id ? p : {
                  ...p,
                  grid: { size: p.grid?.size ?? 40, enabled: p.grid?.enabled ?? true, snap: !currentSnap },
                }
              ),
            })
            break
          }
          case 'delete':
          case 'backspace': {
            if (!inEdit) break
            const panel = store.getActivePanel()
            if (panel && store.selectedIds.size > 0) {
              store.deleteElements(panel.id, [...store.selectedIds])
            }
            break
          }
          case 'escape':
            if (inEdit) store.clearSelection()
            break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveSettings])

  return (
    <div style={styles.app}>
      {!toolbarHidden && (
        <Toolbar mode={mode} onToggleMode={toggleMode} onOpenHostManager={() => setHostManagerOpen(true)} onOpenHelp={() => setHelpModalOpen(true)} onOpenDeviceLinks={() => setDeviceLinksOpen(true)} onSave={handleSave} />
      )}
      {/* Kiosk-Griff: unauffällig oben mittig, blendet die Toolbar wieder ein */}
      {toolbarHidden && (
        <button
          onClick={() => setKiosk(false)}
          title={t('toolbar.kioskExit')}
          aria-label={t('toolbar.kioskExit')}
          style={{
            position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
            zIndex: 900, width: 56, height: 16, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(30,40,64,0.55)', color: 'rgba(233,237,242,0.7)',
            border: 'none', borderRadius: '0 0 8px 8px', cursor: 'pointer',
          }}
        >
          <span className="material-icons" style={{ fontSize: 16 }}>expand_more</span>
        </button>
      )}
      <div style={styles.body}>
        <Canvas sendPress={sendPress} sendRotate={sendRotate} sendVPress={sendVPress} onSave={handleSave} />
      </div>
      {hostManagerOpen && (
        <HostManagerModal
          onClose={() => setHostManagerOpen(false)}
          saveSettings={saveSettings}
        />
      )}
      {helpModalOpen && (
        <HelpModal onClose={() => setHelpModalOpen(false)} />
      )}
      {deviceLinksOpen && (
        <DeviceLinksModal onClose={() => setDeviceLinksOpen(false)} />
      )}
      <Toast />
    </div>
  )
}

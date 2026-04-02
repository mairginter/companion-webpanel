import { useEffect } from 'react'
import { useWebSocket } from './ws/useWebSocket'
import { useSettings } from './api/useSettings'
import { useAppStore } from './store/useAppStore'
import { Toolbar } from './components/Toolbar/Toolbar'
import { Canvas } from './components/Canvas/Canvas'

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

export function App() {
  const { sendPress } = useWebSocket()
  const { saveSettings } = useSettings()
  const mode = useAppStore((s) => s.mode)
  const toggleMode = useAppStore((s) => s.toggleMode)

  // Vollständige Keyboard-Shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Kein Shortcut wenn User in einem Input/Textarea tippt
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const store = useAppStore.getState()
      const inEdit = store.mode === 'edit'

      // Ctrl-Shortcuts
      if (e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 's': {
            e.preventDefault()
            const s = store.settings
            if (s) saveSettings(s)
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
      <Toolbar mode={mode} onToggleMode={toggleMode} />
      <div style={styles.body}>
        <Canvas sendPress={sendPress} />
      </div>
    </div>
  )
}

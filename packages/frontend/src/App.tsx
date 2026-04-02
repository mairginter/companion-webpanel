import { useEffect } from 'react'
import { useWebSocket } from './ws/useWebSocket'
import { useSettings } from './api/useSettings'
import { useAppStore } from './store/useAppStore'
import { Toolbar } from './components/Toolbar/Toolbar'
import { Sidebar } from './components/Sidebar/Sidebar'
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
  useSettings()
  const mode = useAppStore((s) => s.mode)
  const toggleMode = useAppStore((s) => s.toggleMode)

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Kein Shortcut wenn User in einem Input-Feld tippt
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key.toLowerCase()) {
        case 'v': useAppStore.getState().setMode('view'); break
        case 'e': useAppStore.getState().setMode('edit'); break
        case 'g': break // TODO: Grid toggle
      }

      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        // TODO: Speichern
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div style={styles.app}>
      <Toolbar mode={mode} onToggleMode={toggleMode} />
      <div style={styles.body}>
        <Sidebar />
        <Canvas sendPress={sendPress} />
      </div>
    </div>
  )
}

/**
 * Toast.tsx
 *
 * Kurze Rückmeldung unten mittig (Speicherfehler, "Settings auf anderem Gerät geändert", …).
 * Quelle ist store.toast — es gibt immer höchstens einen Toast, ein neuer ersetzt den alten.
 *
 *  - normale Toasts verschwinden nach 4 s
 *  - sticky-Toasts (Fehler, Entscheidungen) bleiben bis zum Schließen stehen
 *  - optionaler Aktions-Button (z.B. "Neu laden") schließt den Toast nach Ausführung
 */
import { useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'

const AUTO_DISMISS_MS = 4000

const KIND_COLOR = { info: '#4a9eff', warn: '#ff8a3d', error: '#ff5a5f' } as const
const KIND_ICON = { info: 'info', warn: 'warning', error: 'error' } as const

export function Toast() {
  const toast = useAppStore((s) => s.toast)
  const clearToast = useAppStore((s) => s.clearToast)

  // Auto-Dismiss — toast.id in den Deps startet den Timer bei jedem neuen Toast neu
  useEffect(() => {
    if (!toast || toast.sticky) return
    const timer = setTimeout(clearToast, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [toast?.id, toast?.sticky, clearToast])

  if (!toast) return null
  const color = KIND_COLOR[toast.kind]

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      style={{
        position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)',
        zIndex: 2000, maxWidth: 'min(640px, calc(100vw - 32px))',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px 10px 14px',
        background: '#1a2030', color: '#e9edf2',
        border: `1px solid ${color}`, borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        fontSize: 13, lineHeight: 1.4,
      }}
    >
      <span className="material-icons" style={{ fontSize: 18, color, flexShrink: 0 }}>{KIND_ICON[toast.kind]}</span>
      <span style={{ flex: 1, overflowWrap: 'anywhere' }}>{toast.text}</span>
      {toast.action && (
        <button
          onClick={() => { toast.action?.run(); clearToast() }}
          style={{
            height: 32, padding: '0 12px', borderRadius: 6, flexShrink: 0,
            background: 'transparent', border: `1px solid ${color}`, color,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={clearToast}
        aria-label="Close"
        style={{
          width: 28, height: 28, padding: 0, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', color: '#8896aa', cursor: 'pointer',
        }}
      >
        <span className="material-icons" style={{ fontSize: 18 }}>close</span>
      </button>
    </div>
  )
}

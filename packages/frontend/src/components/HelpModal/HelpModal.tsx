/**
 * HelpModal.tsx
 *
 * 3-Tab Hilfe-Modal, geöffnet über den ?-Button in der Toolbar.
 * Tabs: KI-Kontext (Download), Shortcuts, Features.
 * ESC und Backdrop-Klick schließen das Modal.
 */
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

type Tab = 'ki' | 'shortcuts' | 'features'

interface HelpModalProps {
  onClose: () => void
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.65)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1200,
}

const MODAL: React.CSSProperties = {
  background: '#252830',
  border: '1px solid #3a3d46',
  borderRadius: 10,
  width: 560,
  maxWidth: '92vw',
  maxHeight: '82vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const HEADER: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 18px',
  borderBottom: '1px solid #3a3d46',
  flexShrink: 0,
}

const TAB_BAR: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #3a3d46',
  flexShrink: 0,
}

const CONTENT: React.CSSProperties = {
  overflowY: 'auto',
  padding: '18px',
  flex: 1,
}

const KBD: React.CSSProperties = {
  background: '#3a3d46',
  border: '1px solid #4a4d56',
  borderRadius: 3,
  padding: '1px 6px',
  fontSize: 11,
  fontFamily: 'monospace',
  color: '#ccc',
}

const CARD: (color: string) => React.CSSProperties = (color) => ({
  background: '#2d3038',
  borderRadius: 6,
  padding: '10px 12px',
  borderLeft: `3px solid ${color}`,
  marginBottom: 8,
})

const TAB_ACTIVE: React.CSSProperties = {
  padding: '10px 16px', fontSize: 12, cursor: 'pointer',
  color: '#7db9e8', background: 'none', border: 'none',
  borderBottom: '2px solid #7db9e8', fontWeight: 500, lineHeight: 1,
}
const TAB_INACTIVE: React.CSSProperties = {
  ...TAB_ACTIVE,
  color: '#888', borderBottom: '2px solid transparent', fontWeight: 400,
}

const FEATURES = [
  { key: 'btn_companionButton', color: '#7db9e8' },
  { key: 'btn_shape',           color: '#8ec98a' },
  { key: 'btn_label',           color: '#c98a8a' },
  { key: 'btn_channelStrip',    color: '#8a8ac9' },
  { key: 'btn_virtualDeck',     color: '#c98ac9' },
]

const SHORTCUTS: Array<{ keys: string; actionKey: string }> = [
  { keys: 'Ctrl+S',         actionKey: 'shortcut_save'       },
  { keys: 'Ctrl+Z',         actionKey: 'shortcut_undo'       },
  { keys: 'Ctrl+Y',         actionKey: 'shortcut_redo'       },
  { keys: 'Ctrl+D',         actionKey: 'shortcut_duplicate'  },
  { keys: 'Ctrl+Shift+C',   actionKey: 'shortcut_copyStyle'  },
  { keys: 'Ctrl+Shift+V',   actionKey: 'shortcut_pasteStyle' },
  { keys: 'V',              actionKey: 'shortcut_viewMode'   },
  { keys: 'E',              actionKey: 'shortcut_editMode'   },
  { keys: 'G',              actionKey: 'shortcut_toggleGrid' },
  { keys: 'S',              actionKey: 'shortcut_toggleSnap' },
  { keys: 'Del',            actionKey: 'shortcut_delete'     },
  { keys: '↑ ↓ ← →',       actionKey: 'shortcut_move1'      },
  { keys: 'Shift+↑↓←→',    actionKey: 'shortcut_move10'     },
  { keys: 'Esc',            actionKey: 'shortcut_deselect'   },
]

export function HelpModal({ onClose }: HelpModalProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('ki')

  // ESC closes modal — capture phase takes priority over App.tsx ESC handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [onClose])

  return (
    <div style={OVERLAY} onMouseDown={onClose}>
      <div style={MODAL} onMouseDown={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={HEADER}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>
            {t('helpModal.title')}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Tab bar */}
        <div style={TAB_BAR}>
          {(['ki', 'shortcuts', 'features'] as Tab[]).map((tab) => (
            <button
              key={tab}
              style={activeTab === tab ? TAB_ACTIVE : TAB_INACTIVE}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'ki'        && `📥 ${t('helpModal.tabKi')}`}
              {tab === 'shortcuts' && `⌨ ${t('helpModal.tabShortcuts')}`}
              {tab === 'features'  && `⚙ ${t('helpModal.tabFeatures')}`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={CONTENT}>

          {/* ── Tab 1: KI-Kontext ── */}
          {activeTab === 'ki' && (
            <div>
              <div style={{
                background: '#1a3d2a', border: '1px solid #2a6a44',
                borderRadius: 8, padding: '16px 18px', textAlign: 'center', marginBottom: 14,
              }}>
                <div style={{ color: '#6ee7a0', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                  {t('helpModal.kiTitle')}
                </div>
                <div style={{ color: '#a0d4b0', fontSize: 12, marginBottom: 14 }}>
                  {t('helpModal.kiDescription')}
                </div>
                <a
                  href="/help-me-KI-by_alex.md"
                  download
                  style={{
                    background: '#2a6a44', borderRadius: 5, padding: '8px 16px',
                    color: '#6ee7a0', fontSize: 12, fontWeight: 500,
                    textDecoration: 'none', display: 'inline-block',
                  }}
                >
                  ⬇ {t('helpModal.kiDownloadButton')}
                </a>
              </div>
              <p style={{ color: '#666', fontSize: 11, textAlign: 'center', margin: '0 0 16px 0' }}>
                {t('helpModal.kiFootnote')}
              </p>

              {/* Settings folder / file link */}
              <div style={{
                background: '#1a2a3d', border: '1px solid #2a4a6a',
                borderRadius: 8, padding: '14px 16px',
              }}>
                <div style={{ color: '#7db9e8', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                  {t('helpModal.kiSettingsTitle')}
                </div>
                <div style={{ color: '#8aafcc', fontSize: 11, marginBottom: 12 }}>
                  {t('helpModal.kiSettingsDesc')}
                </div>
                {(window as any).cwpApi?.openSettingsFolder ? (
                  <button
                    onClick={() => (window as any).cwpApi.openSettingsFolder()}
                    style={{
                      background: '#2a4a6a', borderRadius: 5, padding: '7px 14px',
                      color: '#7db9e8', fontSize: 12, fontWeight: 500,
                      border: 'none', cursor: 'pointer', display: 'inline-block',
                    }}
                  >
                    ↗ {t('helpModal.kiSettingsOpenFolder')}
                  </button>
                ) : (
                  <a
                    href="/api/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: '#2a4a6a', borderRadius: 5, padding: '7px 14px',
                      color: '#7db9e8', fontSize: 12, fontWeight: 500,
                      textDecoration: 'none', display: 'inline-block',
                    }}
                  >
                    ↗ {t('helpModal.kiSettingsDownload')}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── Tab 2: Shortcuts ── */}
          {activeTab === 'shortcuts' && (
            <div>
              <div style={{ color: '#aaa', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 12 }}>
                {t('helpModal.shortcutsHeading')}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: '#666', borderBottom: '1px solid #3a3d46' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0 8px', fontWeight: 500, width: 160 }}>
                      {t('helpModal.shortcutColumn')}
                    </th>
                    <th style={{ textAlign: 'left', padding: '4px 0 8px', fontWeight: 500 }}>
                      {t('helpModal.actionColumn')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SHORTCUTS.map(({ keys, actionKey }) => (
                    <tr key={actionKey} style={{ borderBottom: '1px solid #2a2d36' }}>
                      <td style={{ padding: '6px 0' }}>
                        <kbd style={KBD}>{keys}</kbd>
                      </td>
                      <td style={{ padding: '6px 0', color: '#ccc' }}>
                        {t(`helpModal.${actionKey}`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Tab 3: Features ── */}
          {activeTab === 'features' && (
            <div>
              {/* App description block */}
              <div style={{
                background: '#2d3038', borderRadius: 6, padding: '12px 14px', marginBottom: 16,
                border: '1px solid #3a3d46',
              }}>
                <p style={{ color: '#ccc', fontSize: 12, margin: '0 0 8px 0', lineHeight: 1.5 }}>
                  {t('helpModal.appDesc')}
                </p>
                <p style={{ color: '#888', fontSize: 11, margin: '0 0 4px 0' }}>
                  • {t('helpModal.appMultiHost')}
                </p>
                <p style={{ color: '#888', fontSize: 11, margin: 0 }}>
                  • {t('helpModal.appVersions')}
                </p>
              </div>

              <div style={{ color: '#aaa', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 10 }}>
                {t('helpModal.featuresHeading')}
              </div>

              {FEATURES.map(({ key, color }) => (
                <div key={key} style={CARD(color)}>
                  <div style={{ color, fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                    {t(`helpModal.${key}`)}
                  </div>
                  <div style={{ color: '#aaa', fontSize: 11, marginBottom: 4 }}>
                    {t(`helpModal.${key}_desc`)}
                  </div>
                  <div style={{ color: '#666', fontSize: 10 }}>
                    {t(`helpModal.${key}_props`)}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

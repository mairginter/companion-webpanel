/**
 * CompanionButtonPickerDialog.tsx
 *
 * Modal-Dialog zur Auswahl eines Companion-Buttons.
 * Zeigt nur verbundene Hosts (sessionStatus === 'connected').
 * Page-Dropdown: konfigurierte Pages + "+" für neue Page.
 * Mini-Grid: bgColor + Text aus Store, Klick → row/col setzen.
 */
import React, { useState, useMemo } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { pageKey } from '@cwp/shared'

interface Props {
  onConfirm: (ref: { hostId: string; page: number; row: number; col: number }) => void
  onClose: () => void
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1100,
}

const DIALOG: React.CSSProperties = {
  background: '#1a2030',
  border: '1px solid #2a3344',
  borderRadius: 12,
  padding: 20,
  width: 440,
  maxWidth: '95vw',
  boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
  color: '#e9edf2',
}

const LABEL_STYLE: React.CSSProperties = { fontSize: 11, color: '#8896aa', marginBottom: 4 }

const SELECT_STYLE: React.CSSProperties = {
  width: '100%', background: '#121821', border: '1px solid #2a3344',
  borderRadius: 6, color: '#e9edf2', fontSize: 13, padding: '6px 8px',
}

export function CompanionButtonPickerDialog({ onConfirm, onClose }: Props) {
  const settings = useAppStore((s) => s.settings)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const buttons = useAppStore((s) => s.buttons)
  const addPageAssignment = useAppStore((s) => s.addPageAssignment)

  // Nur verbundene Hosts
  const connectedHosts = useMemo(() => {
    if (!settings) return []
    return settings.hosts.filter((h) =>
      Object.entries(sessionStatus).some(([k, v]) => k.startsWith(h.id + ':') && v === 'connected'),
    )
  }, [settings, sessionStatus])

  const [hostId, setHostId] = useState<string>(connectedHosts[0]?.id ?? '')
  const [pageNum, setPageNum] = useState<number | null>(null)
  const [newPageInput, setNewPageInput] = useState('')
  const [showNewPageInput, setShowNewPageInput] = useState(false)
  const [selectedKey, setSelectedKey] = useState<number | null>(null) // keyIndex

  // Pages für gewählten Host
  const pages = useMemo(() => {
    if (!settings || !hostId) return []
    const pa = settings.wizard?.pageAssignments ?? {}
    return Object.entries(pa)
      .filter(([k]) => k.startsWith(hostId + ':'))
      .map(([k, v]) => ({ key: k, page: v.page, surfaceConfig: v.surfaceConfig }))
      .sort((a, b) => a.page - b.page)
  }, [settings, hostId])

  const activePage = pages.find((p) => p.page === pageNum)
  const keysPerRow = activePage?.surfaceConfig.keysPerRow ?? 8
  const rows = activePage?.surfaceConfig.rows ?? 8

  // Mini-Grid Button-States
  const gridCells = useMemo(() => {
    if (pageNum === null) return []
    const prefix = pageKey(hostId, pageNum)
    const cells: Array<{ keyIndex: number; bgColor?: string; text?: string }> = []
    for (let i = 0; i < keysPerRow * rows; i++) {
      const state = buttons[`${prefix}:${i}`]
      cells.push({ keyIndex: i, bgColor: state?.bgColor, text: state?.text })
    }
    return cells
  }, [buttons, hostId, pageNum, keysPerRow, rows])

  const selectedRow = selectedKey !== null ? Math.floor(selectedKey / keysPerRow) : null
  const selectedCol = selectedKey !== null ? selectedKey % keysPerRow : null

  const handleHostChange = (id: string) => {
    setHostId(id)
    setPageNum(null)
    setSelectedKey(null)
    setShowNewPageInput(false)
  }

  const handlePageChange = (value: string) => {
    if (value === '__new__') {
      setShowNewPageInput(true)
      setPageNum(null)
      setSelectedKey(null)
    } else {
      setShowNewPageInput(false)
      setPageNum(Number(value))
      setSelectedKey(null)
    }
  }

  const handleNewPageConfirm = () => {
    const n = parseInt(newPageInput, 10)
    if (!n || n < 1) return
    addPageAssignment(hostId, n)
    setPageNum(n)
    setShowNewPageInput(false)
    setNewPageInput('')
    setSelectedKey(null)
  }

  const handleConfirm = () => {
    if (pageNum === null || selectedKey === null) return
    onConfirm({ hostId, page: pageNum, row: selectedRow!, col: selectedCol! })
  }

  // Zellgröße: max 48px, passt in 400px Dialog-Breite
  const cellSize = Math.min(48, Math.floor(400 / keysPerRow))

  return (
    <div style={OVERLAY} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={DIALOG}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Companion Button wählen</div>

        {connectedHosts.length === 0 ? (
          <div style={{ color: '#8896aa', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            Kein Host verbunden
          </div>
        ) : (
          <>
            {/* Host + Page Zeile */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={LABEL_STYLE}>Host</div>
                <select style={SELECT_STYLE} value={hostId} onChange={(e) => handleHostChange(e.target.value)}>
                  {connectedHosts.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={LABEL_STYLE}>Page</div>
                <select
                  style={SELECT_STYLE}
                  value={showNewPageInput ? '__new__' : (pageNum ?? '')}
                  onChange={(e) => handlePageChange(e.target.value)}
                >
                  <option value="" disabled>— wählen —</option>
                  {pages.map((p) => (
                    <option key={p.key} value={p.page}>Page {p.page}</option>
                  ))}
                  <option value="__new__">+ Neue Page…</option>
                </select>
              </div>
            </div>

            {/* Neue Page Input */}
            {showNewPageInput && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <div style={LABEL_STYLE}>Page-Nummer</div>
                  <input
                    type="number" min={1} max={99}
                    value={newPageInput}
                    onChange={(e) => setNewPageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleNewPageConfirm()}
                    style={{ ...SELECT_STYLE, width: '100%', boxSizing: 'border-box', height: 44, fontSize: 16 }}
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleNewPageConfirm}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: '1px solid #4a9eff',
                    background: 'rgba(74,158,255,0.12)', color: '#4a9eff', fontSize: 13, cursor: 'pointer',
                  }}
                >
                  OK
                </button>
              </div>
            )}

            {/* Mini-Grid */}
            {pageNum !== null && (
              <div style={{ marginBottom: 16 }}>
                <div style={LABEL_STYLE}>Button wählen</div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${keysPerRow}, ${cellSize}px)`,
                  gap: 2,
                  background: '#0f141a',
                  padding: 8,
                  borderRadius: 8,
                  border: '1px solid #2a3344',
                  overflowX: 'auto',
                }}>
                  {gridCells.map(({ keyIndex, bgColor, text }) => {
                    const isSelected = selectedKey === keyIndex
                    return (
                      <div
                        key={keyIndex}
                        onClick={() => setSelectedKey(keyIndex)}
                        title={`Row ${Math.floor(keyIndex / keysPerRow)}, Col ${keyIndex % keysPerRow}`}
                        style={{
                          width: cellSize, height: cellSize,
                          background: bgColor ?? '#1a2030',
                          border: isSelected ? '2px solid #4a9eff' : '1px solid #2a3344',
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, color: '#e9edf2',
                          overflow: 'hidden',
                          boxSizing: 'border-box',
                          transition: 'border-color 0.1s',
                        }}
                      >
                        {text && (
                          <span style={{ fontSize: 8, lineHeight: 1.1, textAlign: 'center', padding: '0 2px', overflow: 'hidden' }}>
                            {text.split('\n')[0]}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {selectedKey !== null && (
                  <div style={{ fontSize: 11, color: '#8896aa', marginTop: 6 }}>
                    Zeile {selectedRow! + 1}, Spalte {selectedCol! + 1}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px', borderRadius: 6, border: '1px solid #2a3344',
              background: '#121821', color: '#8896aa', fontSize: 13, cursor: 'pointer',
            }}
          >
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            disabled={pageNum === null || selectedKey === null}
            style={{
              padding: '7px 16px', borderRadius: 6, border: '1px solid #4a9eff',
              background: pageNum !== null && selectedKey !== null ? 'rgba(74,158,255,0.15)' : '#1a2030',
              color: pageNum !== null && selectedKey !== null ? '#4a9eff' : '#4a5568',
              fontSize: 13, cursor: pageNum !== null && selectedKey !== null ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  )
}

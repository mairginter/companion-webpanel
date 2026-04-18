/**
 * CompanionButtonPickerDialog.tsx
 *
 * Modal-Dialog zur Auswahl eines Companion-Buttons.
 * Zeigt nur verbundene Hosts (sessionStatus === 'connected').
 *
 * Für Live-Preview: beim Öffnen/Wechsel einer Page werden temporäre
 * Subscriptions per POST /api/preview-page gestartet, sodass das Mini-Grid
 * echte Button-Zustände von Companion zeigt.
 * Beim Schließen werden diese Subscriptions per DELETE /api/preview-page entfernt.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { pageKey } from '@cwp/shared'
import type { CompanionRef } from '@cwp/shared'
import { NumericInput } from '../PropertiesPanel/NumericInput'
import { buildRangeSelection, selectedCellsToRefs } from '../../utils/pickerUtils'

const BACKEND_BASE = import.meta.env.DEV ? `http://${window.location.hostname}:8080` : ''

interface Props {
  onConfirm: (refs: CompanionRef[]) => void
  onClose: () => void
  confirmLabel?: string
  /** Vorauswahl beim Öffnen */
  initialRef?: { hostId?: string; page?: number }
  /** Positionierung neben dem PropertiesPanel */
  alignSide?: 'left' | 'right'
  panelWidth?: number
  /** Standard-Grid-Größe beim Öffnen (aus HostProfile) */
  initialGridCols?: number
  initialGridRows?: number
}

function overlayStyle(alignSide?: 'left' | 'right', panelWidth = 320): React.CSSProperties {
  if (alignSide === 'right') {
    return {
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      paddingRight: panelWidth + 8,
      zIndex: 1100,
    }
  }
  if (alignSide === 'left') {
    return {
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
      paddingLeft: panelWidth + 8,
      zIndex: 1100,
    }
  }
  return {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1100,
  }
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

export function CompanionButtonPickerDialog({
  onConfirm, onClose, confirmLabel = 'Hinzufügen', initialRef, alignSide, panelWidth = 320,
  initialGridCols, initialGridRows,
}: Props) {
  const settings = useAppStore((s) => s.settings)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const buttons = useAppStore((s) => s.buttons)

  // Nur verbundene Hosts anzeigen
  const connectedHosts = useMemo(() => {
    if (!settings) return []
    return settings.hosts.filter((h) => sessionStatus[h.id] === 'connected')
  }, [settings, sessionStatus])

  const [hostId, setHostId] = useState<string>(initialRef?.hostId ?? connectedHosts[0]?.id ?? '')
  const [pageNum, setPageNum] = useState<number>(initialRef?.page ?? 1)
  const [keysPerRow, setKeysPerRow] = useState(initialGridCols ?? 8)
  const [rows, setRows] = useState(initialGridRows ?? 4)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const lastClickedCell = useRef<{ row: number; col: number } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Trackt die zuletzt aktivierte Preview damit wir sie beim Wechsel/Schließen entfernen
  const activePreview = useRef<{ hostId: string; page: number } | null>(null)

  const startPreview = async (hId: string, page: number, kpr: number, r: number) => {
    // Alte Preview entfernen falls vorhanden
    if (activePreview.current) {
      const { hostId: oldHost, page: oldPage } = activePreview.current
      fetch(`${BACKEND_BASE}/api/preview-page?hostId=${encodeURIComponent(oldHost)}&page=${oldPage}`, {
        method: 'DELETE',
      }).catch(() => {})
      activePreview.current = null
    }

    setLoadingPreview(true)
    try {
      await fetch(`${BACKEND_BASE}/api/preview-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: hId, page, keysPerRow: kpr, rows: r }),
      })
      activePreview.current = { hostId: hId, page }
    } catch {
      console.warn('[Picker] Preview-Subscriptions konnten nicht gestartet werden')
    } finally {
      setLoadingPreview(false)
    }
  }

  // Preview starten wenn hostId, pageNum, keysPerRow oder rows sich ändern
  useEffect(() => {
    if (!hostId) return
    startPreview(hostId, pageNum, keysPerRow, rows)
    // Preview entfernen wenn Dialog unmountet
    return () => {
      if (activePreview.current) {
        const { hostId: h, page: p } = activePreview.current
        fetch(`${BACKEND_BASE}/api/preview-page?hostId=${encodeURIComponent(h)}&page=${p}`, {
          method: 'DELETE',
        }).catch(() => {})
        activePreview.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId, pageNum, keysPerRow, rows])

  // Mini-Grid: Button-Zustände aus dem Store lesen
  const gridCells = useMemo(() => {
    if (!hostId) return []
    const prefix = pageKey(hostId, pageNum)
    const cells: Array<{ row: number; col: number; bgColor?: string; text?: string }> = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < keysPerRow; c++) {
        const state = buttons[`${prefix}:${r}:${c}`]
        cells.push({ row: r, col: c, bgColor: state?.bgColor, text: state?.text })
      }
    }
    return cells
  }, [buttons, hostId, pageNum, keysPerRow, rows])

  const handleHostChange = (id: string) => {
    setHostId(id)
    setSelectedCells(new Set())
    lastClickedCell.current = null
    // Grid-Größe des neuen Hosts als Default setzen
    const host = settings?.hosts.find((h) => h.id === id)
    if (host?.gridCols !== undefined) setKeysPerRow(host.gridCols)
    if (host?.gridRows !== undefined) setRows(host.gridRows)
  }

  const handleCellClick = useCallback((row: number, col: number, e: React.MouseEvent) => {
    const key = `${row}:${col}`

    if (e.shiftKey && lastClickedCell.current) {
      // Rectangular range — add to existing selection, don't update lastClickedCell
      const range = buildRangeSelection(lastClickedCell.current, { row, col })
      setSelectedCells((prev) => {
        const next = new Set(prev)
        range.forEach((k) => next.add(k))
        return next
      })
      return
    }

    if (e.ctrlKey || e.metaKey) {
      // Toggle individual cell
      setSelectedCells((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
      lastClickedCell.current = { row, col }
      return
    }

    // Plain click — select only this cell
    setSelectedCells(new Set([key]))
    lastClickedCell.current = { row, col }
  }, [])

  const handleConfirm = () => {
    if (selectedCells.size === 0) return
    onConfirm(selectedCellsToRefs(selectedCells, hostId, pageNum))
  }

  // Zellgröße: max 48px, passt in 400px Dialog-Breite
  const cellSize = Math.min(48, Math.floor(400 / keysPerRow))

  return (
    <div style={overlayStyle(alignSide, panelWidth)} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={DIALOG}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Companion Button wählen</div>

        {connectedHosts.length === 0 ? (
          <div style={{ color: '#8896aa', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            Kein Host verbunden
          </div>
        ) : (
          <>
            {/* Host + Page */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={LABEL_STYLE}>Host</div>
                <select style={SELECT_STYLE} value={hostId} onChange={(e) => handleHostChange(e.target.value)}>
                  {connectedHosts.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <NumericInput
                  label="Page"
                  value={pageNum}
                  min={1}
                  onChange={(v) => { setPageNum(v); setSelectedCells(new Set()); lastClickedCell.current = null }}
                  compact
                />
              </div>
            </div>

            {/* Grid-Größe */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <NumericInput
                  label="Spalten"
                  value={keysPerRow}
                  min={1}
                  onChange={(v) => { setKeysPerRow(v); setSelectedCells(new Set()); lastClickedCell.current = null }}
                  compact
                />
              </div>
              <div style={{ flex: 1 }}>
                <NumericInput
                  label="Zeilen"
                  value={rows}
                  min={1}
                  onChange={(v) => { setRows(v); setSelectedCells(new Set()); lastClickedCell.current = null }}
                  compact
                />
              </div>
            </div>

            {/* Mini-Grid */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...LABEL_STYLE, marginBottom: 6 }}>
                Button wählen{loadingPreview ? ' (Vorschau lädt…)' : ''}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${keysPerRow}, ${cellSize}px)`,
                gap: 2,
                background: '#0f141a',
                padding: 8,
                borderRadius: 8,
                border: '1px solid #2a3344',
                overflowX: 'auto',
                overflowY: 'auto',
                // Scrollbar nach 8 Zeilen: 8 × Zellgröße + 7 × 2px Gap + 16px Padding
                maxHeight: 8 * cellSize + 7 * 2 + 16,
              }}>
                {gridCells.map(({ row, col, bgColor, text }) => {
                  const isSelected = selectedCells.has(`${row}:${col}`)
                  return (
                    <div
                      key={`${row}:${col}`}
                      onClick={(e) => handleCellClick(row, col, e)}
                      title={`Zeile ${row + 1}, Spalte ${col + 1}`}
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
              {selectedCells.size > 0 && (
                <div style={{ fontSize: 11, color: '#8896aa', marginTop: 6 }}>
                  {selectedCells.size === 1
                    ? (() => {
                        const [r, c] = [...selectedCells][0].split(':').map(Number)
                        return `Zeile ${r + 1}, Spalte ${c + 1}`
                      })()
                    : `${selectedCells.size} Buttons ausgewählt`}
                </div>
              )}
            </div>
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
            disabled={selectedCells.size === 0}
            style={{
              padding: '7px 16px', borderRadius: 6, border: '1px solid #4a9eff',
              background: selectedCells.size > 0 ? 'rgba(74,158,255,0.15)' : '#1a2030',
              color: selectedCells.size > 0 ? '#4a9eff' : '#4a5568',
              fontSize: 13, cursor: selectedCells.size > 0 ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

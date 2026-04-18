import type { CompanionRef } from '@cwp/shared'

/**
 * Returns true if the button has visible content (non-black bg or non-empty text).
 */
export function isConfiguredButton(bgColor: string | undefined, text: string | undefined): boolean {
  const hasBg = bgColor !== undefined && bgColor !== '#000000'
  const hasText = text !== undefined && text !== ''
  return hasBg || hasText
}

/**
 * Builds a Set of "row:col" keys for all cells in the rectangle
 * defined by two corner cells (order-independent).
 */
export function buildRangeSelection(
  from: { row: number; col: number },
  to: { row: number; col: number },
): Set<string> {
  const minRow = Math.min(from.row, to.row)
  const maxRow = Math.max(from.row, to.row)
  const minCol = Math.min(from.col, to.col)
  const maxCol = Math.max(from.col, to.col)
  const result = new Set<string>()
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      result.add(`${r}:${c}`)
    }
  }
  return result
}

/**
 * Converts an array of Companion grid positions into compact canvas positions.
 * Input is sorted by row then col; buttons are placed row by row without gaps.
 * Returns one {x, y} per input cell (same index order after sorting).
 */
export function compactLayout(
  cells: { row: number; col: number }[],
  canvasPos: { x: number; y: number },
  buttonSize: number,
): { x: number; y: number }[] {
  if (cells.length === 0) return []

  const sorted = [...cells].sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col)

  // Group by companion row → each group = one canvas row
  const groups: { row: number; col: number }[][] = []
  let lastRow = -1
  for (const cell of sorted) {
    if (cell.row !== lastRow) {
      groups.push([])
      lastRow = cell.row
    }
    groups[groups.length - 1].push(cell)
  }

  // Build a lookup from "row:col" → canvas {x, y}
  const posMap = new Map<string, { x: number; y: number }>()
  groups.forEach((group, rowIndex) => {
    group.forEach((cell, colIndex) => {
      posMap.set(`${cell.row}:${cell.col}`, {
        x: canvasPos.x + colIndex * buttonSize,
        y: canvasPos.y + rowIndex * buttonSize,
      })
    })
  })

  // Return in same order as sorted input
  return sorted.map((cell) => posMap.get(`${cell.row}:${cell.col}`)!)
}

/**
 * Parses a "row:col" key back into {row, col} numbers.
 */
export function parseCellKey(key: string): { row: number; col: number } {
  const [r, c] = key.split(':').map(Number)
  return { row: r, col: c }
}

/**
 * Builds a sorted CompanionRef array from a Set of "row:col" keys.
 */
export function selectedCellsToRefs(
  selectedCells: Set<string>,
  hostId: string,
  page: number,
): CompanionRef[] {
  return [...selectedCells]
    .map(parseCellKey)
    .sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col)
    .map(({ row, col }) => ({ hostId, page, row, col }))
}

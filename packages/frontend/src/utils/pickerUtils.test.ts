import { describe, it, expect } from 'vitest'
import { buildRangeSelection, compactLayout, isConfiguredButton } from './pickerUtils'

describe('isConfiguredButton', () => {
  it('returns false for empty button', () => {
    expect(isConfiguredButton(undefined, undefined)).toBe(false)
  })
  it('returns false for black bg and no text', () => {
    expect(isConfiguredButton('#000000', '')).toBe(false)
  })
  it('returns true for non-black bg', () => {
    expect(isConfiguredButton('#ff0000', '')).toBe(true)
  })
  it('returns true for text only', () => {
    expect(isConfiguredButton(undefined, 'OBS')).toBe(true)
  })
  it('returns true for non-black bg with text', () => {
    expect(isConfiguredButton('#1a9fff', 'REC')).toBe(true)
  })
})

describe('buildRangeSelection', () => {
  it('selects single cell when from === to', () => {
    const result = buildRangeSelection({ row: 1, col: 2 }, { row: 1, col: 2 })
    expect(result).toEqual(new Set(['1:2']))
  })
  it('selects row range left-to-right', () => {
    const result = buildRangeSelection({ row: 0, col: 1 }, { row: 0, col: 3 })
    expect(result).toEqual(new Set(['0:1', '0:2', '0:3']))
  })
  it('selects row range right-to-left', () => {
    const result = buildRangeSelection({ row: 0, col: 3 }, { row: 0, col: 1 })
    expect(result).toEqual(new Set(['0:1', '0:2', '0:3']))
  })
  it('selects rectangular range across rows', () => {
    const result = buildRangeSelection({ row: 1, col: 1 }, { row: 2, col: 2 })
    expect(result).toEqual(new Set(['1:1', '1:2', '2:1', '2:2']))
  })
  it('works when from is bottom-right of to', () => {
    const result = buildRangeSelection({ row: 2, col: 3 }, { row: 1, col: 1 })
    expect(result).toEqual(new Set(['1:1', '1:2', '1:3', '2:1', '2:2', '2:3']))
  })
})

describe('compactLayout', () => {
  it('returns empty array for empty input', () => {
    expect(compactLayout([], { x: 0, y: 0 }, 120)).toEqual([])
  })
  it('places single button at canvasPos', () => {
    const result = compactLayout([{ row: 2, col: 3 }], { x: 100, y: 200 }, 120)
    expect(result).toEqual([{ x: 100, y: 200 }])
  })
  it('places two same-row buttons side by side, no gap', () => {
    const result = compactLayout(
      [{ row: 2, col: 1 }, { row: 2, col: 4 }],
      { x: 0, y: 0 },
      120,
    )
    expect(result).toEqual([{ x: 0, y: 0 }, { x: 120, y: 0 }])
  })
  it('places buttons from different rows on new canvas rows', () => {
    const result = compactLayout(
      [{ row: 2, col: 1 }, { row: 2, col: 4 }, { row: 3, col: 2 }],
      { x: 50, y: 50 },
      120,
    )
    expect(result).toEqual([
      { x: 50, y: 50 },
      { x: 170, y: 50 },
      { x: 50, y: 170 },
    ])
  })
  it('sorts input by row then col before laying out', () => {
    // unsorted input — same result as sorted
    const result = compactLayout(
      [{ row: 3, col: 2 }, { row: 2, col: 4 }, { row: 2, col: 1 }],
      { x: 0, y: 0 },
      120,
    )
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 0, y: 120 },
    ])
  })
})

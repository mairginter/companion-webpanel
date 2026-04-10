import { describe, it, expect } from 'vitest'
import { parseChannelStripText, parsePanValue, isMuted } from './channelStrip'

describe('parseChannelStripText', () => {
  it('parses pipe-separated values by index', () => {
    const result = parseChannelStripText('-18.5|-12.0|-6.0|Guitar', '|', { meterLIndex: 0, meterRIndex: 1, levelIndex: 2, nameIndex: 3 })
    expect(result.meterL).toBeCloseTo(-18.5)
    expect(result.meterR).toBeCloseTo(-12.0)
    expect(result.level).toBeCloseTo(-6.0)
    expect(result.name).toBe('Guitar')
  })

  it('returns undefined for unset indices', () => {
    const result = parseChannelStripText('-18.5', '|', { meterLIndex: 0 })
    expect(result.meterL).toBeCloseTo(-18.5)
    expect(result.meterR).toBeUndefined()
    expect(result.level).toBeUndefined()
    expect(result.name).toBeUndefined()
  })

  it('treats "-oo" (Wing) as -144', () => {
    const result = parseChannelStripText('-oo|-inf', '|', { meterLIndex: 0, meterRIndex: 1 })
    expect(result.meterL).toBe(-144)
    expect(result.meterR).toBe(-144)
  })

  it('ignores NaN values', () => {
    const result = parseChannelStripText('bad', '|', { meterLIndex: 0 })
    expect(result.meterL).toBeUndefined()
  })

  it('uses entire text as meterL when no separator configured', () => {
    const result = parseChannelStripText('-12.0', '', { meterLIndex: 0 })
    expect(result.meterL).toBeCloseTo(-12.0)
  })

  it('handles custom separator', () => {
    const result = parseChannelStripText('-10.0;Guitar', ';', { meterLIndex: 0, nameIndex: 1 })
    expect(result.meterL).toBeCloseTo(-10.0)
    expect(result.name).toBe('Guitar')
  })
})

describe('parsePanValue', () => {
  it('returns 0 for center strings', () => {
    expect(parsePanValue('C')).toBe(0)
    expect(parsePanValue('CTR')).toBe(0)
  })

  it('parses L/R offset strings', () => {
    expect(parsePanValue('L20')).toBeCloseTo(-0.2)
    expect(parsePanValue('R10')).toBeCloseTo(0.1)
    expect(parsePanValue('L100')).toBeCloseTo(-1.0)
    expect(parsePanValue('R100')).toBeCloseTo(1.0)
  })

  it('parses numeric -1.0..+1.0', () => {
    expect(parsePanValue('-0.5')).toBeCloseTo(-0.5)
    expect(parsePanValue('0.75')).toBeCloseTo(0.75)
    expect(parsePanValue('0')).toBe(0)
  })

  it('returns 0 for unrecognized strings', () => {
    expect(parsePanValue('???')).toBe(0)
    expect(parsePanValue('')).toBe(0)
  })
})

describe('isMuted', () => {
  it('returns false for undefined or empty bgColor', () => {
    expect(isMuted(undefined)).toBe(false)
    expect(isMuted('')).toBe(false)
  })

  it('returns false for near-black colors (default companion background)', () => {
    expect(isMuted('#000000')).toBe(false)
    expect(isMuted('#0a0e14')).toBe(false)
    expect(isMuted('#121821')).toBe(false)
  })

  it('returns true for bright/saturated colors (active feedback)', () => {
    expect(isMuted('#ff0000')).toBe(true)  // red = muted
    expect(isMuted('#ff5a5f')).toBe(true)
    expect(isMuted('#ff8a3d')).toBe(true)  // orange
    expect(isMuted('#21d07a')).toBe(true)  // green
    expect(isMuted('#4a9eff')).toBe(true)  // blue
    expect(isMuted('#ffffff')).toBe(true)
  })
})

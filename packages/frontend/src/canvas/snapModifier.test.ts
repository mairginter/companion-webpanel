import { describe, it, expect } from 'vitest'
import { magneticSnap } from './snapModifier'

// Grid 40px, Threshold 8px
describe('magneticSnap', () => {
  it('freie Bewegung in der Mitte', () => {
    expect(magneticSnap(20, 40, 8)).toBe(20)
  })
  it('snap nach links wenn rest < threshold', () => {
    expect(magneticSnap(5, 40, 8)).toBe(0)
    expect(magneticSnap(45, 40, 8)).toBe(40)
  })
  it('snap nach rechts wenn rest > gridSize - threshold', () => {
    expect(magneticSnap(37, 40, 8)).toBe(40)
    expect(magneticSnap(77, 40, 8)).toBe(80)
  })
  it('kein snap genau an der Threshold-Grenze', () => {
    expect(magneticSnap(8, 40, 8)).toBe(8)
    expect(magneticSnap(32, 40, 8)).toBe(32)
  })
  it('negative Werte', () => {
    expect(magneticSnap(-3, 40, 8)).toBe(0)
  })
})

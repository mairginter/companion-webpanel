/**
 * LassoSelect.tsx
 *
 * Reine SVG-Darstellung des Freihand-Lasso im Edit-Mode.
 * Keine Pointer-Logik — bekommt Punkte als Prop von Canvas.tsx.
 */

import { Point } from '../../utils/geometry'

interface Props {
  points: Point[]
}

export function LassoSelect({ points }: Props) {
  if (points.length < 2) return null

  // M = moveTo erster Punkt, L = lineTo alle weiteren, Z = schließen
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ') + ' Z'

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 500,
      }}
    >
      <path
        d={d}
        fill="rgba(74,158,255,0.06)"
        fillRule="evenodd"
        stroke="#4a9eff"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

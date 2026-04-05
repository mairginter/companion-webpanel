/**
 * textures.ts
 *
 * Canvas-Hintergrund-Texturen als reine CSS background-image Werte.
 * Keine externen Bilder — alle Patterns sind SVG data URIs oder CSS-Gradienten.
 * Die Farbe des Hintergrunds (background-color) bleibt separat und wird durch
 * die Textur nur überlagert (semitransparente Patterns).
 */

export interface TextureOption {
  id: string
  label: string
  /** CSS background-image Wert (ohne background-color) */
  css: string
  /** CSS background-size — nötig wenn linear-gradient kacheln soll */
  backgroundSize?: string
}

// ─── SVG helper ──────────────────────────────────────────────────────────────

const svg = (content: string, w: number, h: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${content}</svg>`,
  )}")`

// ─── Texturen ────────────────────────────────────────────────────────────────

export const TEXTURES: TextureOption[] = [
  {
    id: 'none',
    label: 'Keine',
    css: 'none',
  },
  {
    id: 'leather',
    label: 'Schwarzes Leder',
    // Quilted / gestepptes Leder — reine CSS-Gradienten:
    //  1. 45°-Nahtlinie: dunkle Falte + schmale Lichtkante (Prägungseffekt)
    //  2. -45°-Nahtlinie: selbe Technik → ergibt Rautengitter
    //  3. Flächenschattierung je Raute: hell NW / dunkel SE → 3D-Relief
    //  4. Feine Körnung via SVG-Rauschen
    //  background-size: 32×32px → jede Raute ist ~22px breit
    css: [
      // Feine Lederkörnung obenauf (SVG fractalNoise, sehr subtil)
      `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feBlend in='SourceGraphic' mode='soft-light' result='blend'/><feComposite in='blend' in2='SourceGraphic' operator='in'/></filter><rect width='128' height='128' filter='url(%23g)' opacity='0.09'/></svg>`,
      )}")`,
      // Naht 45°: dunkle Nut + helle Aufwölbung daneben
      `linear-gradient(
        45deg,
        transparent 43%,
        rgba(0,0,0,0.65)  43%, rgba(0,0,0,0.65)  49%,
        rgba(255,255,255,0.10) 49%, rgba(255,255,255,0.10) 54%,
        transparent 54%
      )`,
      // Naht -45°: selbes Prinzip
      `linear-gradient(
        -45deg,
        transparent 43%,
        rgba(0,0,0,0.65)  43%, rgba(0,0,0,0.65)  49%,
        rgba(255,255,255,0.10) 49%, rgba(255,255,255,0.10) 54%,
        transparent 54%
      )`,
      // Flächenschattierung: obere Hälfte der Raute heller, untere dunkler
      `linear-gradient(
        135deg,
        rgba(255,255,255,0.07) 0%,
        rgba(255,255,255,0.07) 50%,
        rgba(0,0,0,0.14)       50%,
        rgba(0,0,0,0.14)      100%
      )`,
    ].join(', '),
    backgroundSize: '32px 32px',
  },
  {
    id: 'carbon',
    label: 'Carbon Fiber',
    css: svg(
      `<rect x='0' y='0' width='2' height='4' fill='rgba(255,255,255,0.07)'/>
       <rect x='2' y='4' width='2' height='4' fill='rgba(255,255,255,0.07)'/>
       <rect x='0' y='0' width='4' height='4' fill='none' stroke='rgba(0,0,0,0.35)' stroke-width='0.4'/>
       <rect x='0' y='4' width='4' height='4' fill='none' stroke='rgba(0,0,0,0.35)' stroke-width='0.4'/>`,
      4, 8,
    ),
  },
  {
    id: 'metal',
    label: 'Gebürstetes Metall',
    css: [
      svg(
        `<line x1='0' y1='1' x2='40' y2='1' stroke='rgba(255,255,255,0.06)' stroke-width='0.5'/>
         <line x1='0' y1='3' x2='40' y2='3' stroke='rgba(0,0,0,0.1)' stroke-width='0.5'/>`,
        40, 4,
      ),
      `linear-gradient(
        105deg,
        rgba(255,255,255,0.0) 0%,
        rgba(255,255,255,0.04) 48%,
        rgba(255,255,255,0.0) 50%,
        rgba(255,255,255,0.02) 100%
      )`,
    ].join(', '),
  },
  {
    id: 'linen',
    label: 'Leinen / Stoff',
    css: svg(
      `<line x1='0' y1='0' x2='4' y2='4' stroke='rgba(255,255,255,0.06)' stroke-width='0.6'/>
       <line x1='4' y1='0' x2='0' y2='4' stroke='rgba(0,0,0,0.12)' stroke-width='0.6'/>`,
      4, 4,
    ),
  },
  {
    id: 'dots',
    label: 'Perforiert',
    css: svg(
      `<circle cx='3' cy='3' r='1.2' fill='rgba(0,0,0,0.4)'/>
       <circle cx='3' cy='3' r='0.8' fill='rgba(255,255,255,0.04)'/>`,
      6, 6,
    ),
  },
  {
    id: 'hex',
    label: 'Waben (Hex)',
    css: svg(
      `<polygon points='8,0 14,3.5 14,10.5 8,14 2,10.5 2,3.5' fill='none' stroke='rgba(255,255,255,0.07)' stroke-width='0.6'/>`,
      16, 14,
    ),
  },
  {
    id: 'concrete',
    label: 'Beton',
    css: [
      `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
          <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter>
          <rect width='200' height='200' filter='url(%23n)' opacity='0.08'/>
        </svg>`,
      )}")`,
      `repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0,0,0,0.04) 2px,
        rgba(0,0,0,0.04) 3px
      )`,
    ].join(', '),
  },
]

export const TEXTURE_MAP = new Map(TEXTURES.map((t) => [t.id, t]))

export function getTextureCss(id: string | undefined): string {
  if (!id || id === 'none') return 'none'
  return TEXTURE_MAP.get(id)?.css ?? 'none'
}

export function getTextureBackgroundSize(id: string | undefined): string | undefined {
  if (!id || id === 'none') return undefined
  return TEXTURE_MAP.get(id)?.backgroundSize
}

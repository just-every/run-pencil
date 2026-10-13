/**
 * Pencil's mark: a yellow hexagonal pencil (three painted facets), brass ferrule, pink eraser and a sharpened graphite
 * tip. It is drawn along x with the tip on the left, then turned so it writes toward the lower left. PencilMark.tsx
 * renders it inline and scripts/generate-site-icons.mjs writes the SVG and PNG icons from this same data, so the
 * header, footer and favicon always match. Plain data only: Node strips the types when the script imports it.
 */
interface MarkPart {
  readonly d: string
  readonly fill?: string
  readonly stroke?: string
  readonly strokeWidth?: number
  /** The silhouette outline, which the favicon lightens when the browser theme is dark. */
  readonly outline?: boolean
}

export const markViewBox = '0 0 32 32'
export const markTransform = 'rotate(-45 16 16)'

const ink = '#1e2124'

export const markParts: readonly MarkPart[] = [
  { d: 'M1.4 16 10.4 10V22Z', fill: '#f1d4a4' },
  { d: 'M1.4 16 5.7 13.1V18.9Z', fill: '#3a3f45' },
  { d: 'M10.4 10Q8.4 11.6 10.4 13.1H22.4V10Z', fill: '#f9d272' },
  { d: 'M10.4 13.1Q8.4 15.9 10.4 18.6H22.4V13.1Z', fill: '#f2b33d' },
  { d: 'M10.4 18.6Q8.4 20.3 10.4 22H22.4V18.6Z', fill: '#c98a12' },
  { d: 'M22.4 10H26.4V22H22.4Z', fill: '#d7b468' },
  { d: 'M23.8 10V22M25 10V22', stroke: '#8c6a26', strokeWidth: 0.7 },
  { d: 'M26.4 10H28A2.6 2.6 0 0 1 30.6 12.6V19.4A2.6 2.6 0 0 1 28 22H26.4Z', fill: '#e7a3a6' },
  { d: 'M10.4 10Q8.4 11.6 10.4 13.1Q8.4 15.9 10.4 18.6Q8.4 20.3 10.4 22M22.4 10V22M26.4 10V22', stroke: ink, strokeWidth: 1.2 },
  { d: 'M1.4 16 10.4 10H28A2.6 2.6 0 0 1 30.6 12.6V19.4A2.6 2.6 0 0 1 28 22H10.4Z', stroke: ink, strokeWidth: 1.7, outline: true },
]

import type { CSSProperties } from 'react'

/**
 * Geometry of the pencil loop drawn around a chosen answer: an imperfect ellipse, drawn anticlockwise from the top
 * right the way a hand circles a word, closing slightly inside itself so its end overshoots past its start.
 * Units are hundredths of an em of the answer's font, so the loop scales with the card at every width.
 * The SVG box is the answer button (`buttonPad` around a `lineHeight` line) grown by `loopBleed` on each side.
 */
const loopBleed = { x: 0.3, y: 0.26 } as const
const buttonPad = { x: 0.28, y: 0.1 } as const
const lineHeight = 1.2
const margin = 6

/** The same box for note-card.css, which sizes the answer buttons and their loops from these properties alone. */
export const answerBoxVars = {
  '--answer-pad-x': `${buttonPad.x}em`,
  '--answer-pad-y': `${buttonPad.y}em`,
  '--answer-line': lineHeight,
  '--loop-bleed-x': `${loopBleed.x}em`,
  '--loop-bleed-y': `${loopBleed.y}em`,
} as CSSProperties

export interface LoopShape {
  readonly width: number
  readonly height: number
  readonly d: string
}

type Point = readonly [number, number]

function smoothPath(points: readonly Point[]): string {
  const at = (index: number) => points[Math.max(0, Math.min(points.length - 1, index))]
  const fixed = (value: number) => value.toFixed(1)
  let d = `M${fixed(points[0][0])} ${fixed(points[0][1])}`
  for (let index = 0; index < points.length - 1; index++) {
    const [before, from, to, after] = [at(index - 1), at(index), at(index + 1), at(index + 2)]
    const c1 = [from[0] + (to[0] - before[0]) / 6, from[1] + (to[1] - before[1]) / 6]
    const c2 = [to[0] - (after[0] - from[0]) / 6, to[1] - (after[1] - from[1]) / 6]
    d += `C${fixed(c1[0])} ${fixed(c1[1])} ${fixed(c2[0])} ${fixed(c2[1])} ${fixed(to[0])} ${fixed(to[1])}`
  }
  return d
}

/** A deterministic loop for a label `widthEm` wide; `seed` varies the wobble so no two answers share a shape. */
export function pencilLoop(widthEm: number, seed: number): LoopShape {
  const width = Math.round((widthEm + 2 * (buttonPad.x + loopBleed.x)) * 100)
  const height = Math.round((lineHeight + 2 * (buttonPad.y + loopBleed.y)) * 100)
  const start = -0.95
  const sweep = Math.PI * 2 + 0.6
  const tilt = -0.05
  const steps = 32
  const raw: Point[] = []
  for (let step = 0; step <= steps; step++) {
    const progress = step / steps
    const angle = start - sweep * progress
    const radius = (1 + 0.035 * Math.sin(2 * angle + seed) + 0.02 * Math.sin(3 * angle + seed * 1.7)) * (1.025 - 0.05 * progress)
    const x = Math.cos(angle) * radius * width
    const y = Math.sin(angle) * radius * height
    raw.push([x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt)])
  }
  const xs = raw.map(point => point[0])
  const ys = raw.map(point => point[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const fit = raw.map(([x, y]): Point => [
    margin + (x - minX) / (maxX - minX) * (width - 2 * margin),
    margin + (y - minY) / (maxY - minY) * (height - 2 * margin),
  ])
  return { width, height, d: smoothPath(fit) }
}

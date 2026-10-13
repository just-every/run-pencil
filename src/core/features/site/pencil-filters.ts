import type { CSSProperties } from 'react'

/**
 * The one source of the product page's pencil filter ids, which PencilFilters.tsx defines once per page:
 * - grain: speckles each sketch stroke and wash into graphite and nudges its edges by about a pixel;
 * - tooth: lets a little paper show through handwriting, on the hero card and on the plates alike;
 * - smudge: the soft graphite shading rubbed in under a drawn sheet;
 * - loop: a coarser tooth for the hero card's pencil loops and the trail running off the card.
 */
const ids = { grain: 'pencil-grain', tooth: 'pencil-tooth', smudge: 'pencil-smudge', loop: 'pencil-loop-grain' } as const

export type PencilFilterName = keyof typeof ids

export const pencilFilterId = (name: PencilFilterName) => ids[name]

/** A filter reference for markup: `<g filter={pencilFilter('grain')}>`. */
export const pencilFilter = (name: PencilFilterName) => `url(#${ids[name]})`

/**
 * The same references as custom properties (`--filter-grain`, `--filter-tooth`, ...), so stylesheets apply them with
 * `filter: var(--filter-tooth)` instead of repeating an id. Each feature sets them on its root element.
 */
export const pencilFilterVars = Object.fromEntries(
  (Object.keys(ids) as PencilFilterName[]).map(name => [`--filter-${name}`, pencilFilter(name)]),
) as CSSProperties

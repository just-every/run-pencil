import { pencilFilterId } from './pencil-filters'

/**
 * Defines the product page's pencil filters once (ids and roles in pencil-filters.ts), for the hero card and the
 * plates alike. Rendered at zero size; kept in the layout (not display:none) because some browsers drop filters
 * defined inside an undisplayed SVG.
 */
export function PencilFilters() {
  return (
    <svg className="pencil-filters" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <filter id={pencilFilterId('grain')} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves={2} seed={7} result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.6 -0.5" result="grain" />
          <feComposite in="SourceGraphic" in2="grain" operator="in" result="grained" />
          <feDisplacementMap in="grained" in2="noise" scale={1.2} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={pencilFilterId('tooth')} x="-25%" y="-60%" width="150%" height="220%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={4} result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.72" result="tooth" />
          <feComposite in="SourceGraphic" in2="tooth" operator="in" />
        </filter>
        <filter id={pencilFilterId('smudge')} x="-15%" y="-30%" width="130%" height="175%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="8 6" result="soft" />
          <feOffset in="soft" dx="-6" dy="11" result="shade" />
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.45" numOctaves={2} seed={3} result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.29  0 0 0 0 0.26  0 0 0 -1.1 1.25" result="tooth" />
          <feComposite in="tooth" in2="shade" operator="in" />
        </filter>
        <filter id={pencilFilterId('loop')} x="-5%" y="-10%" width="110%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves={2} seed={9} result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.7 1.8" result="tooth" />
          <feComposite in="SourceGraphic" in2="tooth" operator="in" />
        </filter>
      </defs>
    </svg>
  )
}

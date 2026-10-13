import caveat from '@fontsource/caveat/files/caveat-latin-400-normal.woff2?url'
import dmSans400 from '@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2?url'
import dmSans500 from '@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2?url'
import dmSans600 from '@fontsource/dm-sans/files/dm-sans-latin-600-normal.woff2?url'
import dmSerifDisplay from '@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2?url'
import heroCss from './styles/landing-hero.css?url'

/**
 * What the hero adds to its page's head: its stylesheet (pass to siteHead) and preloads for every face the first
 * screen shows (headline serif, body, pill and lockup weights, the card's handwriting), so none swaps in after the
 * first paint and moves the copy. They are the same Vite assets the site stylesheet's @font-face rules point at.
 */
export const heroHead = {
  stylesheets: [heroCss],
  preloads: [dmSerifDisplay, dmSans400, dmSans500, dmSans600, caveat]
    .map(href => ({ rel: 'preload', href, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' as const })),
}

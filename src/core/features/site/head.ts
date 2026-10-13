import appleTouchIcon from './brand/apple-touch-icon.png?no-inline'
import favicon32 from './brand/favicon-32.png?no-inline'
import faviconSvg from './brand/favicon.svg?no-inline'
import socialCard from './brand/social-card.png?no-inline'
import siteCss from './styles/site.css?url'

interface SitePageHead {
  readonly title: string
  readonly description: string
  /** Page stylesheets (`?url` imports), linked after the site stylesheet so they can build on its tokens. */
  readonly stylesheets?: readonly string[]
}

/** The paper colour (tokens.css --paper), for the browser's own chrome around a site page. */
const paper = '#fbfaf6'

/**
 * Head for a product site page: its own title and description, repeated as Open Graph tags, the site stylesheet, and
 * Pencil's icons. Every file is a Vite asset served same-origin under /assets. The icons and tags are added only on
 * site pages, so the product's own documents (`/`, `/f/*`, `/signin`, `/app`) keep their head unchanged.
 */
export function siteHead({ title, description, stylesheets = [] }: SitePageHead) {
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Pencil' },
      { name: 'theme-color', content: paper },
    ],
    links: [
      { rel: 'stylesheet', href: siteCss },
      ...stylesheets.map(href => ({ rel: 'stylesheet', href })),
      { rel: 'icon', type: 'image/svg+xml', href: faviconSvg },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: favicon32 },
      { rel: 'apple-touch-icon', sizes: '180x180', href: appleTouchIcon },
    ],
  }
}

/**
 * Adds the site's social card (brand/social-card.png, made by scripts/generate-social-card.mjs) to a site page's
 * head, so a shared link previews as a large image. Link previews need an absolute URL, so the card's same-origin
 * asset path is joined to the deployment's origin, or to `origin` when the page is built for another one (the run site).
 */
export async function withSocialCard<Head extends ReturnType<typeof siteHead>>(head: Head, origin?: string) {
  // Loaded only when needed: the deployment's origin comes from TanStack Start, which the run site's script never loads.
  const image = new URL(socialCard, origin ?? await (await import('./origin')).siteOrigin()).href
  return {
    ...head,
    meta: [
      ...head.meta,
      { property: 'og:image', content: image },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: 'Pencil: “Ask like you’re listening.” beside a handwritten feedback card.' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }
}

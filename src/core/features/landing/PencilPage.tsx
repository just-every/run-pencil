import { LandingSections, landingHead } from '../landing'
import { Hero, alternativeLine, heroHead } from '../landing-hero'
import { PencilFilters, SiteShell, SiteVariantProvider, siteHead, withSocialCard, type SiteVariant } from '../site'

export async function pencilHead(origin?: string) {
  const head = await withSocialCard(siteHead({
    title: 'Pencil, the open-source form builder: ask like you’re listening',
    description: `${alternativeLine}. Pencil is an open-source form builder that asks each person only what fits their last answer, so feedback feels like a conversation.`,
    stylesheets: [...heroHead.stylesheets, ...landingHead.stylesheets],
  }), origin)
  return { ...head, links: [...head.links, ...heroHead.preloads] }
}

/** Pencil's approved homepage. The run site draws it with `variant="site"`: its primary action opens the Run page. */
export function PencilPage({ variant = 'instance' }: { readonly variant?: SiteVariant }) {
  return (
    <SiteVariantProvider variant={variant}>
      <SiteShell>
        <PencilFilters />
        <Hero />
        <LandingSections />
      </SiteShell>
    </SiteVariantProvider>
  )
}

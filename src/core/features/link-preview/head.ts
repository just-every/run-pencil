import type { DocumentPreview } from './service'

export function previewHead(preview: DocumentPreview | undefined, formDoor: boolean) {
  return { meta: [
    ...(formDoor && !preview?.indexable ? [{ name: 'robots', content: 'noindex, nofollow' }] : []),
    ...(preview ? [
      { title: preview.title }, { property: 'og:title', content: preview.title },
      { property: 'og:description', content: preview.description }, { property: 'og:image', content: preview.imageUrl },
      { property: 'og:image:alt', content: preview.imageAlt }, { property: 'og:url', content: preview.canonicalUrl },
      { name: 'twitter:card', content: 'summary_large_image' },
    ] : []),
  ], links: preview ? [{ rel: 'canonical', href: preview.canonicalUrl }] : [] }
}
export const isFormDocument = (path: string) => path === '/' || /^\/(?:f|embed|i)\//.test(path)

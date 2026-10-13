import dmSans400 from '@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2?url';
import dmSans500 from '@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2?url';
import dmSans600 from '@fontsource/dm-sans/files/dm-sans-latin-600-normal.woff2?url';
import dmSans700 from '@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2?url';
import dmSerifDisplay from '@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2?url';
import { siteHead } from '../site';
import docsCss from './docs.css?url';
import type { DocsPageData } from './types';

const stylesheets = [docsCss];

/**
 * Preloads for every face a docs page shows above the fold (the title serif, body and header weights, bold labels and
 * headings), so none swaps in after the first paint and re-wraps the article. The same Vite assets the site stylesheet's
 * @font-face rules point at.
 */
const preloads = [dmSerifDisplay, dmSans400, dmSans500, dmSans600, dmSans700]
  .map(href => ({ rel: 'preload', href, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' as const }));

const withFonts = (head: ReturnType<typeof siteHead>) => ({ ...head, links: [...head.links, ...preloads] });

/** Title and description for a docs page, with the docs stylesheet linked from the server-rendered head. */
export function docsHead(page: DocsPageData) {
  return withFonts(siteHead({
    title: page.slug ? `${page.title} · Pencil docs` : 'Pencil docs',
    description: page.description,
    stylesheets,
  }));
}

/** Head for an unknown /docs address. */
export const docsNotFoundHead = withFonts(siteHead({
  title: 'Page not found · Pencil docs',
  description: 'This page is not part of the Pencil documentation.',
  stylesheets,
}));

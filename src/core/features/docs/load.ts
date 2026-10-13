import { notFound } from '@tanstack/react-router';
import type { DocsView } from './types';

// Imported on every load rather than once, so in `vite dev` the Worker reads the Markdown as it is now without reloading.
async function loadDocs() {
  const docs = await import('virtual:pencil-docs');
  // Only in `vite dev`: a broken link or page problem fails the docs routes with its message, and no other route.
  if (docs.problem) throw new Error(docs.problem);
  return docs;
}

/** A 404 that carries the navigation, so it renders inside the docs layout. */
function docsNotFound({ repository, sections, version }: Awaited<ReturnType<typeof loadDocs>>) {
  return notFound({ data: { sections, repository, version } });
}

/** A /docs page ("" is the docs home) with the navigation it sits in; an unknown slug is a 404 inside the docs layout. */
export async function loadDocsPage(slug: string): Promise<DocsView> {
  const docs = await loadDocs();
  const load = Object.hasOwn(docs.pages, slug) ? docs.pages[slug] : undefined;
  if (!load) throw docsNotFound(docs);
  return { page: (await load()).default, repository: docs.repository, sections: docs.sections, version: docs.version };
}

/** Any address below /docs that is not a page, such as /docs/a/b or /docs/install/extra: a 404 inside the docs layout. */
export async function loadDocsMissing(): Promise<never> {
  throw docsNotFound(await loadDocs());
}

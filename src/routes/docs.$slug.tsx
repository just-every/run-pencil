import { createFileRoute } from "@tanstack/react-router";
import { DocsNotFound, DocsShell, DocsPage, docsHead, docsNotFoundHead, loadDocsPage } from "../core/features/docs";
import type { DocsNav } from "../core/features/docs";
import { withSocialCard } from "../core/features/site";

/** DOCS-001. One documentation page, rendered at build time from the Markdown file docs/site.json lists for its slug. An unknown slug is a 404 inside the docs layout. */
export const Route = createFileRoute("/docs/$slug")({
  loader: ({ params }) => loadDocsPage(params.slug),
  head: ({ loaderData }) => withSocialCard(loaderData ? docsHead(loaderData.page) : docsNotFoundHead),
  component: DocsArticlePage,
  notFoundComponent: ({ data }) => <DocsShell><DocsNotFound sections={(data as DocsNav).sections} /></DocsShell>,
});

function DocsArticlePage() {
  return <DocsShell><DocsPage {...Route.useLoaderData()} /></DocsShell>;
}

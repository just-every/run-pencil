import { createFileRoute } from "@tanstack/react-router";
import { DocsPage, DocsShell, docsHead, loadDocsPage } from "../core/features/docs";
import { withSocialCard } from "../core/features/site";

/** DOCS-001. The docs home, rendered at build time from the Markdown file docs/site.json lists with slug "". */
export const Route = createFileRoute("/docs/")({
  loader: () => loadDocsPage(""),
  head: ({ loaderData }) => withSocialCard(docsHead(loaderData!.page)),
  component: DocsHome,
});

function DocsHome() {
  return <DocsShell><DocsPage {...Route.useLoaderData()} /></DocsShell>;
}

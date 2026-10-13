import { createFileRoute } from "@tanstack/react-router";
import { DocsNotFound, DocsShell, docsNotFoundHead, loadDocsMissing } from "../core/features/docs";
import type { DocsNav } from "../core/features/docs";
import { withSocialCard } from "../core/features/site";

/** DOCS-001. Every address below /docs with more than one segment (/docs/a/b, /docs/install/extra) is a 404 inside the docs layout, like an unknown slug. */
export const Route = createFileRoute("/docs/$")({
  loader: () => loadDocsMissing(),
  head: () => withSocialCard(docsNotFoundHead),
  notFoundComponent: ({ data }) => <DocsShell><DocsNotFound sections={(data as DocsNav).sections} /></DocsShell>,
});

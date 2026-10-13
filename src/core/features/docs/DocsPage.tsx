import { DocsArticle } from './DocsArticle';
import { DocsFrame } from './DocsFrame';
import { DocsPager } from './DocsPager';
import { DocsToc } from './DocsToc';
import type { DocsView } from './types';
import { useCurrentDocs } from './useCurrentDocs';

/** A documentation page: navigation, the article rendered from Markdown, the pager and the contents list. */
export function DocsPage({ page, sections, repository, version }: DocsView) {
  useCurrentDocs(version);
  const order = sections.flatMap(section => section.pages.map(entry => ({ ...entry, section: section.title })));
  const index = order.findIndex(entry => entry.slug === page.slug);
  const current = order[index];
  return <DocsFrame sections={sections} current={page.slug} label={current.label} aside={<DocsToc toc={page.toc} />}>
    <DocsArticle page={page} section={current.section} />
    <DocsPager previous={order[index - 1]} next={order[index + 1]} editUrl={`${repository.url}/edit/${repository.branch}/${page.source}`} />
  </DocsFrame>;
}

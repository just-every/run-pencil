import { DocsFrame } from './DocsFrame';
import { DocsLink } from './DocsLink';
import type { DocsNav } from './types';

/** An unknown /docs address: a 404 inside the docs layout, with the way back to every page. */
export function DocsNotFound({ sections }: Pick<DocsNav, 'sections'>) {
  return <DocsFrame sections={sections} current={null} label="Page not found">
    <header className="docs-page-head">
      <p className="docs-eyebrow">404</p>
      <h1 className="docs-title">Page not found</h1>
    </header>
    <div className="docs-prose">
      <p>This address is not part of the Pencil documentation. Pick a page from the menu, or start at the <DocsLink slug="">overview</DocsLink>.</p>
    </div>
  </DocsFrame>;
}

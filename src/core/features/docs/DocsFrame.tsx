import type { ReactNode } from 'react';
import { DocsMenu } from './DocsMenu';
import { DocsSidebar } from './DocsSidebar';
import type { DocsSection } from './types';

/** The article column's id: the docs skip link's target. */
export const docsContentId = 'docs-content';

type DocsFrameProps = { sections: DocsSection[]; current: string | null; label: string; aside?: ReactNode; children: ReactNode };

/** Sidebar | page | contents. On phones the sidebar is the menu above the page. The caller (DocsShell) supplies the page's <main>. */
export function DocsFrame({ sections, current, label, aside, children }: DocsFrameProps) {
  return <div className="pencil-docs">
    <div className="docs-shell">
      <DocsSidebar sections={sections} current={current} />
      <div id={docsContentId} className="docs-main" tabIndex={-1}>
        <DocsMenu sections={sections} current={current} label={label} />
        {children}
      </div>
      {aside}
    </div>
  </div>;
}

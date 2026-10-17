import { contractUrl } from '../site/links';
import { useSiteVariant } from '../site/variant';
import { DocsNavList } from './DocsNavList';
import type { DocsSection } from './types';

/** The section navigation beside the page, from 861px. The run site adds its contract page after the sections. */
export function DocsSidebar({ sections, current }: { sections: DocsSection[]; current: string | null }) {
  const site = useSiteVariant() === 'site';
  return <nav className="docs-sidebar" aria-label="Documentation">
    <DocsNavList sections={sections} current={current} idPrefix="docs-sidebar" />
    {site ? <div className="docs-nav-group"><ul><li><a href={contractUrl}>Contract</a></li></ul></div> : null}
  </nav>;
}

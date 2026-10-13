import type { ReactNode } from 'react';
import { SiteShell } from '../site';
import { docsContentId } from './DocsFrame';

/** The site chrome for a docs page, with the skip link going past the sidebar to the article. */
export function DocsShell({ children }: { children: ReactNode }) {
  return <SiteShell skipTarget={`#${docsContentId}`}>{children}</SiteShell>;
}

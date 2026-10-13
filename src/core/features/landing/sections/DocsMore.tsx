import { Link } from '@tanstack/react-router'

interface DocsTarget {
  readonly label: string
  /** A page slug from docs/site.json. */
  readonly slug: string
  /** A heading id on that page. */
  readonly hash?: string
}

/** One quiet text link from a homepage section to the guide page that explains it. */
export function DocsMore({ target }: { readonly target: DocsTarget }) {
  return (
    <p className="landing-more">
      <Link className="site-link" to="/docs/$slug" params={{ slug: target.slug }} hash={target.hash}>{target.label}</Link>
    </p>
  )
}

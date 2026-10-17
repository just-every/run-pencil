import { Link } from '@tanstack/react-router'
import { contractUrl, creditUrl, docsUrl, licenseUrl, sourceUrl } from './links'
import { Lockup } from './Lockup'
import { useSiteVariant } from './variant'

/** Lockup and tagline, the site links, and the Run Edit Run credit used across the product family. */
export function SiteFooter() {
  const site = useSiteVariant() === 'site'
  return (
    <footer className="site-footer">
      <div className="site-wrap">
        <div className="site-footer__bar">
          <div className="site-footer__brand">
            <Lockup size={30} />
            <p className="site-footer__tagline">Forms that listen.</p>
          </div>
          <nav className="site-footer__nav" aria-label="Footer">
            <Link to={docsUrl}>Docs</Link>
            {site && <a href={contractUrl}>Contract</a>}
            <a href={sourceUrl}>GitHub</a>
            <a href={licenseUrl}>MIT licence</a>
          </nav>
          <p className="site-footer__credit">
            Powered by Pencil · <a href={creditUrl}>runeditrun.com</a>
          </p>
        </div>
      </div>
    </footer>
  )
}

import { Link } from '@tanstack/react-router'
import { docsUrl, sourceUrl } from './links'
import { Lockup } from './Lockup'
import { PrimaryAction } from './variant'

/**
 * Lockup, then Docs and GitHub beside it, then the ink primary action pill on the right, as in the approved hero.
 * TanStack marks the Docs link `aria-current="page"` on every docs page; the stylesheet draws that as a yellow stroke.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-wrap site-header__bar">
        <Lockup size={38} />
        <nav className="site-nav" aria-label="Main">
          <Link to={docsUrl}>Docs</Link>
          <a className="site-nav__source" href={sourceUrl}>GitHub</a>
        </nav>
        <PrimaryAction className="site-pill site-pill--small site-header__cta" />
      </div>
    </header>
  )
}

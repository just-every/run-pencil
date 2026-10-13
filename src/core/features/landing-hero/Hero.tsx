import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'
import { links, PrimaryAction, useSiteVariant } from '../site'
import { alternativeLead, alternativeNames } from './alternative'
import { NoteCard } from './NoteCard'

/** The incumbents Pencil replaces, each in bold with its words held together on one line. */
function AlternativeNames() {
  const last = alternativeNames.length - 1
  return alternativeNames.map((name, index) => (
    <Fragment key={name}>
      {index === 0 ? '' : index === last ? ' and ' : ', '}
      <strong>{name.replace(/ /g, '\u00a0')}</strong>
    </Fragment>
  ))
}

/**
 * The product page's first screen: what Pencil is and its actions on the left, the live note card on the right, and
 * the proof row under the actions. On phones the proof row moves under the card, so the card's answers, follow-up
 * and hint fit the first screen and a late web font re-wrapping that row can no longer push the card down. The run
 * site's static page leaves the card's place to its island (src/site/pages.tsx), which hydrates the card on its own.
 */
export function Hero() {
  const variant = useSiteVariant()
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="site-wrap hero__grid">
        <div className="hero__copy">
          <h1 id="hero-title">Ask like you’re listening.</h1>
          <p className="site-lede hero__lede">
            Pencil is an open-source form builder that asks each person only what fits their last answer, so feedback
            feels like a conversation.
          </p>
          <p className="hero__alt">{alternativeLead} <AlternativeNames /></p>
          <div className="site-actions hero__actions">
            <PrimaryAction className="site-pill" />
            <Link className="site-link" to={links.docsUrl}>Read the docs</Link>
          </div>
        </div>
        <div className="hero__proof">
          <ul className="site-proof">
            <li>Free and open source</li>
            <li>No cookies on your forms</li>
          </ul>
        </div>
        {variant === 'site' ? <div data-site-island="note-card" style={{ display: 'contents' }} /> : <NoteCard />}
      </div>
    </section>
  )
}

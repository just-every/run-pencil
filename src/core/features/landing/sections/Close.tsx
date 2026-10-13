import { Link } from '@tanstack/react-router'
import { links, PencilLine, PrimaryAction } from '../../site'
import pencilLying from '../art/pencil-lying.webp?no-inline'
import { closeCopy } from '../copy'
import { DocsMore } from './DocsMore'

/** The page's last fork: a graphite line drawn from the resting pencil's tip that splits in two. Decorative. */
function TipFork() {
  return (
    <PencilLine
      className="close-fork"
      viewBox="0 0 300 120"
      stretch
      draws
      filter="grain"
      trunk="M 0 60 C 28 50, 60 44, 104 45"
      branches={[
        'M 104 45 C 150 46, 180 22, 236 18 C 262 16, 284 12, 298 9',
        'M 104 45 C 152 48, 186 76, 240 80 C 266 82, 286 88, 298 92',
      ]}
    />
  )
}

/** The close: the CTA once more beside the pencil, put down at last, its line still forking, and the way to try it locally. */
export function Close() {
  return (
    <section id={closeCopy.id} className="landing-close" aria-labelledby={`${closeCopy.id}-title`}>
      <div className="site-wrap landing-close__grid">
        <div className="landing-copy" data-reveal="">
          <h2 id={`${closeCopy.id}-title`}>{closeCopy.title}</h2>
          <p className="landing-sentence">{closeCopy.sentence}</p>
          <div className="site-actions landing-close__actions">
            <PrimaryAction className="site-pill" />
            <Link className="site-link" to={links.docsUrl}>{closeCopy.docs}</Link>
          </div>
          <DocsMore target={closeCopy.install} />
        </div>
        <div className="landing-close__art" data-reveal="">
          <img src={pencilLying} alt="" width={810} height={360} loading="lazy" decoding="async" />
          <TipFork />
        </div>
      </div>
    </section>
  )
}

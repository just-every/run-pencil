import { useRef } from 'react'
import { pencilFilterVars } from '../site'
import { ForkLine } from './marks/ForkLine'
import { AnswerPaths } from './sections/AnswerPaths'
import { Close } from './sections/Close'
import { Kind } from './sections/Kind'
import { MovingIn } from './sections/MovingIn'
import { OneAtATime } from './sections/OneAtATime'
import { PreviewSection } from './sections/PreviewSection'
import { Results } from './sections/Results'
import { Revisions } from './sections/Revisions'
import { Share } from './sections/Share'
import { Yours } from './sections/Yours'
import { useReveal } from './useReveal'

/**
 * Everything on /pencil below the hero: the nine story sections with their pencil plates, one forking pencil line
 * halfway (the first fork runs on from the hero card itself), and the close, whose pencil draws the last fork.
 * Its stylesheet is linked from the page head (landingHead); its pencil filters are the page's (PencilFilters,
 * rendered by the route), which the stylesheets reach through the --filter-* properties set here.
 */
export function LandingSections() {
  const root = useRef<HTMLDivElement>(null)
  useReveal(root)
  return (
    <div ref={root} className="landing" style={pencilFilterVars}>
      <OneAtATime />
      <AnswerPaths />
      <PreviewSection />
      <Revisions />
      <ForkLine />
      <Share />
      <Kind />
      <Results />
      <MovingIn />
      <Yours />
      <Close />
    </div>
  )
}

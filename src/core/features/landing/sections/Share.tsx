import { SharePlate } from '../plates/SharePlate'
import { Section } from './Section'

/** Ask wherever they are: links, embeds and invitations. */
export function Share() {
  return <Section id="share" plate={<SharePlate />} />
}

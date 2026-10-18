import type { PublicFlow } from '../../../app/api'
import { redirectShape } from '../../../shared/completionRedirect'

/** Before answering, name every possible destination and the declared data categories. */
export function CompletionDisclosure({flow}:{flow:PublicFlow}) {
  const destinations=flow.steps.flatMap(step=>{
    const redirect=step.questionSettings?.redirect
    if(step.kind!=='completion'||!redirectShape(redirect))return []
    const origin=new URL(redirect.url).origin
    const categories=[...new Set(redirect.parameters.map(item=>item.operand.startsWith('hidden:')?'declared hidden fields':item.operand.startsWith('variable:')?'calculated values':'selected answers'))]
    return [{id:step.id,origin,categories,names:redirect.parameters.map(item=>item.name)}]
  })
  return <>{destinations.map(destination=><span key={destination.id} data-disclosure="completion-redirect" style={{display:'block',marginTop:'.5rem'}}>After you submit, this form may open {destination.origin}.{destination.names.length?<> The destination’s URL receives {destination.categories.join(', ')} as these query parameters: {destination.names.join(', ')}.</>:<> No answers are added to that link.</>}</span>)}</>
}

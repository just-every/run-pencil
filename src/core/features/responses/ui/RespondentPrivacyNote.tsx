import { LockKeyhole } from 'lucide-react'
import { PaymentDisclosure } from '../../payments/ui'
import { CompletionDisclosure } from './CompletionDisclosure'
import type { PublicFlow } from '../../../app/api'
import type { PublicSeedConfig } from '../../../shared/config'

/** RESP-005: the first screen says whether the answer is anonymous and, behind one control, how answers are used. */
export function RespondentPrivacyNote({ config, flow, identity, verifiedAs, prefilled, withDestinations }: { config: PublicSeedConfig; flow: PublicFlow; identity: 'invitation' | 'link' | 'anonymous'; verifiedAs?: string; prefilled: boolean; withDestinations: boolean }) {
  const mode = verifiedAs ? `identified as ${verifiedAs} through verified form access` : identity === 'invitation' ? 'identified through your invitation' : identity === 'link' ? 'identified; values supplied by this link are unverified, and forwarding the link forwards those values' : 'anonymous'
  return <aside className="privacy-card respondent-privacy"><LockKeyhole aria-hidden="true" size={22} strokeWidth={1.6} /><span>
    Your response is {mode}.{' '}
    <details className="respondent-privacy-details"><summary className="focus-ring">How your answers are used</summary>
      <span className="respondent-privacy-body">The team at {config.publicFlowBusinessName} can see the answers you submit. {prefilled ? 'Identifying details in your answers, including prefilled values you submit, identify you to them.' : 'Identifying details you choose to type, such as an email address, identify you to them.'} Your answers are received and stored by this feedback service.
        {config.answersMayReachAi ? <span data-disclosure="ai-analysis"> If {config.publicFlowBusinessName} analyses feedback, your written answers may be sent to the AI service it chose. Separate contact, invitation and session identity is excluded. {prefilled ? 'Names, emails or other identifying details in selected text answers, including submitted prefills, are sent with those answers.' : 'Names, emails or other identifying details you type in selected text answers are sent with those answers.'}</span> : null}
        {flow.formSettings?.googleSheets ? <span data-disclosure="google-sheets" style={{ display: 'block', marginTop: '.5rem' }}>Your submitted answers are also sent to Google Sheets for this business. Identifying details you type in answers are included.</span> : null}
        {withDestinations ? <><CompletionDisclosure flow={flow} /><PaymentDisclosure flow={flow} /></> : null}
      </span>
    </details>
  </span></aside>
}

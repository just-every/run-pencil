import { formSettings } from './hiddenFields'
import type { ClosedFlow } from './errors'

/** The closed page's data for a revision (LANG-002): the published response-limit message when the target closed it, else the published closed message; none when the form left them empty. */
export function closedFlowFor(revision: { title: string; formSettingsJson: string; admissionCloseReason?: string | null }, slug: string): ClosedFlow {
  const text = formSettings(revision.formSettingsJson).text
  const message = text?.[revision.admissionCloseReason === 'target' ? 'limitMessage' : 'closedMessage']?.trim()
  return { title: revision.title, slug, ...(message ? { message } : {}) }
}

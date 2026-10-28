import { identifierCte, matchingJson, matchingValue, privacyEmailHash, privacyIdentifier } from './identity'

export type PrivacyResponse = { id: string; flowId: string; revisionId: string; state: 'released' | 'quarantined'; completedAt: string; contextJson: string }
export type PrivacySave = { sessionId: string; flowId: string; revisionId: string; answersJson: string; contextJson: string | null; currentStepId: string; createdAt: string; expiresAt: string }
export async function selectPrivacyData(db: D1Database, workspaceId: string, input: string) {
  const identifier = privacyIdentifier(input)
  const contacts = (await db.prepare(`${identifierCte} SELECT id,name,email,mobile,fields_json AS fieldsJson,opted_out_at AS optedOutAt FROM distribution_contacts
    WHERE workspace_id=? AND (${matchingValue('email')} OR ${matchingValue('mobile')} OR ${matchingJson('fields_json')}) ORDER BY id`)
    .bind(JSON.stringify([identifier]), workspaceId).all<{ id: string; name: string; email: string; mobile: string | null; fieldsJson: string; optedOutAt: string | null }>()).results
  const identifiers = [identifier, ...contacts.flatMap(contact => [privacyIdentifier(contact.email), ...(contact.mobile ? [privacyIdentifier(contact.mobile)] : [])])]
  const known = JSON.stringify(identifiers), contactIds = JSON.stringify(contacts.map(contact => contact.id))
  const participants = (await db.prepare(`${identifierCte} SELECT id,revision_id AS revisionId,contact_id AS contactId,email_snapshot AS email,name_snapshot AS name,sms_mobile_snapshot AS mobile,delivery_status AS deliveryStatus,response_status AS responseStatus
    FROM invitation_participants WHERE workspace_id=? AND (contact_id IN(SELECT value FROM json_each(?)) OR ${matchingValue('email_snapshot')} OR ${matchingValue('sms_mobile_snapshot')}) ORDER BY id`)
    .bind(known, workspaceId, contactIds).all<{ id: string; revisionId: string; contactId: string | null; email: string | null; name: string | null; mobile: string | null; deliveryStatus: string; responseStatus: string }>()).results
  const participantIds = JSON.stringify(participants.map(participant => participant.id))
  const responses = (await db.prepare(`${identifierCte} SELECT r.id,r.flow_id AS flowId,r.revision_id AS revisionId,r.state,r.completed_at AS completedAt,r.response_context_json AS contextJson FROM responses r
    WHERE r.workspace_id=? AND (r.participant_id IN(SELECT value FROM json_each(?)) OR ${matchingJson('r.response_context_json')}
      OR EXISTS(SELECT 1 FROM response_answers a WHERE a.response_id=r.id AND ${matchingJson('a.value_json')})
      OR EXISTS(SELECT 1 FROM response_versions v WHERE v.response_id=r.id AND (${matchingJson('v.answers_json')} OR ${matchingJson('v.context_json')}))) ORDER BY r.id`)
    .bind(known, workspaceId, participantIds).all<PrivacyResponse>()).results
  const hashes = JSON.stringify(await Promise.all(identifiers.filter(identity => identity.kind === 'email').map(identity => privacyEmailHash(identity.value))))
  const partials = (await db.prepare(`${identifierCte} SELECT s.session_id AS sessionId,r.flow_id AS flowId,s.revision_id AS revisionId,s.answers_json AS answersJson,s.response_context_json AS contextJson,s.current_step_id AS currentStepId,s.created_at AS createdAt,s.expires_at AS expiresAt
    FROM respondent_saves s JOIN flow_revisions r ON r.id=s.revision_id JOIN flows f ON f.id=r.flow_id
    WHERE f.workspace_id=? AND s.response_id IS NULL AND (s.participant_id IN(SELECT value FROM json_each(?)) OR s.privacy_email_hash IN(SELECT value FROM json_each(?)) OR ${matchingValue('s.delivery_email')} OR ${matchingJson('s.answers_json')} OR ${matchingJson('s.response_context_json')}
      OR EXISTS(SELECT 1 FROM session_access a WHERE a.session_id=s.session_id AND ${matchingValue('a.email')})) ORDER BY s.session_id`)
    .bind(known, workspaceId, participantIds, hashes).all<PrivacySave>()).results
  const sessions = (await db.prepare(`${identifierCte} SELECT a.session_id AS id FROM session_access a JOIN respondent_sessions s ON s.id=a.session_id JOIN flow_revisions r ON r.id=s.revision_id JOIN flows f ON f.id=r.flow_id
    WHERE f.workspace_id=? AND ${matchingValue('a.email')}`).bind(known, workspaceId).all<{ id: string }>()).results
  const responseIds = JSON.stringify(responses.map(response => response.id))
  const payments = (await db.prepare(`SELECT response_id AS responseId,provider,state,amount,currency,checkout_session_id AS checkoutSessionId,payment_intent_id AS paymentIntentId,subscription_id AS subscriptionId,refunded_amount AS refundedAmount FROM response_payments WHERE response_id IN(SELECT value FROM json_each(?)) ORDER BY response_id`)
    .bind(responseIds).all<{ responseId: string; provider: string; state: string; amount: number; currency: string; checkoutSessionId: string | null; paymentIntentId: string | null; subscriptionId: string | null; refundedAmount: number }>()).results
  const forms = (await db.prepare(`SELECT DISTINCT f.id,f.title FROM flows f WHERE f.workspace_id=? AND (f.id IN(SELECT value FROM json_each(?)) OR f.id IN(SELECT flow_id FROM flow_revisions WHERE id IN(SELECT value FROM json_each(?)))) ORDER BY f.title,f.id`)
    .bind(workspaceId, JSON.stringify([...responses, ...partials].map(row => row.flowId)), JSON.stringify(participants.map(row => row.revisionId))).all<{ id: string; title: string }>()).results
  return { identifier, known, contacts, participants, responses, partials, payments, forms, sessionIds: [...new Set([...partials.map(row => row.sessionId), ...sessions.map(row => row.id)])], counts: { responses: responses.length, partials: partials.length, contacts: contacts.length, paymentReferences: payments.length } }
}
export type PrivacySelection = Awaited<ReturnType<typeof selectPrivacyData>>

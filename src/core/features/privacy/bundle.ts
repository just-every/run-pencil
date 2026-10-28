import type { PrivacySelection } from './selection'
import type { PrivacyIntegration } from './integrations'

export async function privacyBundle(db: D1Database, selected: PrivacySelection, integrations: PrivacyIntegration[]) {
  const responses = []
  for (const response of selected.responses) {
    const answers = (await db.prepare(`SELECT a.step_id AS stepId,s.id AS questionId,s.prompt,s.question_type AS questionType,a.value_json AS value FROM response_answers a JOIN flow_steps s ON s.stable_id=a.step_id AND s.revision_id=? WHERE a.response_id=? ORDER BY s.position,s.id`)
      .bind(response.revisionId, response.id).all<{ stepId: string; questionId: string; prompt: string; questionType: string; value: string }>()).results
    const versions = (await db.prepare('SELECT number,answers_json AS answers,context_json AS context,created_at AS createdAt FROM response_versions WHERE response_id=? ORDER BY number')
      .bind(response.id).all<{ number: number; answers: string; context: string; createdAt: string }>()).results
    const { contextJson, ...record } = response
    const portableAnswers = []
    for (const {questionId, ...answer} of answers) {
      const options = (await db.prepare('SELECT stable_id AS id,value,label FROM choice_options WHERE step_id=? ORDER BY position,id').bind(questionId).all()).results
      portableAnswers.push({...answer, value: JSON.parse(answer.value), options})
    }
    responses.push({ ...record, context: JSON.parse(contextJson), answers: portableAnswers, versions: versions.map(version => ({ ...version, answers: JSON.parse(version.answers), context: JSON.parse(version.context) })) })
  }
  const contactIds = JSON.stringify(selected.contacts.map(row => row.id))
  const consent = (await db.prepare('SELECT contact_id AS contactId,consent,source,created_at AS createdAt FROM contact_consent_events WHERE contact_id IN(SELECT value FROM json_each(?)) ORDER BY created_at,id').bind(contactIds).all()).results
  const smsConsent = (await db.prepare('SELECT contact_id AS contactId,mobile,given,wording,source,created_at AS createdAt FROM sms_consent_events WHERE contact_id IN(SELECT value FROM json_each(?)) ORDER BY created_at,id').bind(contactIds).all()).results
  return {
    format: 'pencil-privacy-request.v1', generatedAt: new Date().toISOString(), identifier: selected.identifier,
    forms: selected.forms, contacts: selected.contacts.map(({ fieldsJson, ...row }) => ({ ...row, fields: JSON.parse(fieldsJson) })), consent, smsConsent,
    invitations: selected.participants, responses,
    partials: selected.partials.map(({ answersJson, contextJson, ...row }) => ({ ...row, answers: JSON.parse(answersJson), context: JSON.parse(contextJson ?? '{}') })),
    paymentReferences: selected.payments, integrations,
    // These data classes have no collection door yet; this is no claim that a provider removed data.
    uncollected: ['File-upload answers (FILE-001)', 'Signature answers (SIGN-001)', 'Automatic partial capture (PART-001)'],
  }
}

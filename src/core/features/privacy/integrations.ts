import type { PrivacySelection } from './selection'
export type PrivacyIntegration = { name: string; flowId: string | null; supportsDeletion: boolean; detail: string }
export async function privacyIntegrations(db: D1Database, workspaceId: string, selected: PrivacySelection): Promise<PrivacyIntegration[]> {
  const forms = JSON.stringify(selected.forms.map(form => form.id))
  const sheets = (await db.prepare('SELECT flow_id AS flowId,armed FROM google_sheet_links WHERE workspace_id=? AND flow_id IN(SELECT value FROM json_each(?))').bind(workspaceId, forms).all<{ flowId: string; armed: number }>()).results
  const chat = (await db.prepare('SELECT flow_id AS flowId,platform FROM chat_form_links WHERE workspace_id=? AND flow_id IN(SELECT value FROM json_each(?))').bind(workspaceId, forms).all<{ flowId: string; platform: string }>()).results
  const hooks = (await db.prepare("SELECT flow_id AS flowId,state FROM response_webhook_endpoints WHERE workspace_id=? AND (flow_id IS NULL OR flow_id IN(SELECT value FROM json_each(?)))").bind(workspaceId, forms).all<{ flowId: string | null; state: string }>()).results
  const result: PrivacyIntegration[] = [
    ...sheets.map(row => ({ name: 'Google Sheets', flowId: row.flowId, supportsDeletion: !!row.armed, detail: row.armed ? 'Erasure queues a row clear. Delivery status and retries are in the integration ledger.' : 'Reconnect this restored worksheet to deliver its queued row clear.' })),
    ...chat.map(row => ({ name: row.platform, flowId: row.flowId, supportsDeletion: false, detail: 'No deletion API is configured. Remove previously delivered messages at the destination.' })),
    ...hooks.map(row => ({ name: 'Response webhook', flowId: row.flowId, supportsDeletion: row.state !== 'paused', detail: row.state === 'paused' ? 'Paused destinations receive no deletion notice. Contact the destination.' : 'Erasure queues a deletion notice. The destination must confirm its own removal.' })),
  ]
  if (selected.payments.length) result.push({ name: 'Stripe', flowId: null, supportsDeletion: false, detail: 'Local payment references are erased. Provider financial records require a separate request; no refund or cancellation is performed.' })
  if (selected.participants.length) result.push({ name: 'Delivered invitations', flowId: null, supportsDeletion: false, detail: 'Local copies and credentials are erased. Delivered email and SMS cannot be recalled.' })
  const analysis = await db.prepare('SELECT 1 FROM analysis_evidence WHERE response_id IN(SELECT value FROM json_each(?)) LIMIT 1').bind(JSON.stringify(selected.responses.map(row => row.id))).first()
  if (analysis) result.push({ name: 'Analysis provider', flowId: null, supportsDeletion: false, detail: 'Local analysis is redacted. No provider deletion API is configured.' })
  return result
}

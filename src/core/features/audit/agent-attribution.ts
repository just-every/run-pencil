/** Attribution belongs to a native transaction, alongside its real effect. */
export type NativeAgentAttribution = {
  agent: { readonly id: string; readonly name: string }
  for: { readonly id: string }
  approvers: readonly { readonly id: string }[]
}

export function agentAuditDetails(actor: NativeAgentAttribution | undefined, feature: string) {
  return JSON.stringify({ feature, ...(actor ? { agent: { id: actor.agent.id, name: actor.agent.name }, sponsorId: actor.for.id, approverIds: actor.approvers.map(person => person.id) } : {}) })
}

/** The sponsor name is read from the current native person, never a snapshot. */
export function auditActorName(kind: string, json: string, operatorId: string, operatorName: string): string {
  if (!kind.startsWith('flow.')) return operatorName
  let value: unknown
  try { value = JSON.parse(json) } catch { return operatorName }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return operatorName
  const row = value as { feature?: unknown; sponsorId?: unknown; agent?: { id?: unknown; name?: unknown } }
  if (row.sponsorId !== operatorId || typeof row.agent?.id !== 'string' || !row.agent.id || row.agent.id.length > 200 || typeof row.agent.name !== 'string' || !row.agent.name.trim() || row.agent.name.length > 200 || /[\x00-\x1f\x7f]/.test(row.agent.name)) return operatorName
  return `${row.agent.name} for ${operatorName}`
}

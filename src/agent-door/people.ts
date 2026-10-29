import { isActiveOperator, type Operator } from '../base/operator-auth/index.mjs'
import type { PeopleAdapter, Person } from '../base/agent-door/index.ts'
import type { PencilServices } from '../core/app/services'

export interface NativeOperator extends Person { workspaceId: string }

/** Product IDs, authenticated through the existing operator-auth link. Reads never admit people. */
export function pencilPeople(db: D1Database, services: PencilServices) {
  async function nativeOperator(id: string): Promise<NativeOperator | null> {
    const row = await db.prepare(`SELECT p.id,p.workspace_id AS workspaceId,o.email,o.display_name AS name,o.role,o.status,o.version,o.created_at AS createdAt
      FROM operators p JOIN operator_auth_links l ON l.operator_id=p.id
      JOIN oa_operators o ON o.id=l.auth_id WHERE p.id=?`).bind(id)
      .first<{ id: string; workspaceId: string; email: string; name: string; role: string; status: string; version: number; createdAt: number }>()
    if (!row) return null
    if (!isActiveOperator({ ...row, displayName: row.name } as Operator)) return null
    return { id: row.id, workspaceId: row.workspaceId, email: row.email, name: row.name, role: row.role, active: true }
  }
  const owner = () => db.prepare(`SELECT p.id FROM operators p
    JOIN operator_auth_links l ON l.operator_id=p.id JOIN oa_operators o ON o.id=l.auth_id
    WHERE p.is_setup_operator=1 AND o.role='owner' ORDER BY p.created_at,p.id LIMIT 1`).first<{ id: string }>()
  const settings = () => db.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0')
    .first<{ owner_id: string | null }>()
  const people: PeopleAdapter = {
    person: nativeOperator,
    async sponsor({ sub }) {
      const binding = await settings()
      if (!binding?.owner_id) return null
      if (binding.owner_id === sub) {
        const claimed = await owner()
        return claimed ? nativeOperator(claimed.id) : null
      }
      const member = await db.prepare("SELECT operator_id FROM bs_team WHERE business_id=? AND state IN ('active','invited')")
        .bind(sub).first<{ operator_id: string | null }>()
      return member?.operator_id ? nativeOperator(member.operator_id) : null
    },
    async businessMember(person) {
      const current = await nativeOperator(person.id)
      if (!current?.active) return null
      const binding = await settings()
      if (!binding?.owner_id) return null
      if ((await owner())?.id === current.id) return { id: binding.owner_id, role: 'owner' }
      const member = await db.prepare(`SELECT business_id,business_role FROM bs_team
        WHERE operator_id=? AND state IN ('active','invited') AND business_id IS NOT NULL`)
        .bind(current.id).first<{ business_id: string; business_role: string }>()
      return member ? { id: member.business_id, role: member.business_role === 'admin' ? 'editor' : null } : null
    },
    async session(request) {
      const session = await services.auth.getSession(request)
      if (!session) return null
      const current = await nativeOperator(session.operatorId)
      return current?.active ? current : null
    },
  }
  return { people, nativeOperator, async ownerEmail() {
    const claimed = await owner()
    return claimed ? (await nativeOperator(claimed.id))?.email ?? null : null
  } }
}

import { isActiveOperator, type Operator } from '../../../base/operator-auth/index.mjs'
import type { PeopleAdapter, Person } from '../../../base/agent-door/index.ts'
import type { TeamAdapter, ManagedMember } from '../../../base/business-settings/index.ts'
import type { PencilServices } from '../services'

interface NativePerson extends Person { workspaceId: string; setup: number }

/** Authentication ids never replace the product ids used by Pencil's services. */
export function pencilPeople(db: D1Database, auth: PencilServices['auth']) {
  const read = async (id: string): Promise<NativePerson | null> => {
    const row = await db.prepare(`SELECT p.id,p.workspace_id AS workspaceId,p.email,
      p.display_name AS name,p.is_setup_operator AS setup,a.role,a.status
      FROM operators p JOIN operator_auth_links l ON l.operator_id=p.id
      JOIN oa_operators a ON a.id=l.auth_id WHERE p.id=?`).bind(id)
      .first<NativePerson & { status: string }>()
    if (!row || !isActiveOperator(row as unknown as Operator)) return null
    return { id: row.id, workspaceId: row.workspaceId, email: row.email, name: row.name,
      role: row.role, active: true, setup: row.setup }
  }
  const owner = () => db.prepare('SELECT id FROM operators WHERE is_setup_operator=1 ORDER BY created_at,id LIMIT 1').first<{ id: string }>()
  const people: PeopleAdapter = {
    person: read,
    async sponsor({ sub }) {
      const settings = await db.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0').first<{ owner_id: string | null }>()
      if (settings?.owner_id === sub) {
        const bound = await owner()
        return bound ? read(bound.id) : null
      }
      const bound = await db.prepare("SELECT operator_id FROM bs_team WHERE business_id=? AND state='active' AND EXISTS(SELECT 1 FROM bs_settings WHERE singleton=1 AND stopped=0)")
        .bind(sub).first<{ operator_id: string | null }>()
      return bound?.operator_id ? read(bound.operator_id) : null
    },
    async session(request) {
      const session = await auth.getSession(request)
      return session ? read(session.operatorId) : null
    },
    businessRole: person => (person as NativePerson).setup ? 'owner' : 'editor',
    async businessMember(person) {
      if (!await read(person.id)) return null
      const settings = await db.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0').first<{ owner_id: string | null }>()
      if (!settings) return null
      if (settings.owner_id && (await owner())?.id === person.id) return { id: settings.owner_id, role: 'owner' }
      const member = await db.prepare("SELECT business_id,business_role FROM bs_team WHERE operator_id=? AND state='active' AND business_id IS NOT NULL")
        .bind(person.id).first<{ business_id: string; business_role: string }>()
      return member ? { id: member.business_id, role: member.business_role === 'admin' ? 'editor' : null } : null
    },
  }
  const team: TeamAdapter = {
    async ownerEmail() { const bound = await owner(); return bound ? (await read(bound.id))?.email ?? null : null },
    async prepare({ members, managed, ownerEmail }) {
      // Pencil has equal operators, no lower-privilege invitation role. Pair only
      // existing native accounts; signed settings cannot create full owners.
      const rows: ManagedMember[] = await Promise.all(members.map(async member => {
        const previous = managed.find(row => member.id && row.businessId === member.id)
          ?? managed.find(row => row.email === member.email)
        // A roster may arrive before native invitation confirmation. Retry only
        // the first binding; an established native id never moves by email.
        const candidate = previous?.operatorId ? await read(previous.operatorId)
          : await db.prepare('SELECT id FROM operators WHERE lower(email)=? AND is_setup_operator=0')
            .bind(member.email).first<{ id: string }>().then(row => row ? read(row.id) : null)
        const active = candidate && member.email !== ownerEmail && !candidate.setup
        return { email: member.email, operatorId: candidate?.id ?? previous?.operatorId ?? null,
          invite: member.invite, state: active ? 'active' as const : 'conflict' as const }
      }))
      for (const old of managed) if (!members.some(member => member.id && member.id === old.businessId || member.email === old.email)) {
        rows.push({ email: old.email, operatorId: old.operatorId, invite: old.invite, state: 'inactive' })
      }
      return { statements: [], rows, async afterCommit() {} }
    },
  }
  return { people, team, read }
}

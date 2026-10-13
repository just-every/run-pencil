import { eq, sql } from 'drizzle-orm'
import type { PencilDatabase } from '../../platform/db/repository'
import { operators, workspaces } from '../../platform/db/schema'
import * as schema from '../../platform/db/schema'

export class WorkspaceRepository {
  constructor(private readonly database: PencilDatabase) {}

  async checkHealth() {
    const probes = Object.values(schema).map(table => sql`(SELECT 1 FROM ${table} LIMIT 1)`)
    for (const name of ['distribution_contacts', 'invitation_launches', 'invitation_participants', 'mail_deliveries', 'mail_delivery_attempts', 'contact_consent_events', 'notification_preferences', 'notification_deliveries', 'notification_attempts']) probes.push(sql`(SELECT 1 FROM ${sql.identifier(name)} LIMIT 1)`)
    await this.database.run(sql`SELECT ${sql.join(probes, sql`, `)}`)
  }

  async ensureWorkspace(workspace: Omit<typeof workspaces.$inferInsert, 'sendingWindowStart' | 'sendingWindowEnd'> & Partial<Pick<typeof workspaces.$inferInsert, 'sendingWindowStart' | 'sendingWindowEnd'>>) {
    await this.database.insert(workspaces).values({
      ...workspace,
      sendingWindowStart: workspace.sendingWindowStart ?? '09:00',
      sendingWindowEnd: workspace.sendingWindowEnd ?? '17:00',
    }).onConflictDoNothing()
  }

  async ensureOperator(operator: typeof operators.$inferInsert) {
    await this.database.insert(operators).values(operator).onConflictDoNothing()
  }

  async reminderDelay(id:string) {
    const result=await this.database.get<{delay:number|null}>(sql`SELECT reminder_delay_hours AS delay FROM workspaces WHERE id=${id}`)
    return result?.delay ?? null
  }
  async setReminderDelay(id:string,delay:number) { await this.database.run(sql`UPDATE workspaces SET reminder_delay_hours=${delay} WHERE id=${id}`) }
  async getWorkspace(id: string) {
    const [workspace] = await this.database.select().from(workspaces).where(eq(workspaces.id, id)).limit(1)
    return workspace
  }

  async getFirstWorkspace() {
    const [workspace] = await this.database.select().from(workspaces).orderBy(workspaces.createdAt).limit(1)
    return workspace
  }

  async completeSetup(id: string, name: string, timeZone: string, now: string) {
    const [workspace] = await this.database.update(workspaces)
      .set({ name, timeZone, brandConfigured: true, firstRunCompletedAt: now, updatedAt: now })
      .where(eq(workspaces.id, id)).returning()
    return workspace
  }

  async updateSettings(input: { id: string; timeZone: string; sendingWindowStart: string; sendingWindowEnd: string; embedAllowedOriginsJson?: string; updatedAt: string }) {
    const updated = await this.database
      .update(workspaces)
      .set({
        timeZone: input.timeZone,
        sendingWindowStart: input.sendingWindowStart,
        sendingWindowEnd: input.sendingWindowEnd,
        ...(input.embedAllowedOriginsJson !== undefined ? { embedAllowedOriginsJson: input.embedAllowedOriginsJson } : {}),
        updatedAt: input.updatedAt,
      })
      .where(eq(workspaces.id, input.id))
      .returning()
    return updated[0]
  }
}

import { and, eq, getTableColumns, sql } from 'drizzle-orm'
import { ulid } from 'ulid'
import { operatorCustodyStatements } from './operatorCustody'
import type { D1BatchExecutor } from '../../platform/db/batch'
import type { PencilDatabase } from '../../platform/db/repository'
import { localDevInbox, operators, workspaces } from '../../platform/db/schema'

export class AuthRepository {
  constructor(
    private readonly database: PencilDatabase,
    private readonly batch: D1BatchExecutor,
  ) {}

  async findOperatorByAuthId(authId: string) {
    const [operator] = await this.database
      .select(getTableColumns(operators))
      .from(operators)
      .innerJoin(sql`operator_auth_links`, sql`operator_auth_links.operator_id = ${operators.id}`)
      .where(sql`operator_auth_links.auth_id = ${authId}`)
      .limit(1)
    return operator
  }

  async findOperatorByEmail(email: string) {
    const [operator] = await this.database
      .select()
      .from(operators)
      .where(sql`lower(${operators.email}) = lower(${email})`)
      .limit(1)
    return operator
  }

  async listOperators(workspaceId: string) {
    return this.database
      .select({
        id: operators.id,
        email: operators.email,
        displayName: operators.displayName,
        isSetupOperator: operators.isSetupOperator,
        createdAt: operators.createdAt,
      })
      .from(operators)
      .where(eq(operators.workspaceId, workspaceId))
      .orderBy(operators.createdAt)
  }

  async discardUninvitedOperator(workspaceId: string, operatorId: string) {
    const [target] = await this.database.select({ id: operators.id, email: operators.email }).from(operators)
      .where(and(eq(operators.id, operatorId), eq(operators.workspaceId, workspaceId))).limit(1)
    if (!target) return 'missing' as const
    const guard = `EXISTS (SELECT 1 FROM operators WHERE id = ? AND workspace_id = ? AND is_setup_operator = 0)
      AND (SELECT count(*) FROM operators WHERE workspace_id = ?) > 1`
    const parameters = [operatorId, workspaceId, workspaceId]
    const custody = await operatorCustodyStatements(this.database, target, guard, parameters)
    const results = await this.batch.execute([
      ...custody,
      { sql: `INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at)
          SELECT ?, ?, 'operator.invitation_rolled_back', NULL, 'operator', NULL, '{"feature":"auth.invitation"}', ? WHERE ${guard}`,
        parameters: [ulid(), workspaceId, new Date().toISOString(), ...parameters] },
      { sql: `DELETE FROM operators WHERE id = ? AND ${guard}`, parameters: [operatorId, ...parameters] },
    ])
    if (results.at(-1)?.changes === 1) return 'discarded' as const
    const [retained] = await this.database.select({ id: operators.id }).from(operators)
      .where(and(eq(operators.id, operatorId), eq(operators.workspaceId, workspaceId))).limit(1)
    return retained ? 'protected' as const : 'missing' as const
  }

  async initializeSetupOperator(input: { workspaceId: string; email: string; now: string }) {
    const [workspace] = await this.database
      .select({ initializedAt: workspaces.setupOperatorInitializedAt })
      .from(workspaces)
      .where(eq(workspaces.id, input.workspaceId))
      .limit(1)
    if (!workspace) return { kind: 'missing-workspace' as const }
    if (workspace.initializedAt) return { kind: 'already-initialized' as const }

    const [existing] = await this.database
      .select({ id: operators.id, workspaceId: operators.workspaceId })
      .from(operators)
      .where(sql`lower(${operators.email}) = lower(${input.email})`)
      .limit(1)
    if (existing && existing.workspaceId !== input.workspaceId) return { kind: 'conflict' as const }

    // D1 rejects SQL BEGIN emitted by Drizzle's transaction helper. A D1 batch
    // commits or rolls back sequential statements together, so the first
    // conditional update is our durable one-time bootstrap claim. The second
    // statement runs only when that claim changed exactly one workspace row.
    const claim = {
      sql: `
      UPDATE workspaces
      SET setup_operator_initialized_at = ?, updated_at = ?
      WHERE id = ?
        AND setup_operator_initialized_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM operators
          WHERE lower(email) = lower(?) AND workspace_id <> ?
        )
    `,
      parameters: [input.now, input.now, input.workspaceId, input.email, input.workspaceId],
    }

    const operatorId = existing?.id ?? ulid()
    const applyOperator = existing
      ? {
          sql: `
          UPDATE operators
          SET is_setup_operator = 1, updated_at = ?
          WHERE id = ? AND workspace_id = ? AND changes() = 1
        `,
          parameters: [input.now, existing.id, input.workspaceId],
        }
      : {
          sql: `
          INSERT INTO operators (id, workspace_id, email, display_name, is_setup_operator, created_at, updated_at)
          SELECT ?, ?, ?, 'Setup operator', 1, ?, ?
          WHERE changes() = 1
        `,
          parameters: [operatorId, input.workspaceId, input.email, input.now, input.now],
        }

    const [claimed] = await this.batch.execute([claim, applyOperator])
    if (claimed?.changes === 1) {
      return { kind: 'initialized' as const, operatorId, created: !existing }
    }

    const [currentWorkspace] = await this.database
      .select({ initializedAt: workspaces.setupOperatorInitializedAt })
      .from(workspaces)
      .where(eq(workspaces.id, input.workspaceId))
      .limit(1)
    if (!currentWorkspace) return { kind: 'missing-workspace' as const }
    if (currentWorkspace.initializedAt) return { kind: 'already-initialized' as const }
    return { kind: 'conflict' as const }
  }

  async listLocalInbox(email: string) {
    return this.database
      .select({ id: localDevInbox.id, toEmail: localDevInbox.toEmail, magicLinkToken: localDevInbox.magicLinkToken, expiresAt: localDevInbox.expiresAt, createdAt: localDevInbox.createdAt })
      .from(localDevInbox)
      .where(sql`lower(${localDevInbox.toEmail}) = lower(${email})`)
      .orderBy(sql`${localDevInbox.createdAt} desc`)
      .limit(8)
  }

  async removeOperator(input: { workspaceId: string; actorOperatorId: string; targetOperatorId: string }) {
    const [target] = await this.database
      .select({ id: operators.id, email: operators.email, isSetupOperator: operators.isSetupOperator })
      .from(operators)
      .where(and(eq(operators.workspaceId, input.workspaceId), eq(operators.id, input.targetOperatorId)))
      .limit(1)
    if (!target) return 'missing' as const
    if (target.isSetupOperator && target.id !== input.actorOperatorId) return 'setup-protected' as const

    const guard = `EXISTS (SELECT 1 FROM operators WHERE id = ? AND workspace_id = ?
        AND (is_setup_operator = 0 OR id = ?))
      AND (SELECT count(*) FROM operators WHERE workspace_id = ?) > 1`
    const guardParameters = [target.id, input.workspaceId, input.actorOperatorId, input.workspaceId]
    const now = new Date().toISOString()
    const results = await this.batch.execute([
      ...await operatorCustodyStatements(this.database, target, guard, guardParameters),
      { sql: `INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at)
        SELECT ?, ?, 'operator.removed', CASE WHEN ? <> ? AND EXISTS (
          SELECT 1 FROM operators WHERE id = ? AND workspace_id = ?) THEN ? ELSE NULL END,
          'operator', NULL, '{}', ? WHERE ${guard}`,
        parameters: [ulid(), input.workspaceId, input.actorOperatorId, target.id, input.actorOperatorId,
          input.workspaceId, input.actorOperatorId, now, ...guardParameters] },
      { sql: `DELETE FROM operators WHERE id = ? AND ${guard}`, parameters: [target.id, ...guardParameters] },
    ])
    return results.at(-1)?.changes === 1 ? 'removed' as const : 'last-operator' as const
  }
}

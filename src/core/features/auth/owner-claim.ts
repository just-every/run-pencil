import { OwnerClaimError } from '../../../base/owner-claim/index.mjs'
import { productAdmission } from './product-admission'

// Compose the verified native bootstrap with Pencil's mapping in the same real
// D1 transaction. A product write failure rolls back the consumed claim too.
export function ownerClaimDatabase(database: D1Database): D1Database {
  const statements = new WeakMap<D1PreparedStatement, { native: D1PreparedStatement; sql: string; values: unknown[] }>()
  const statement = (native: D1PreparedStatement, sql: string, values: unknown[] = []): D1PreparedStatement => {
    const proxy = new Proxy(native, { get(target, key) {
      if (key === 'bind') return (...bound: unknown[]) => statement(target.bind(...bound), sql, bound)
      const value = Reflect.get(target, key)
      return typeof value === 'function' ? value.bind(target) : value
    } })
    statements.set(proxy, { native, sql: sql.replace(/\s+/g, ' ').trim(), values })
    return proxy
  }
  return new Proxy(database, { get(target, key) {
    if (key === 'prepare') return (sql: string) => statement(target.prepare(sql), sql)
    if (key === 'batch') return async (batch: D1PreparedStatement[]) => {
      const records = batch.map(value => statements.get(value))
      if (records.some(value => !value)) throw new OwnerClaimError('auth_protocol_changed', 503)
      const claims = records.filter(value => value!.sql.startsWith('INSERT INTO oc_owner_claims('))
      const owners = records.filter(value => value!.sql.startsWith('INSERT INTO oa_operators(id,email,display_name,role,status,created_at)'))
      const authId = owners[0]?.values[0]
      if (claims.length !== 1 || owners.length !== 1 || typeof authId !== 'string' || claims[0]!.values[6] !== authId) {
        throw new OwnerClaimError('auth_protocol_changed', 503)
      }
      const admission = productAdmission(target, authId, true)
      // The maintained claim schema's CHECK forces the whole batch to roll back
      // if the native owner could not become this installation's product owner.
      const mapped = target.prepare(`UPDATE oc_owner_claims SET completed=CASE WHEN EXISTS(
        SELECT 1 FROM operator_auth_links l JOIN operators p ON p.id=l.operator_id
        WHERE l.auth_id=? AND p.id=? AND p.is_setup_operator=1
      ) THEN 1 ELSE 2 END WHERE operator_id=?`).bind(authId, admission.operatorId, authId)
      return target.batch([...records.map(value => value!.native), ...admission.statements, mapped])
    }
    const value = Reflect.get(target, key)
    return typeof value === 'function' ? value.bind(target) : value
  } })
}

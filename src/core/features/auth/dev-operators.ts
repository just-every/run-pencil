import { productAdmission } from './product-admission'

const DEV_DOMAIN = '@dev.localhost'

/** Dev personas are real operators created by the dev layer in oa_operators. Pencil serves an operator only once a product
 * operator is linked to it, exactly as for an invited colleague, so link each persona that has none (never the setup operator). */
export async function admitDevPersonas(database: D1Database) {
  const { results } = await database.prepare(`SELECT id FROM oa_operators o WHERE lower(o.email) LIKE ? AND NOT EXISTS (SELECT 1 FROM operator_auth_links l WHERE l.auth_id=o.id)`).bind(`%${DEV_DOMAIN}`).all<{ id: string }>()
  for (const { id } of results) await database.batch(productAdmission(database, id, false).statements)
}

import { env, SELF } from 'cloudflare:test'
import { hashToken, opaqueToken } from '../../src/base/operator-auth/crypto.mjs'
import { FormImports } from '../../src/core/features/importing/service'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { createPencilServices } from '../../src/core/app/services'
import { loadPlans } from '../../src/base/import-kit/src/d1/plans'
import { importTargets } from '../../src/core/features/importing/native'

export async function importPrivacyFixture() {
  await SELF.fetch('http://localhost/health')
  const workspaceId = crypto.randomUUID(), operatorId = crypto.randomUUID(), id = crypto.randomUUID(), now = new Date().toISOString()
  const token = opaqueToken()
  await env.DB.prepare("INSERT INTO workspaces(id,name,time_zone,sending_window_start,sending_window_end,created_at,updated_at) VALUES(?,'Synthetic privacy','UTC','09:00','17:00',?,?)").bind(workspaceId, now, now).run()
  await env.DB.prepare("INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) VALUES(?,?,?,'Synthetic importer',0,?,?)").bind(operatorId, workspaceId, `${operatorId}@example.test`, now, now).run()
  await env.DB.prepare("INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES(?,?,?,1,'native',?,?)").bind(id, await hashToken(env.SESSION_SECRET, 'session', token), operatorId, Date.now(), Date.now() + 3600000).run()
  const actor = { id, workspaceId, operatorId }, imports = new FormImports(env.DB, actor)
  const services = createPencilServices(createPencilPlatform('http://localhost', env))
  const erase = (responseId: string) => {
    const requestURL = `http://localhost/api/app/responses/${responseId}`
    return SELF.fetch(requestURL, { method: 'DELETE', headers: { Host: new URL(requestURL).host, Origin: 'http://localhost', Cookie: `operator_session_local=${token}` } })
  }
  return { actor, imports, services, erase }
}
export async function allStoredData() {
  const tables = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all<{ name: string }>()).results
  const raw = await Promise.all(tables.map(async ({ name }) => ({ name, rows: (await env.DB.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all()).results })))
  const decoded = []
  // Raw substring scans cannot inspect compressed custody. Decode every page
  // independently as well, including pages never reached by native apply.
  for (const row of (await env.DB.prepare('SELECT id,plan_json FROM ik_jobs ORDER BY id').all<{ id: string; plan_json: string }>()).results) decoded.push((await loadPlans([row], env.DB, importTargets.planCodec)).get(row.id))
  return JSON.stringify({ raw, decoded })
}

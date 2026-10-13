import { env } from 'cloudflare:test'

export const originalQuestionTypes = ['short_text', 'long_text', 'email', 'single_choice', 'multiple_choice', 'rating', 'priority']
export const additionalQuestionTypes = ['dropdown', 'yes_no', 'nps', 'number', 'date', 'consent']
const at = '2026-01-01T00:00:00.000Z'

export function insertStep(id: string, position: number, type: string | null) {
  return env.DB.prepare(`INSERT INTO flow_steps
    (id, revision_id, position, kind, question_type, prompt, required, stable_id, created_at, updated_at)
    VALUES (?, 'revision-draft', ?, 'question', ?, 'New question', 1, ?, ?, ?)`).bind(id, position, type, id, at, at)
}

export async function seedQuestionSchemaFixture() {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO workspaces(id,name,time_zone,created_at,updated_at) VALUES ('workspace','Migration café','Australia/Brisbane',?,?)").bind(at, at),
    env.DB.prepare("INSERT INTO flows(id,workspace_id,slug,title,status,draft_version,last_activity_at,created_at,updated_at) VALUES ('flow','workspace','migration-flow','Retained flow','open',8,?,?,?)").bind(at, at, at),
  ])
  for (const [number, revision] of ['old', 'current', 'draft'].entries()) {
    const revisionId = `revision-${revision}`
    await env.DB.prepare(`INSERT INTO flow_revisions
      (id,flow_id,number,state,title,published_at,is_current,policy_snapshot_json,created_at,updated_at)
      VALUES (?,'flow',?,?,?, ?,?, ?,?,?)`).bind(revisionId, number + 1, revision === 'draft' ? 'draft' : 'published', `Revision ${revision}`, revision === 'draft' ? null : at, revision === 'current' ? 1 : 0, '{"branchSelection":"first-match"}', at, at).run()
    for (const [position, type] of [null, ...originalQuestionTypes, null].entries()) {
      const kind = type ? 'question' : position === 0 ? 'welcome' : 'completion'
      await env.DB.prepare(`INSERT INTO flow_steps
        (id,revision_id,position,kind,question_type,prompt,helper_text,required,created_at,updated_at,stable_id,next_step_stable_id,question_settings_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(`${revision}-${position}`, revisionId, position, kind, type, `${revision}: original café "prompt"`, 'Original\nhelper', type ? 1 : 0, at, at, `stable-${position}`, position === 8 ? null : `stable-${position + 1}`, type ? '{"min":1,"max":5}' : null).run()
      if (['single_choice', 'multiple_choice', 'priority'].includes(type ?? '')) {
        for (const choice of [0, 1]) {
          await env.DB.prepare(`INSERT INTO choice_options
            (id,step_id,value,label,position,created_at,updated_at,stable_id) VALUES (?,?,?,?,?,?,?,?)`)
            .bind(`${revision}-${position}-choice-${choice}`, `${revision}-${position}`, `value-${choice}`, `Choice ${choice} café`, choice, at, at, `stable-choice-${position}-${choice}`).run()
        }
      }
    }
    await env.DB.prepare(`INSERT INTO flow_branch_rules
      (id,revision_id,source_step_stable_id,predicate_kind,expected_value_json,destination_step_stable_id,position,created_at,updated_at)
      VALUES (?,?,'stable-4','equals','"stable-choice-4-1"','stable-8',0,?,?)`).bind(`branch-${revision}`, revisionId, at, at).run()
    if (revision === 'draft') continue
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO responses
        (id,workspace_id,flow_id,revision_id,session_id,session_token_hash,idempotency_key,state,completion_milliseconds,completed_at,created_at,updated_at,source,started_at)
        VALUES (?,'workspace','flow',?,?,?,?,'released',1234,?,?,?,'direct',?)`).bind(`response-${revision}`, revisionId, `completed-${revision}`, `synthetic-${revision}`, `command-${revision}`, at, at, at, at),
      env.DB.prepare(`INSERT INTO response_answers (id,response_id,step_id,value_json,created_at,updated_at)
        VALUES (?,?,'stable-4','"stable-choice-4-1"',?,?)`).bind(`answer-${revision}`, `response-${revision}`, at, at),
      env.DB.prepare(`INSERT INTO response_answers (id,response_id,step_id,value_json,created_at,updated_at)
        VALUES (?,?,'stable-1',?, ?,?)`).bind(`text-answer-${revision}`, `response-${revision}`, JSON.stringify('Original\nanswer "café"'), at, at),
      env.DB.prepare(`INSERT INTO respondent_sessions
        (id,revision_id,source,device_class,furthest_step_id,expires_at,created_at,updated_at,session_token_hash)
        VALUES (?,?,'embed','mobile','stable-4','2027-01-01',?,?,?)`).bind(`active-${revision}`, revisionId, at, at, `synthetic-active-${revision}`),
      env.DB.prepare(`INSERT INTO respondent_session_step_events (id,session_id,revision_id,step_stable_id,counted_at,created_at)
        VALUES (?,?,?,'stable-4',?,?)`).bind(`event-${revision}`, `active-${revision}`, revisionId, at, at),
      env.DB.prepare(`INSERT INTO revision_step_metric_counters (id,revision_id,step_stable_id,reached,dropped,created_at,updated_at)
        VALUES (?,?,'stable-4',3,1,?,?)`).bind(`step-metric-${revision}`, revisionId, at, at),
      env.DB.prepare(`INSERT INTO response_outbox (id,workspace_id,response_id,kind,idempotency_key,payload_json,status,available_at,created_at,updated_at)
        VALUES (?,'workspace',?,'completed',?,'{}','pending',?,?,?)`).bind(`outbox-${revision}`, `response-${revision}`, `outbox-command-${revision}`, at, at, at),
    ])
  }
}

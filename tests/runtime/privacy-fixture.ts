import { env } from 'cloudflare:test'

/** Native three-form fixture; the privacy journey collects, exports and erases through HTTP. */
export async function seedPrivacyForm(workspaceId: string, index: number) {
  const id = crypto.randomUUID(), revisionId = crypto.randomUUID(), now = new Date().toISOString()
  const slug = 'privacy-' + crypto.randomUUID().slice(0, 8), title = `Privacy form ${index + 1}`
  const steps = ['email', 'phone', 'long_text', null].map((questionType, position) => ({ id: crypto.randomUUID(), position, questionType, kind: questionType ? 'question' : 'completion', prompt: questionType ? `Privacy ${questionType}` : 'Recorded.' }))
  await env.DB.batch([
    env.DB.prepare("INSERT INTO flows(id,workspace_id,slug,title,status,draft_version,last_activity_at,created_at,updated_at) VALUES(?,?,?,?,'open',1,?,?,?)").bind(id, workspaceId, slug, title, now, now, now),
    env.DB.prepare("INSERT INTO flow_revisions(id,flow_id,number,state,title,published_at,is_current,form_settings_json,created_at,updated_at) VALUES(?,?,1,'published',?,?,1,?, ?,?)").bind(revisionId, id, title, now, JSON.stringify({ googleSheets: true }), now, now),
    ...steps.map(step => env.DB.prepare('INSERT INTO flow_steps(id,stable_id,revision_id,position,kind,question_type,prompt,required,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(step.id, step.id, revisionId, step.position, step.kind, step.questionType, step.prompt, step.questionType ? 1 : 0, now, now)),
  ])
  return { id, slug, steps }
}

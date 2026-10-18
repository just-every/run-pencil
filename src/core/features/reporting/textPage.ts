import { isOtherAnswer } from '../../shared/otherChoices'
import { NotFoundError, ValidationError } from '../../shared/errors'
import { checkGeneration, generation, openCursor, sealCursor, type EvidenceScope } from './cursor'
import { responseScope } from './scope'
import { retainedTextValid } from './textValidity'
type TextCursor = EvidenceScope & { kind: 'text' | 'text-count'; matched?: number; revisionId: string; questionId: string; searchHash: string; after?: { time: string; id: string } }
export type TextPage = { texts: string[]; cursor?: string; scanning: boolean; countCursor?: string; matching?: number }
// Unicode case folding deliberately matches the established browser behavior.
// SQLite lower()/LIKE only fold ASCII. Scan bounded, indexed pages instead.
export async function textPage(db: D1Database, secret: string, identity: { workspaceId: string; sessionId: string; flowId: string }, input: { revisionId: string; questionId: string; search: string; cursor?: string; countOnly?: boolean }, signal?: AbortSignal): Promise<TextPage> {
  signal?.throwIfAborted()
  const searchHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(input.search)))), byte=>byte.toString(16).padStart(2,'0')).join('')
  const cursor: TextCursor = input.cursor ? await openCursor(input.cursor,secret) : { kind: 'text', ...identity, revisionId: input.revisionId, questionId: input.questionId, searchHash, cutoff: new Date().toISOString(), generation: await generation(db,identity.workspaceId) }
  if (!cursor || cursor.kind !== (input.countOnly ? 'text-count' : 'text')) throw new ValidationError('Invalid answer cursor. Start again.')
  if (Object.entries(identity).some(([key,value]) => cursor[key as keyof TextCursor] !== value) || cursor.revisionId !== input.revisionId || cursor.questionId !== input.questionId || cursor.searchHash !== searchHash) throw new ValidationError('This answer cursor belongs to a different report.')
  const countCursor = !input.cursor ? await sealCursor({ ...cursor, kind:'text-count', matched:0 },secret) : undefined
  const step = await db.prepare(`SELECT s.question_type AS type, json_extract(s.question_settings_json,'$.otherChoiceId') AS otherChoiceId FROM flow_steps s JOIN flow_revisions v ON v.id = s.revision_id JOIN flows f ON f.id = v.flow_id WHERE f.id = ? AND f.workspace_id = ? AND v.id = ? AND v.state = 'published' AND s.stable_id = ?`).bind(identity.flowId,identity.workspaceId,input.revisionId,input.questionId).first<{type:string;otherChoiceId:string|null}>()
  if (!step || (!['short_text','long_text','email'].includes(step.type) && !step.otherChoiceId)) throw new NotFoundError('This published text question is unavailable.')
  await checkGeneration(db,cursor)
  const texts: string[] = []
  const needle = input.search.toLocaleLowerCase()
  let more = false
  // Each invocation scans at most 16,384 answers in 512 small result pages.
  // Including scope and consistency checks leaves ample room under 1,000 queries.
  for (let batch=0;batch<512;batch++) {
    signal?.throwIfAborted()
    const { where, bindings } = responseScope(identity.workspaceId,identity.flowId,{ revisionId: input.revisionId },cursor.cutoff)
    const after = cursor.after ? ' AND (r.completed_at < ? OR (r.completed_at = ? AND r.id < ?))' : ''
    if (cursor.after) bindings.push(cursor.after.time,cursor.after.time,cursor.after.id)
    const rows = (await db.prepare(`SELECT r.id, r.completed_at AS time, CASE WHEN length(CAST(a.value_json AS BLOB)) <= 30002 THEN a.value_json ELSE 'null' END AS value FROM responses r JOIN response_answers a ON a.response_id = r.id AND a.step_id = ? WHERE ${where}${after} ORDER BY r.completed_at DESC,r.id DESC LIMIT 32`).bind(input.questionId,...bindings).all<{id:string;time:string;value:string}>()).results
    let processed = 0
    for (const row of rows) {
      const value: unknown = JSON.parse(row.value)
      const text: unknown = step.otherChoiceId ? isOtherAnswer(value) ? value.otherText : '' : value
      if (!retainedTextValid(step.otherChoiceId ? 'short_text' : step.type,text) && text !== '') throw new Error('Invalid retained text answer.')
      cursor.after = { time: row.time, id: row.id }; processed++
      if (typeof text === 'string' && text.length && text.toLocaleLowerCase().includes(needle)) {
        if (input.countOnly) cursor.matched = (cursor.matched ?? 0)+1
        else texts.push(text)
      }
      if (!input.countOnly && texts.length === 5) break
    }
    more = processed < rows.length || rows.length === 32
    if (!more || (!input.countOnly && texts.length === 5)) break
  }
  signal?.throwIfAborted()
  await checkGeneration(db,cursor)
  if (input.countOnly) return { texts:[], scanning:more, ...(more ? {countCursor:await sealCursor(cursor,secret)} : {matching:cursor.matched ?? 0}) }
  return { texts, countCursor, ...(more ? { cursor: await sealCursor(cursor,secret) } : {}), scanning: more && texts.length < 5 }
}

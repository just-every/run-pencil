import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { googleHttp } from '../runtime/google-import-http'
import { responseScope } from '../../src/core/features/reporting/scope'
import type { BuilderDraft, Ledger } from '../../src/core/app/api'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
declare const __PENCIL_RUN_LOAD__: boolean

const percentile = (values: number[]) => [...values].sort((a,b) => a-b)[Math.ceil(values.length*0.95)-1]

describe.skipIf(!__PENCIL_RUN_LOAD__)('stored search at response capacity in Workers D1', () => {
  it('[LEDG-006] returns count and first page under one second p95 across 100,000 responses', async () => {
    await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
    const http = await googleHttp(), slug = `capacity-${crypto.randomUUID()}`
    const { id } = await (await http.call('/api/app/flows', { title: 'Harbour Cafe customer feedback', slug })).json() as { id: string }
    const path = `/api/app/flows/${id}`
    const draft = async () => await (await http.call(`${path}/draft`)).json() as BuilderDraft
    for (const step of [
      { kind: 'question', questionType: 'long_text', prompt: 'What could we improve?', required: true },
      { kind: 'question', questionType: 'single_choice', prompt: 'What did you order?', required: true, choices: [{ label: 'Cold brew', value: 'cold' }, { label: 'Tea', value: 'tea' }] },
      { kind: 'question', questionType: 'email', prompt: 'Email for a reply', required: false },
      { kind: 'completion', questionType: null, prompt: 'Thank you.' },
    ]) expect((await http.call(`${path}/draft/steps`, { expectedVersion: (await draft()).flow.draftVersion, step })).status).toBe(201)
    const current = await draft(), [text,choice,email] = current.steps
    expect((await http.call(`${path}/publish`, { expectedVersion: current.flow.draftVersion })).status).toBe(201)
    const stamp = '2026-10-01T12:00:00.000Z', cardinality = 100_000
    const choices = current.choices.filter(option => option.stepId === choice.id)
    // A test-only workload writes ordinary rows through the real database
    // triggers. Three answers per response: retained text, choice and contact.
    for (let start = 0; start < cardinality; start += 500) {
      const rows = Array.from({ length: Math.min(500,cardinality-start) },(_,offset) => {
        const index = start+offset
        return { id: `capacity-response-${index}`, text: index%100===0 ? 'On this visit the queue moved slowly, although the team was helpful.' : index%10===0 ? 'Le CAFE\u0301 était FROID. Очень ВКУСНО. Thank you for the visit.' : 'A pleasant visit with friendly service and a comfortable place to meet.', choice: choices[index%2].id, email: `customer${index}@example.test` }
      })
      const encoded = JSON.stringify(rows)
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO responses(id,workspace_id,flow_id,revision_id,session_id,session_token_hash,idempotency_key,state,released_at,completed_at,created_at,updated_at,source,started_at,notification_eligible)
          SELECT json_extract(value,'$.id'),?,?,?,json_extract(value,'$.id'),'synthetic-capacity-hash',json_extract(value,'$.id'),'released',?,?,?,?,CASE WHEN key%2=0 THEN 'direct' ELSE 'embed' END,?,0 FROM json_each(?)`)
          .bind(http.workspace,id,current.revision.id,stamp,stamp,stamp,stamp,stamp,encoded),
        env.DB.prepare(`INSERT INTO response_answers(id,response_id,step_id,value_json,created_at,updated_at)
          SELECT json_extract(row.value,'$.id')||':'||question.value,json_extract(row.value,'$.id'),
          CASE question.value WHEN 'text' THEN ? WHEN 'choice' THEN ? ELSE ? END,
          json_quote(json_extract(row.value,'$.'||question.value)),?,?
          FROM json_each(?) row JOIN json_each('["text","choice","email"]') question`)
          .bind(text.id,choice.id,email.id,stamp,stamp,encoded),
      ])
    }
    const terms = [
      { search: 'QUEUE MOVED SLOWLY', total: 1000 },
      { search: 'VISIT', total: cardinality },
      { search: 'café était froid', total: 9000 },
      { search: 'unrecorded %_* phrase', total: 0 },
    ]
    const samples: Array<{ search: string; milliseconds: number; pageRows: number }> = []
    const run = async (search: string, total: number) => {
      const started = performance.now()
      const response = await http.call(`${path}/ledger?${new URLSearchParams({ search })}`)
      expect(response.status).toBe(200)
      const ledger = await response.json() as Ledger
      const milliseconds = performance.now()-started
      expect(ledger.total).toBe(total)
      expect(ledger.responses.length).toBeLessThanOrEqual(50)
      if (total) expect(ledger.responses.length).toBeGreaterThan(0)
      else expect(ledger.responses).toEqual([])
      return { milliseconds, pageRows: ledger.responses.length }
    }
    for (const term of terms) await run(term.search,term.total)
    for (let index=0;index<40;index++) {
      const term=terms[index%terms.length]
      samples.push({ search: term.search, ...await run(term.search,term.total) })
    }
    const results=terms.map(term=>({ ...term, samples:10, p95Milliseconds:percentile(samples.filter(sample=>sample.search===term.search).map(sample=>sample.milliseconds)) }))
    const scope=responseScope(http.workspace,id,{search:terms[0].search},new Date().toISOString())
    const queryPlan=(await env.DB.prepare(`EXPLAIN QUERY PLAN SELECT count(*) FROM responses r WHERE ${scope.where}`).bind(...scope.bindings).all()).results
    console.log(`PENCIL_SEARCH_CAPACITY ${JSON.stringify({ environment:'local Workers runtime and D1', responses:cardinality, answers:cardinality*3, warmups:4, requests:40, concurrency:1, operation:'authenticated HTTP ledger, count + first page + JSON body', p95Milliseconds:percentile(samples.map(sample=>sample.milliseconds)), results, samples, queryPlan })}`)
    for (const result of results) expect(result.p95Milliseconds,result.search).toBeLessThan(1000)
  }, 300_000)
})

import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { googleHttp } from './google-import-http'
import { questionGroupDefinition } from '../fixtures/question-groups'
import type { BuilderDraft } from '../../src/core/app/api'
import { responseScreens } from '../../src/core/shared/screenLayout'
import { visiblePath } from '../../src/core/shared/flowPath'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))

contract('FIELD-012','imports Typeform group and inline_group as one screen with independently validated stable questions and durable copies',async()=>{
  const f=await googleHttp()
  for(const kind of ['group','inline_group'] as const){
    const {report}=await f.commit({definition:JSON.stringify(questionGroupDefinition(kind)),csv:''})
    const head=report.questions[0], members=report.questions.map(question=>question.id)
    expect(head.settings.screen).toMatchObject({kind:'group',title:'Your team',questionIds:members})
    expect(report.questions.map(question=>question.prompt)).toEqual(['Your name','Team size','Ready to talk?'])
    const draft=await (await f.call(`/api/app/flows/${report.flowId}/draft`)).json() as BuilderDraft
    expect(responseScreens(draft.steps,visiblePath(draft,{})).map(screen=>screen.steps.length)).toEqual([3,1])
    const published=await f.call(`/api/app/flows/${report.flowId}/publish`,{expectedVersion:draft.flow.draftVersion})
    expect(published.status,await published.clone().text()).toBe(201)
    const copiedResponse=await f.call(`/api/app/flows/${report.flowId}/duplicate`,{title:`Copy ${kind}`,slug:`copy-team-${kind.replace('_','-')}`})
    expect(copiedResponse.status).toBe(201)
    const copied=await copiedResponse.json() as {id:string}
    const copy=await (await f.call(`/api/app/flows/${copied.id}/draft`)).json() as BuilderDraft
    expect(copy.steps[0].questionSettings?.screen).toMatchObject({questionIds:copy.steps.filter(step=>step.kind==='question').map(step=>step.id)})
    expect(copy.steps[0].id).not.toBe(head.id)
    expect((await f.call(`/api/app/flows/${copied.id}/publish`,{expectedVersion:copy.flow.draftVersion})).status).toBe(201)
    const stored=(await env.DB.prepare('SELECT question_settings_json FROM flow_steps WHERE stable_id=?').bind(head.id).all<{question_settings_json:string}>()).results
    expect(stored.length).toBeGreaterThan(1)
    expect(stored.every(row=>JSON.parse(row.question_settings_json).screen.questionIds.join(',')===members.join(','))).toBe(true)
  }
},60_000)

import { DatabaseSync } from 'node:sqlite'
import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { aggregateRevision } from './aggregate'
import type { ReportStep, ReportChoice } from './questionReport'
function fixture() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`CREATE TABLE flows(id TEXT,workspace_id TEXT);CREATE TABLE flow_revisions(id TEXT,flow_id TEXT);INSERT INTO flows VALUES('flow','workspace');INSERT INTO flow_revisions VALUES('revision','flow');
    CREATE TABLE responses(id TEXT,revision_id TEXT,state TEXT,source TEXT,flow_id TEXT DEFAULT 'flow',workspace_id TEXT DEFAULT 'workspace');
    CREATE TABLE response_answers(response_id TEXT,step_id TEXT,value_json TEXT);
    CREATE TABLE flow_steps(id TEXT,revision_id TEXT,stable_id TEXT,question_type TEXT,question_settings_json TEXT,required INTEGER);
    CREATE TABLE choice_options(step_id TEXT,stable_id TEXT);`)
  let returned = 0
  const db = { prepare(sql: string) { return { bind(...values: Array<string|number>) { return {sql,values} } } }, async batch(statements: Array<{sql:string;values:Array<string|number>}>) { return statements.map(({sql,values})=> { const results=sqlite.prepare(sql).all(...values); returned+=results.length; return {results} }) } } as unknown as D1Database
  const steps:ReportStep[] = [], choices:ReportChoice[] = []
  const add = (type:string, values:unknown[], options:string[] = [], settings:object = {}) => {
    const id = `question-${steps.length}`
    steps.push({revisionId:'revision',id,prompt:type,questionType:type,position:steps.length,reached:0,dropped:0})
    sqlite.prepare('INSERT INTO flow_steps VALUES(?,?,?,?,?,0)').run(id,'revision',id,type,JSON.stringify(settings))
    for (const choice of options) { sqlite.prepare('INSERT INTO choice_options VALUES(?,?)').run(id,choice); choices.push({revisionId:'revision',stepId:id,id:choice,label:`Published ${choice}`}) }
    values.forEach((value,index)=> { const responseId=`${id}-${index}`; sqlite.prepare('INSERT INTO responses(id,revision_id,state,source) VALUES(?,?,?,?)').run(responseId,'revision','released', index % 2 ? 'direct':'imported');sqlite.prepare('INSERT INTO response_answers VALUES(?,?,?)').run(responseId,id,JSON.stringify(value)) })
  }
  return {sqlite,add,report:()=>aggregateRevision(db,'revision',steps,choices),returned:()=>returned}
}
contract(['RSLT-001','RSLT-003','FLOW-019'], 'SQL aggregates all thirteen immutable types without returning response-sized evidence',async()=> {
  const f=fixture()
  try {
    for (const type of ['short_text','long_text','email']) f.add(type,Array.from({length:201},()=>type==='email'?'a@example.test':'Exact duplicate'))
    f.add('single_choice',['a','a'],['a','b']);f.add('multiple_choice',[['a','b'],['b']],['a','b','zero']);f.add('dropdown',['b'],['a','b'])
    f.add('rating',[1,5,5]);f.add('nps',[0,6,7,8,9,10]);f.add('number',[.01,.02]);f.add('date',['2024-02-29','2024-03-01'])
    f.add('yes_no',[true,false]);f.add('consent',[{accepted:true,statement:'Retained statement'},{accepted:false,statement:'Retained statement'}],[],{statement:'Retained statement'})
    f.add('priority',[['a','b'],['b','a']],['a','b'])
    const result=await f.report(), q=(type:string)=>result.find(row=>row.questionType===type)!
    expect(result).toHaveLength(13);expect(f.returned()).toBeLessThan(60)
    expect(q('long_text')).toMatchObject({answered:201,importedAnswered:101,summary:{texts:[]}})
    expect(JSON.stringify(result)).not.toContain('Exact duplicate')
    expect(q('single_choice').distribution.map(row=>row.count)).toEqual([2,0])
    expect(q('multiple_choice').distribution.map(row=>row.count)).toEqual([1,2,0])
    expect(q('rating').summary.average).toBe(11/3)
    expect(q('nps').summary).toEqual({score:0,promoters:2,passives:2,detractors:2})
    expect(q('number').summary).toEqual({minimum:.01,median:.015,maximum:.02})
    expect(q('date').summary).toEqual({earliest:'2024-02-29',latest:'2024-03-01'})
    expect(q('consent').distribution.map(row=>row.count)).toEqual([1,1])
    expect(q('priority').summary.positions?.map(row=>row.average)).toEqual([1.5,1.5])
  } finally { f.sqlite.close() }
})
contract(['RSLT-001','FLOW-019'], 'SQL numeric medians preserve odd even extreme and subnormal values without overflow',async()=> {
  for (const [values,expected] of [[[1e308,1e308],1e308],[[-1e308,1e308],0],[[Number.MIN_VALUE,Number.MIN_VALUE],Number.MIN_VALUE],[[Number.MIN_VALUE,2*Number.MIN_VALUE],2*Number.MIN_VALUE],[[3,1,2],2]] as Array<[number[],number]>) {
    const f=fixture();try {f.add('number',values);expect((await f.report())[0].summary.median).toBe(expected)} finally {f.sqlite.close()}
  }
})
contract(['RSLT-001','FLOW-019','BASE-OPS-004'], 'invalid retained types options dates and consent fail visibly',async()=> {
  for (const [type,value,options,settings] of [
    ['number','',[],{}],['number',false,[],{}],['nps',11,[],{}],['rating',1.5,[],{}],['date','2023-02-29',[],{}],['single_choice','missing',['a'],{}],['multiple_choice',['a','a'],['a'],{}],['priority',['a'],['a','b'],{}],['consent',{accepted:true,statement:'Changed'},[],{statement:'Original'}],['email','bad @example.test',[],{}],
  ] as Array<[string,unknown,string[],object]>) {
    const f=fixture();try {f.add(type,[value],options,settings);await expect(f.report()).rejects.toThrow()} finally {f.sqlite.close()}
  }
})
contract(['RSLT-001','FLOW-019','BASE-OPS-004'], 'native string validation preserves UTF-16 limits and embedded NUL without returning answer values',async()=> {
  for(const [type,limit] of [['short_text',200],['long_text',5000],['email',200]] as const) {
    const suffix=type==='email'?'@a.b':''
    const values=['a'.repeat(limit-suffix.length)+suffix,'\0'+'a'.repeat(limit-suffix.length-1)+suffix,'😀'.repeat(Math.floor((limit-suffix.length)/2))+suffix]
    const valid=fixture()
    try {valid.add(type,values);expect((await valid.report())[0].answered).toBe(3);expect(valid.returned()).toBe(1)} finally {valid.sqlite.close()}
    for(const value of ['\0'+'a'.repeat(limit)+suffix,'😀'.repeat(limit)+suffix]) {
      const invalid=fixture();try {invalid.add(type,[value]);await expect(invalid.report()).rejects.toThrow(/Invalid retained answer/)} finally {invalid.sqlite.close()}
    }
  }
  for(const value of ['a\0 b@c.d','a@b\0 c.d','a@.b','a@b.','a@b@c.d','a@b\u2000.c']) {
    const f=fixture();try {f.add('email',[value]);await expect(f.report()).rejects.toThrow(/Invalid retained answer/)} finally {f.sqlite.close()}
  }
})

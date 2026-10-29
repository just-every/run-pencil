import { z } from 'zod'
import { ulid } from 'ulid'
import { NotFoundError, ValidationError } from '../../shared/errors'
export const ruleSchema=z.object({field:z.enum(['name','emailDomain','consent','custom']),key:z.string().trim().min(1).max(64).optional(),operator:z.enum(['is','contains','is-set']),value:z.string().max(500).optional()}).superRefine((r,c)=>{
  if (r.value && z.email().safeParse(r.value.trim()).success) c.addIssue({code:'custom',message:'Rules must not name a personal email address.'})
  if (r.field==='custom' && !r.key) c.addIssue({code:'custom',message:'Choose a custom field key.'})
  if (r.operator!=='is-set' && r.value===undefined) c.addIssue({code:'custom',message:'Provide a rule value.'})
  if (r.field==='emailDomain' && (r.value?.includes('@') || /[\s/]/.test(r.value ?? ''))) c.addIssue({code:'custom',message:'Use a domain, never a personal email address.'})
  if (r.field==='consent' && (r.operator!=='is' || !['eligible','opted-out'].includes(r.value ?? ''))) c.addIssue({code:'custom',message:'Choose eligible or opted-out consent.'})
})
export const segmentSchema=z.object({name:z.string().trim().min(1).max(100),rules:z.array(ruleSchema).min(1).max(10)})
export type SegmentRule=z.infer<typeof ruleSchema>
type SegmentRow={id:string;name:string;rulesJson:string}
export class DistributionSegments {
  constructor(private readonly db:D1Database,private readonly attribution:Record<string,unknown>={}){}
  attributed(attribution:Record<string,unknown>){return new DistributionSegments(this.db,attribution)}
  private predicate(rules:SegmentRule[]) {
    const values:string[]=[]
    const sql=rules.map(r=>{
      let field=r.field==='name'?'name':r.field==='emailDomain'?"substr(email,instr(email,'@')+1)":r.field==='consent'?"CASE WHEN opted_out_at IS NULL THEN 'eligible' ELSE 'opted-out' END":'(SELECT value FROM json_each(fields_json) WHERE key=?)'
      if(r.field==='custom') values.push(r.key!)
      if(r.operator==='is-set') return `length(${field})>0`
      values.push(r.value!)
      return r.operator==='is'?`lower(${field})=lower(?)`:`instr(lower(${field}),lower(?))>0`
    }).join(' AND ')
    return {sql,values}
  }
  async ids(workspaceId:string,id:string) {
    const row=await this.db.prepare('SELECT rules_json AS rulesJson FROM distribution_segments WHERE id=? AND workspace_id=?').bind(id,workspaceId).first<{rulesJson:string}>()
    if (!row) throw new NotFoundError('This segment is not in your workspace.')
    const predicate=this.predicate(JSON.parse(row.rulesJson))
    return (await this.db.prepare(`SELECT id FROM distribution_contacts WHERE workspace_id=? AND ${predicate.sql} ORDER BY id`).bind(workspaceId,...predicate.values).all<{id:string}>()).results.map(c=>c.id)
  }
  async list(workspaceId:string) {
    const rows=(await this.db.prepare('SELECT id,name,rules_json AS rulesJson FROM distribution_segments WHERE workspace_id=? ORDER BY name,id').bind(workspaceId).all<SegmentRow>()).results
    return Promise.all(rows.map(async ({rulesJson,...row})=>{
      const rules=JSON.parse(rulesJson) as SegmentRule[],predicate=this.predicate(rules)
      const count=await this.db.prepare(`SELECT count(*) n FROM distribution_contacts WHERE workspace_id=? AND ${predicate.sql}`).bind(workspaceId,...predicate.values).first<{n:number}>()
      return {...row,rules,matchCount:count!.n}
    }))
  }
  async save(workspaceId:string,input:unknown,id?:string,operatorId?:string) {
    const valid=segmentSchema.safeParse(input); if(!valid.success) throw new ValidationError('Provide a segment name and valid field rules. Use domains, never exact email addresses.')
    const now=new Date().toISOString(),segmentId=id??ulid()
    const result=id?await this.db.prepare('UPDATE distribution_segments SET name=?,rules_json=?,updated_at=? WHERE id=? AND workspace_id=?').bind(valid.data.name,JSON.stringify(valid.data.rules),now,id,workspaceId).run():await this.db.prepare('INSERT INTO distribution_segments(id,workspace_id,name,rules_json,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(segmentId,workspaceId,valid.data.name,JSON.stringify(valid.data.rules),now,now).run()
    if(!result.meta.changes) throw new NotFoundError('This segment is not in your workspace.')
    if(operatorId&&Object.keys(this.attribution).length)await this.db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(ulid(),workspaceId,id?'segment.updated':'segment.created',operatorId,'segment',segmentId,JSON.stringify(this.attribution),now).run()
    return (await this.list(workspaceId)).find(s=>s.id===segmentId)!
  }
  async erase(workspaceId:string,id:string,operatorId:string) {
    const result=await this.db.batch([
      this.db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at) SELECT ?,workspace_id,'segment.deleted',?,'segment',NULL,?,? FROM distribution_segments WHERE id=? AND workspace_id=?`).bind(ulid(),operatorId,JSON.stringify({segments:1,...this.attribution}),new Date().toISOString(),id,workspaceId),
      this.db.prepare('DELETE FROM distribution_segments WHERE id=? AND workspace_id=?').bind(id,workspaceId),
    ])
    if(!result[1].meta.changes) throw new NotFoundError('This segment is not in your workspace.')
  }
}

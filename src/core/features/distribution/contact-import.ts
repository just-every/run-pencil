import { ulid } from 'ulid'
import { csvRows, type CsvRow } from '../importing'
import { ValidationError } from '../../shared/errors'
import { contactLimits, contactSchema } from './contact-model'
type Status='added'|'matched'|'updated'|'invalid'|'over-limit'
type ReportRow={row:number;status:Status;match?:'existing'|'file';message?:string}
export class ContactImport {
  constructor(private readonly db:D1Database){}
  async run(workspaceId:string,operatorId:string,input:{csv:string;commit?:boolean;updateMatches?:boolean}) {
    if(new TextEncoder().encode(input.csv).byteLength>contactLimits.csvBytes) throw new ValidationError('CSV exceeds the 2 MiB limit.')
    const source=csvRows(input.csv),first=source.next()
    const header:CsvRow|undefined=first.done?undefined:first.value
    if(!header || header.errors.length) throw new ValidationError('Provide a CSV header with name and email columns.')
    const keys=header.cells.map(k=>k.trim()),nameIndex=keys.findIndex(k=>k.toLowerCase()==='name'),emailIndex=keys.findIndex(k=>k.toLowerCase()==='email')
    if(nameIndex<0||emailIndex<0||new Set(keys.map(k=>k.toLowerCase())).size!==keys.length) throw new ValidationError('CSV requires distinct headers including name and email.')
    const existing=(await this.db.prepare('SELECT id,email FROM distribution_contacts WHERE workspace_id=?').bind(workspaceId).all<{id:string;email:string}>()).results
    const seen=new Map(existing.map(c=>[c.email.toLowerCase(),{id:c.id,from:'existing' as 'existing'|'file'}]))
    const rows:ReportRow[]=[],writes=new Map<string,{id:string;name:string;email:string;fields:string;existing:boolean}>(),now=new Date().toISOString()
    let total=existing.length
    for(const row of source) {
      if(rows.length>=contactLimits.csvRows) throw new ValidationError('CSV exceeds the 5000 row limit.')
      const fields=Object.fromEntries(keys.flatMap((key,i)=>i===nameIndex||i===emailIndex?[]:[[key,row.cells[i]??'']]))
      const email=row.cells[emailIndex]??'', name=row.cells[nameIndex]??''
      const valid=contactSchema.safeParse({name,email,fields})
      if(row.errors.length||!valid.success) {
        const badEmail=!contactSchema.shape.email.safeParse(email).success
        rows.push({row:row.row,status:badEmail||row.errors.length?'invalid':'over-limit',message:badEmail?'Missing or invalid email.':row.errors.length?'Malformed CSV row.':'Name or custom fields exceed limits.'});continue
      }
      const data=valid.data,match=seen.get(data.email)
      if(match) {
        rows.push({row:row.row,status:input.updateMatches?'updated':'matched',match:match.from})
        if(input.updateMatches) writes.set(match.id,{id:match.id,name:data.name,email:data.email,fields:JSON.stringify(data.fields),existing:match.from==='existing'})
      } else if(total>=contactLimits.total) rows.push({row:row.row,status:'over-limit',message:'Workspace contact limit reached.'})
      else {
        const id=ulid();total++;seen.set(data.email,{id,from:'file'});rows.push({row:row.row,status:'added'})
        writes.set(id,{id,name:data.name,email:data.email,fields:JSON.stringify(data.fields),existing:false})
      }
    }
    const counts={added:0,matched:0,updated:0,invalid:0,overLimit:0}
    for(const row of rows) counts[row.status==='over-limit'?'overLimit':row.status]++
    if(input.commit) {
      const values=[...writes.values()],statements:D1PreparedStatement[]=[this.db.prepare(`SELECT CASE WHEN
        (SELECT count(*) FROM distribution_contacts WHERE workspace_id=?) + ? <= ?
        THEN 1 ELSE json('Contact capacity changed; preview again') END`).bind(workspaceId,values.filter(v=>!v.existing).length,contactLimits.total)]
      const chunks:string[]=[];let chunk:typeof values=[],bytes=2
      for(const value of values) {
        const size=new TextEncoder().encode(JSON.stringify(value)).byteLength+1
        if(chunk.length && (chunk.length>=100 || bytes+size>512*1024)) { chunks.push(JSON.stringify(chunk));chunk=[];bytes=2 }
        chunk.push(value);bytes+=size
      }
      if(chunk.length) chunks.push(JSON.stringify(chunk))
      for(const chunk of chunks) statements.push(this.db.prepare(`SELECT CASE WHEN NOT EXISTS(
        SELECT 1 FROM json_each(?) j WHERE json_extract(j.value,'$.existing')=1 AND NOT EXISTS(
        SELECT 1 FROM distribution_contacts c WHERE c.id=json_extract(j.value,'$.id') AND c.workspace_id=? AND c.email=json_extract(j.value,'$.email') COLLATE NOCASE))
        THEN 1 ELSE json('Matching contact changed; preview again') END`).bind(chunk,workspaceId))
      for(const chunk of chunks) statements.push(this.db.prepare(`INSERT INTO distribution_contacts(id,workspace_id,name,email,fields_json,created_at,updated_at)
        SELECT json_extract(value,'$.id'),?,json_extract(value,'$.name'),json_extract(value,'$.email'),json_extract(value,'$.fields'),?,? FROM json_each(?) WHERE 1
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,fields_json=excluded.fields_json,updated_at=excluded.updated_at`).bind(workspaceId,now,now,chunk))
      // Every statement is one atomic D1 transaction. A competing writer never silently wins.
      statements.push(this.db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at) VALUES(?,?,'contacts.imported',?,'contact',NULL,?,?)`).bind(ulid(),workspaceId,operatorId,JSON.stringify(counts),now))
      try { await this.db.batch(statements) } catch(error) { if(String(error).includes('UNIQUE constraint')||String(error).includes('malformed JSON')) throw new ValidationError('Contacts changed while importing. Preview the CSV again.');throw error }
    }
    return {rows,counts,committed:!!input.commit}
  }
}

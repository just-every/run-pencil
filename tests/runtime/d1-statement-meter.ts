/** Forward every native call, counting individual batch statements as queries. */
export function meterD1Statements(database: D1Database, limit=1000, beforeBatch?: (sql:string[])=>Promise<void>) {
  let statements=0,captures=0
  const capturedRows: Array<{id:string;sequence:number;createdAt:number}>=[]
  const originals=new WeakMap<D1PreparedStatement,D1PreparedStatement>()
  const sqlByStatement=new WeakMap<D1PreparedStatement,string>()
  const valuesByStatement=new WeakMap<D1PreparedStatement,unknown[]>()
  const count=(sql: string)=>{
    statements++
    if (/^\s*INSERT INTO rer_mail_development_outbox\b/.test(sql)) captures++
    if (statements>limit) throw new Error(`D1 statement budget exceeded: ${statements}`)
  }
  const wrap=(statement: D1PreparedStatement,sql: string,values: unknown[]=[]): D1PreparedStatement=>{
    const proxy=new Proxy(statement,{get(target,key){
      if(key==='bind') return (...values:unknown[])=>wrap(target.bind(...values),sql,values)
      const member=Reflect.get(target,key)
      if(typeof member!=='function') return member
      return (...args:unknown[])=>{count(sql);return member.apply(target,args)}
    }})
    originals.set(proxy,statement);sqlByStatement.set(proxy,sql);valuesByStatement.set(proxy,values)
    return proxy
  }
  const db=new Proxy(database,{get(target,key){
    if(key==='prepare') return (sql:string)=>wrap(target.prepare(sql),sql)
    if(key==='batch') return async (batch:D1PreparedStatement[])=>{
      for(const statement of batch) count(sqlByStatement.get(statement) ?? '')
      await beforeBatch?.(batch.map(statement=>sqlByStatement.get(statement) ?? ''))
      const results=await target.batch(batch.map(statement=>originals.get(statement) ?? statement))
      batch.forEach((statement,index)=>{
        if(/^\s*INSERT INTO rer_mail_development_outbox\b/.test(sqlByStatement.get(statement) ?? '') && results[index].meta.changes===1)
          capturedRows.push({id:String(valuesByStatement.get(statement)![0]),sequence:results[index].meta.last_row_id,createdAt:Number(valuesByStatement.get(statement)![1])})
      })
      return results
    }
    const member=Reflect.get(target,key)
    return typeof member==='function'?member.bind(target):member
  }})
  return {db,capturedRows,get statements(){return statements},get captures(){return captures}}
}

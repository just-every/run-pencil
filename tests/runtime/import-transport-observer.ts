import { Buffer } from 'node:buffer'
/** Count the native D1 wire representation without retaining a whole batch. */
export function importTransportObserver(db:D1Database) {
  const raw=new WeakMap<object,D1PreparedStatement>(),metadata=new WeakMap<object,{sql:string;params:unknown[]}>()
  const stats={queries:0,batches:0,totalBatchBytes:0,maxBatchBytes:0,maxBindings:0,maxSqlBytes:0,maxValueBytes:0}
  const size=(value:unknown)=>typeof value==='string'?Buffer.byteLength(value):Array.isArray(value)?value.length:8
  const count=(statement:object)=>{const data=metadata.get(statement)!;stats.queries++;stats.maxBindings=Math.max(stats.maxBindings,data.params.length);stats.maxSqlBytes=Math.max(stats.maxSqlBytes,Buffer.byteLength(data.sql));stats.maxValueBytes=Math.max(stats.maxValueBytes,...data.params.map(size))}
  const wrap=(statement:D1PreparedStatement,sql:string):D1PreparedStatement=>{
    const params=(statement as unknown as {params:unknown[]}).params
    if(!Array.isArray(params))throw new Error('Native D1 transport parameters unavailable')
    const wrapped=new Proxy(statement,{get(target,key){if(key==='bind')return (...values:unknown[])=>wrap(target.bind(...values),sql);if(['first','all','run','raw'].includes(String(key)))return (...args:unknown[])=>{count(wrapped);return (Reflect.get(target,key) as Function).apply(target,args)};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
    raw.set(wrapped,statement);metadata.set(wrapped,{sql,params});return wrapped
  }
  const database=new Proxy(db,{get(target,key){if(key==='prepare')return (sql:string)=>wrap(target.prepare(sql),sql);if(key==='batch')return (statements:D1PreparedStatement[])=>{let bytes=2+Math.max(0,statements.length-1);for(const statement of statements){count(statement);bytes+=Buffer.byteLength(JSON.stringify(metadata.get(statement)!))}stats.batches++;stats.totalBatchBytes+=bytes;stats.maxBatchBytes=Math.max(stats.maxBatchBytes,bytes);return target.batch(statements.map(statement=>raw.get(statement)!))};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
  return {database,stats,reset(){Object.assign(stats,{queries:0,batches:0,totalBatchBytes:0,maxBatchBytes:0,maxBindings:0,maxSqlBytes:0,maxValueBytes:0})}}
}

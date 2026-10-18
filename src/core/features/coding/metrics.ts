import { answerJoins, codableAnswer, ownedFlow } from './answers'
import { listCodes, workspaceCode } from './catalog'
import { responseScope } from '../reporting'
import type { LedgerFilter } from '../reporting'
import { activeAssignment } from './visibility'
import { responseCodeFilter } from './filter'

export async function codingCounts(db:D1Database,workspaceId:string,flowId:string,filter:LedgerFilter,after?:string) {
  await ownedFlow(db,workspaceId,flowId)
  const catalog=await listCodes(db,workspaceId,after), {where,bindings}=responseScope(workspaceId,flowId,filter,new Date().toISOString())
  const cte=`WITH eligible AS (SELECT a.id,r.id AS response_id ${answerJoins} WHERE ${where} AND ${codableAnswer})`
  const [responses,answers,counts]=await db.batch([
    db.prepare(`SELECT count(*) AS denominator FROM responses r WHERE ${where}`).bind(...bindings),
    db.prepare(`${cte} SELECT count(*) AS denominator FROM eligible`).bind(...bindings),
    db.prepare(`${cte} SELECT ca.code_id AS codeId,count(DISTINCT ca.answer_id) AS answerCount,count(DISTINCT r.id) AS responseCount
      FROM eligible e JOIN answer_code_assignments ca ON ca.answer_id=e.id JOIN responses r ON r.id=e.response_id
      JOIN workspace_codes cc ON cc.id=ca.code_id AND cc.workspace_id=ca.workspace_id
      WHERE ca.workspace_id=? AND ca.code_id IN (SELECT value FROM json_each(?)) AND ${activeAssignment} GROUP BY ca.code_id`)
      .bind(...bindings,workspaceId,JSON.stringify(catalog.codes.map(code=>code.id))),
  ])
  const responseDenominator=(responses.results[0] as {denominator:number}).denominator, answerDenominator=(answers.results[0] as {denominator:number}).denominator
  return {responseDenominator,answerDenominator,denominatorDescription:'Released completed responses matching the filters; answers count nonempty retained text and Other write-ins.',
    codes:catalog.codes.map(code=>{const count=(counts.results as Array<{codeId:string;answerCount:number;responseCount:number}>).find(row=>row.codeId===code.id);return {...code,answerCount:Number(count?.answerCount ?? 0),responseCount:Number(count?.responseCount ?? 0)}}),nextAfter:catalog.nextAfter}
}

/** A bounded 2x2 table, measuring presence of each selected code in a response. */
export async function codingCrosstab(db:D1Database,workspaceId:string,flowId:string,filter:LedgerFilter,rowCodeId:string,columnCodeId:string) {
  await ownedFlow(db,workspaceId,flowId)
  const rowCode=await workspaceCode(db,workspaceId,rowCodeId),columnCode=await workspaceCode(db,workspaceId,columnCodeId)
  const {where,bindings}=responseScope(workspaceId,flowId,filter,new Date().toISOString())
  const row=responseCodeFilter(rowCodeId),column=responseCodeFilter(columnCodeId)
  const rows=(await db.prepare(`WITH coded AS (SELECT CASE WHEN ${row.sql} THEN 1 ELSE 0 END AS row_present,
    CASE WHEN ${column.sql} THEN 1 ELSE 0 END AS column_present FROM responses r WHERE ${where})
    SELECT row_present AS rowPresent,column_present AS columnPresent,count(*) AS count FROM coded GROUP BY row_present,column_present`)
    .bind(...row.bindings,...column.bindings,...bindings).all<{rowPresent:number;columnPresent:number;count:number}>()).results
  const cells=[0,1].flatMap(r=>[0,1].map(c=>({rowPresent:r===1,columnPresent:c===1,count:rows.find(cell=>cell.rowPresent===r && cell.columnPresent===c)?.count ?? 0})))
  return {rowCode,columnCode,responseDenominator:cells.reduce((n,cell)=>n+cell.count,0),denominatorDescription:'Released completed responses matching the filters; each response counts once.',cells}
}

import { ConflictError, NotFoundError } from '../../shared/errors'

type Snapshot = { revisionId:string; updatedAt:string; currentVersion:number|null; retainedVersions:number }
type Row = { number:number; answersJson:string; contextJson:string; createdAt:string }
/** Retained versions are immutable. Stop if their response changes or is erased. */
export async function downloadResponseVersions(db:D1Database,workspaceId:string,responseId:string,signal:AbortSignal) {
 const read=()=>db.prepare(`SELECT r.revision_id AS revisionId,r.updated_at AS updatedAt,
  (SELECT MAX(number) FROM response_versions WHERE response_id=r.id) AS currentVersion,
  (SELECT COUNT(*) FROM response_versions WHERE response_id=r.id) AS retainedVersions
  FROM responses r WHERE r.id=? AND r.workspace_id=?`).bind(responseId,workspaceId).first<Snapshot>()
 const snapshot=await read()
 if(!snapshot)throw new NotFoundError('This response is unavailable.')
 const unchanged=async()=>{
  signal.throwIfAborted()
  const current=await read()
  if(!current || current.updatedAt!==snapshot.updatedAt || current.currentVersion!==snapshot.currentVersion || current.retainedVersions!==snapshot.retainedVersions)throw new ConflictError('The response changed during this download. Start again.')
 }
 const encoder=new TextEncoder()
 async function* lines() {
  await unchanged()
  yield encoder.encode(JSON.stringify({format:'pencil.response-history.v1',responseId,revisionId:snapshot!.revisionId,currentVersion:snapshot!.currentVersion,retainedVersions:snapshot!.retainedVersions})+'\n')
  let before:number|null=null,written=0
  while(snapshot!.currentVersion!==null) {
   await unchanged()
   // Bound both row count and bytes. One large version is emitted on its own.
   const rows:Row[]=(await db.prepare(`WITH candidates AS (
    SELECT number,answers_json AS answersJson,context_json AS contextJson,created_at AS createdAt,
     SUM(length(CAST(answers_json AS BLOB))+length(CAST(context_json AS BLOB))+length(CAST(created_at AS BLOB))+128) OVER(ORDER BY number DESC) AS bytes,
     ROW_NUMBER() OVER(ORDER BY number DESC) AS ordinal
    FROM (SELECT number,answers_json,context_json,created_at FROM response_versions
     WHERE response_id=? AND number<=? AND (? IS NULL OR number<?) ORDER BY number DESC LIMIT 100)
   ) SELECT number,answersJson,contextJson,createdAt FROM candidates WHERE bytes<=262144 OR ordinal=1 ORDER BY number DESC`)
    .bind(responseId,snapshot!.currentVersion,before,before).all<Row>()).results
   await unchanged()
   if(!rows.length)break
   for(const row of rows) {
    signal.throwIfAborted()
    yield encoder.encode(JSON.stringify({number:row.number,current:row.number===snapshot!.currentVersion,createdAt:row.createdAt,answers:JSON.parse(row.answersJson),context:JSON.parse(row.contextJson)})+'\n')
    written++
   }
   before=rows.at(-1)!.number
  }
  await unchanged()
  if(written!==snapshot!.retainedVersions)throw new ConflictError('The complete version history could not be downloaded. Start again.')
 }
 const chunks=lines()
 return new ReadableStream<Uint8Array>({
  async pull(controller) {
   try {const chunk=await chunks.next();if(chunk.done)controller.close();else controller.enqueue(chunk.value)}
   catch(error){controller.error(error)}
  },
  async cancel(){await chunks.return(undefined)},
 },{highWaterMark:0})
}

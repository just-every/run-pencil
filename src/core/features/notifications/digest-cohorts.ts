import { nextOpening } from '../../shared/civilTime'
export const liveDigestMember = `r.state='released' AND r.notification_eligible=1 AND r.source IN ('direct','embed','invitation')`
export async function freezeDigests(db:D1Database,now:string) {
  const prefs=await db.prepare(`SELECT p.*,w.time_zone AS currentZone,w.sending_window_start AS currentStart FROM digest_preferences p JOIN flows f ON f.id=p.flow_id JOIN workspaces w ON w.id=f.workspace_id WHERE p.enabled=1 AND p.next_opening<=? ORDER BY p.next_opening LIMIT 100`).bind(now).all<{flow_id:string;operator_id:string;epoch:string;cutoff:string;next_opening:string;next_day:string;zone:string;currentZone:string;currentStart:string}>()
  for(const p of prefs.results) for(let day=0;day<31 && p.next_opening<=now;day++) {
    const id=crypto.randomUUID(), next=nextOpening(p.next_opening,p.currentZone,p.currentStart,p.next_day)
    // A westward zone edit can revisit a day already delivered. Keep its interval open until the next unused day.
    while(await db.prepare('SELECT 1 FROM digest_deliveries WHERE flow_id=? AND operator_id=? AND day=?').bind(p.flow_id,p.operator_id,next.day).first()) Object.assign(next,nextOpening(next.at,p.currentZone,p.currentStart,next.day))
    await db.batch([
      db.prepare(`INSERT OR IGNORE INTO digest_deliveries(id,flow_id,operator_id,day,zone,epoch,cutoff_start,cutoff_end,status,idempotency_key,available_at,created_at,updated_at)
        SELECT ?,flow_id,operator_id,next_day,zone,epoch,cutoff,next_opening,'pending',?,next_opening,?,? FROM digest_preferences WHERE flow_id=? AND operator_id=? AND enabled=1 AND cutoff=? AND next_opening=?`)
        .bind(id,crypto.randomUUID(),now,now,p.flow_id,p.operator_id,p.cutoff,p.next_opening),
      db.prepare(`INSERT INTO digest_members(delivery_id,response_id) SELECT ?,r.id FROM responses r JOIN response_outbox x ON x.response_id=r.id
        JOIN json_each(CASE WHEN json_valid(x.payload_json) THEN x.payload_json ELSE '{}' END,'$.digestOperatorIds') recipient
        WHERE r.flow_id=? AND ${liveDigestMember} AND x.notification_eligible=1 AND x.kind='response.completed' AND x.created_at<?
        AND recipient.type='object' AND json_extract(recipient.value,'$.operatorId')=? AND json_extract(recipient.value,'$.epoch')=?
        AND NOT EXISTS(SELECT 1 FROM digest_members prior JOIN digest_deliveries sent ON sent.id=prior.delivery_id WHERE prior.response_id=r.id AND sent.operator_id=?) AND EXISTS(SELECT 1 FROM digest_deliveries WHERE id=?)`).bind(id,p.flow_id,p.next_opening,p.operator_id,p.epoch,p.operator_id,id),
      db.prepare(`UPDATE digest_deliveries SET status='empty' WHERE id=? AND NOT EXISTS(SELECT 1 FROM digest_members WHERE delivery_id=?)`).bind(id,id),
      db.prepare(`UPDATE digest_preferences SET cutoff=?,next_opening=?,next_day=?,zone=?,window_start=? WHERE flow_id=? AND operator_id=? AND cutoff=? AND next_opening=? AND EXISTS(SELECT 1 FROM digest_deliveries WHERE id=?)`).bind(p.next_opening,next.at,next.day,p.currentZone,p.currentStart,p.flow_id,p.operator_id,p.cutoff,p.next_opening,id),
    ])
    // Re-read after the guarded transaction: another tick may have advanced it.
    const updated=await db.prepare('SELECT epoch,cutoff,next_opening,next_day,zone,enabled FROM digest_preferences WHERE flow_id=? AND operator_id=?').bind(p.flow_id,p.operator_id).first<{epoch:string;cutoff:string;next_opening:string;next_day:string;zone:string;enabled:number}>()
    if(!updated?.enabled)break
    Object.assign(p,updated)
  }
}

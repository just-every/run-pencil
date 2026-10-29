import { RetentionPolicies } from './policy'
import { retainedItemsSql } from './items'
import { eraseRetainedItem } from './erase'
import { noticeMilliseconds, retentionSettingsSchema, type RetainedItem, type RetentionSettings } from './model'
import { ForbiddenError } from '../../shared/errors'

export class RetentionService extends RetentionPolicies {
  constructor(private readonly binding:D1Database, attribution:Record<string,unknown>={}) {super(binding,attribution)}
  override attributed(attribution:Record<string,unknown>) { return new RetentionService(this.binding,attribution) }

  async configure(workspaceId:string,operatorId:string,input:RetentionSettings & {flowId:string},now:string) {
    const {flowId,...values}=input,settings=retentionSettingsSchema.parse(values)
    if(settings.days!==null && !settings.legalHold && !settings.confirmAutomaticDeletion)throw new ForbiddenError('Confirm automatic deletion before enabling a retention schedule.')
    await this.save(workspaceId,operatorId,{flowId,days:settings.days,legalHold:settings.legalHold,version:settings.version},now)
    await this.run(now,flowId)
    return this.read(workspaceId,flowId)
  }
  /** Bounded cron batches; a missed tick grants more time, never less notice. */
  async run(now:string,flowId?:string) {
    const windowEnd=new Date(Date.parse(now)+noticeMilliseconds).toISOString()
    await this.binding.prepare(`INSERT INTO retention_notices(flow_id,kind,item_id,policy_version,notified_at,delete_after)
      SELECT flow_id,kind,item_id,version,?,max(expires_at,?) FROM (${retainedItemsSql}) item
      WHERE expires_at<=? ${flowId?'AND flow_id=?':''}
      AND NOT EXISTS(SELECT 1 FROM retention_notices n WHERE n.flow_id=item.flow_id AND n.kind=item.kind AND n.item_id=item.item_id)
      ORDER BY expires_at,item_id LIMIT 500`).bind(now,windowEnd,windowEnd,...flowId?[flowId]:[]).run()
    const {results}=await this.binding.prepare(`SELECT item.* FROM (${retainedItemsSql}) item JOIN retention_notices n
      ON n.flow_id=item.flow_id AND n.kind=item.kind AND n.item_id=item.item_id AND n.policy_version=item.version
      WHERE n.delete_after<=? AND item.expires_at<=? ${flowId?'AND item.flow_id=?':''}
      ORDER BY n.delete_after,item.item_id LIMIT 25`).bind(now,now,...flowId?[flowId]:[]).all<RetainedItem>()
    for(const item of results)await eraseRetainedItem(this.binding,item,now)
    return {erased:results.length,moreWorkMayRemain:results.length===25}
  }
}

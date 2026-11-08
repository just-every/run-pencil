import { NotFoundError } from '../../shared/errors'
import { AnalysisRepository, type RunDetail } from '../analysis'
import type { StudioInput } from './model'

export type FindingContextOption = { runId:string; findingId:string; flowTitle:string; title:string; summary:string }

/** Resolve native findings afresh; neither browser labels nor saved draft metadata confer authority. */
export class FindingContext {
  private readonly analysis:AnalysisRepository
  constructor(db:D1Database) { this.analysis=new AnalysisRepository(db) }

  private visible(detail:RunDetail,threshold:number):FindingContextOption[] {
    if(detail.state!=='completed'||detail.redacted)return []
    return detail.themes.flatMap(theme=>!theme.withheld&&theme.count>=threshold&&detail.decisions?.[theme.id]==='accepted'&&theme.summary?.trim()
      ? [{runId:detail.id,findingId:theme.id,flowTitle:detail.flowTitle,title:theme.title,summary:theme.summary}]
      : [])
  }

  async options(workspaceId:string) {
    const threshold=(await this.analysis.policies(workspaceId)).disclosureThreshold
    const runs=await this.analysis.list(workspaceId)
    const options:FindingContextOption[]=[]
    for(const run of runs) {
      if(run.state==='completed'&&!run.redacted)options.push(...this.visible(await this.analysis.detail(workspaceId,run.id),threshold))
    }
    return options
  }

  async resolve(workspaceId:string,selections:StudioInput['priorFindings']) {
    if(!selections.length)return []
    const threshold=(await this.analysis.policies(workspaceId)).disclosureThreshold
    const details=new Map<string,RunDetail>()
    const summaries:Array<{summary:string}>=[]
    for(const selection of selections) {
      let detail=details.get(selection.runId)
      if(!detail) { detail=await this.analysis.detail(workspaceId,selection.runId);details.set(selection.runId,detail) }
      const finding=this.visible(detail,threshold).find(item=>item.findingId===selection.findingId)
      if(!finding)throw new NotFoundError('Choose only accepted, visible theme findings from completed analysis in your workspace.')
      // Deliberate allowlist: no finding IDs, response IDs, counts, quotes or raw answers leave here.
      summaries.push({summary:finding.summary})
    }
    return summaries
  }
}

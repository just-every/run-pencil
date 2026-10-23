import { useEffect, useState, type FormEvent } from 'react'
import type { QuestionReport } from '../../../app/api'
import type { TrendReport } from '../../reporting'
import { civilParts, nextDay } from '../../../shared/civilTime'
import './trends.css'
import { TrendChart } from './TrendChart'

type CollectorOption = { id: string; name: string }
const scores = ['nps','csat','ces','rating','number','emoji_rating','thumbs_rating']
const shares = [...scores,'single_choice','dropdown','multiple_choice','yes_no','consent','short_text','long_text','email','url','date']
async function read<T>(url: string): Promise<T> { const response = await fetch(url); const body = await response.json() as T & {message?:string}; if (!response.ok) throw new Error(body.message ?? 'Trends could not load.'); return body }

export function TrendsPanel({ flowId, questions, timeZone, revisionId }: { flowId: string; questions: QuestionReport[]; timeZone: string; revisionId: string }) {
  const eligible = questions.filter(question => shares.includes(question.questionType ?? ''))
  const today = civilParts(new Date(),timeZone).day
  const [stepId,setStepId] = useState(eligible[0]?.id ?? ''), [metric,setMetric] = useState<'score'|'share'>(scores.includes(eligible[0]?.questionType ?? '') ? 'score' : 'share')
  const [unit,setUnit] = useState('week'), [minimum,setMinimum] = useState('5'), [from,setFrom] = useState(new Date(Date.parse(today+'T12:00:00Z')-89*86400000).toISOString().slice(0,10)), [to,setTo] = useState(nextDay(today))
  const [revisionScope,setRevisionScope]=useState('all')
  const [share,setShare] = useState(''), [collectorId,setCollectorId] = useState(''), [collectors,setCollectors] = useState<CollectorOption[]>([])
  const [report,setReport] = useState<TrendReport>(), [error,setError] = useState<string>(), [busy,setBusy] = useState(false)
  const question = eligible.find(item => item.id === stepId)
  useEffect(() => { void read<CollectorOption[]>(`/api/app/flows/${flowId}/collectors`).then(setCollectors).catch(reason => setError((reason as Error).message)) },[flowId])
  const load = async (event: FormEvent) => {
    event.preventDefault();setBusy(true);setError(undefined);setReport(undefined)
    try {
      const query = new URLSearchParams({ stepId, metric, unit, minimum, from, to })
      if (collectorId) query.set('collectorId',collectorId)
      if (revisionScope==='selected') query.set('revisionId',revisionId)
      if (metric === 'share') {
        const type = question?.questionType ?? ''
        const value = scores.includes(type) && type !== 'thumbs_rating' ? Number(share) : ['thumbs_rating','yes_no','consent'].includes(type) ? share === 'true' : share
        if (scores.includes(type) && type !== 'thumbs_rating' && !share.trim()) throw new Error('Choose the numeric answer to compare.')
        query.set('shareValue',JSON.stringify(value))
      }
      setReport(await read<TrendReport>(`/api/app/flows/${flowId}/trends?${query}`))
    } catch (reason) {setError((reason as Error).message)} finally {setBusy(false)}
  }
  const download = () => {
    if (!report) return
    const cell = (value: unknown) => `"${String(value ?? '').replaceAll('"','""')}"`
    const rows = [['question_id','question_type','metric','answer_share_value','collector_id','revision_id','minimum','cutoff','period','start','end_exclusive','zone','numerator','denominator','value','suppressed','revision_boundaries'],...report.periods.map(point=>[report.stableStepId,report.questionType,report.metric,report.shareValue,report.collector?.id,report.filter.revisionId,report.minimum,report.cutoff,point.label,point.start,point.end,report.zone,point.numerator,point.denominator,point.value,point.suppressed,point.revisions.map(revision=>`Revision ${revision.revisionNumber}`).join('; ')])]
    const url=URL.createObjectURL(new Blob([rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='pencil-trends.csv';link.click();URL.revokeObjectURL(url)
  }
  return <section className="panel results-card trends-panel" aria-labelledby="trends-title">
    <h2 id="trends-title" className="display">Trends over time</h2>
    <p className="muted">Released answers across published revisions, grouped in {timeZone}. Weeks begin Monday. Periods with fewer answers than your minimum show a gap.</p>
    {!eligible.length ? <p>Publish a question with a score or answer share to chart its trends.</p> : <form className="trend-controls" onSubmit={event=>void load(event)}>
      <label className="inspector-field">Trend question<select aria-label="Trend question" className="text-input" value={stepId} onChange={event=>{const next=eligible.find(item=>item.id===event.target.value);setStepId(event.target.value);setMetric(scores.includes(next?.questionType ?? '')?'score':'share');setShare('')}}>{eligible.map(item=><option key={item.id} value={item.id}>{item.prompt}</option>)}</select></label>
      <label className="inspector-field">Trend metric<select aria-label="Trend metric" className="text-input" value={metric} onChange={event=>setMetric(event.target.value as 'score'|'share')}>{scores.includes(question?.questionType ?? '')?<option value="score">{question?.questionType==='nps'?'NPS':question?.questionType==='csat'?'CSAT satisfied share':question?.questionType==='thumbs_rating'?'Thumbs-up share':'Mean score'}</option>:null}<option value="share">Share choosing an answer</option></select></label>
      {metric==='share'?<label className="inspector-field">Answer to chart{question?.choices.length?<select aria-label="Answer to chart" required className="text-input" value={share} onChange={event=>setShare(event.target.value)}><option value="">Choose answer</option>{question.choices.map(choice=><option key={choice.id} value={choice.id}>{choice.label}</option>)}</select>:['thumbs_rating','yes_no','consent'].includes(question?.questionType??'')?<select aria-label="Answer to chart" className="text-input" value={share} required onChange={event=>setShare(event.target.value)}><option value="">Choose answer</option><option value="true">{question?.questionType==='thumbs_rating'?'Thumbs up':'Yes / accepted'}</option><option value="false">{question?.questionType==='thumbs_rating'?'Thumbs down':'No / declined'}</option></select>:<input aria-label="Answer to chart" className="text-input" required value={share} onChange={event=>setShare(event.target.value)} />}</label>:null}
      <label className="inspector-field">Trend revision<select aria-label="Trend revision" className="text-input" value={revisionScope} onChange={event=>setRevisionScope(event.target.value)}><option value="all">All published revisions</option><option value="selected">Selected results revision only</option></select></label>
      <label className="inspector-field">Period<select aria-label="Period" className="text-input" value={unit} onChange={event=>setUnit(event.target.value)}>{['day','week','month','quarter'].map(value=><option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select></label>
      <label className="inspector-field">Trend from<input className="text-input" type="date" required value={from} onChange={event=>setFrom(event.target.value)} /></label>
      <label className="inspector-field">Trend until (exclusive)<input className="text-input" type="date" required value={to} onChange={event=>setTo(event.target.value)} /></label>
      <label className="inspector-field">Minimum answers per period<input className="text-input" type="number" required min={1} max={1000000} step={1} value={minimum} onChange={event=>setMinimum(event.target.value)} /></label>
      <label className="inspector-field">Trend collector<select aria-label="Trend collector" className="text-input" value={collectorId} onChange={event=>setCollectorId(event.target.value)}><option value="">All collectors</option>{collectors.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="builder-actions"><button className="secondary-button focus-ring" disabled={busy} type="submit">{busy?'Loading trends…':'Show trends'}</button></div>
    </form>}
    {error?<p role="alert" className="status-note" data-tone="error">{error}</p>:null}
    {report?<><p className="muted">{report.collector?.name ?? 'All collectors'} · {report.filter.revisionId ? 'Selected revision' : 'All published revisions'} · {report.from} to {report.to} (exclusive), {report.zone} · minimum {report.minimum} answered responses per period. Evidence through {report.cutoff}.</p><TrendChart report={report}/><button className="quiet-button focus-ring" type="button" onClick={download}>Export trend CSV</button>
      <div className="trend-table-scroll focus-ring" role="region" aria-label="Trend period values" tabIndex={0}><table className="trend-table"><caption>Period values and answered-response denominators</caption><thead><tr><th>Period</th><th>Value</th><th>Answered</th><th>Revision boundaries</th></tr></thead><tbody>{report.periods.map(point=><tr key={point.start}><th scope="row">{point.label}</th><td>{point.value===null?'Gap · below minimum':`${point.value.toLocaleString(undefined,{maximumFractionDigits:2})}${report.metric==='share'||['csat','thumbs_rating'].includes(report.questionType)?'%':''}`}{point.value!==null && point.numerator!==null ? <p>{point.numerator} {report.metric==='score' && report.questionType==='nps'?'promoters minus detractors':report.metric==='score' && report.questionType==='csat'?'satisfied answers (4–5)':report.metric==='score' && report.questionType==='thumbs_rating'?'thumbs-up answers':'matching answers'} / {point.denominator} answered responses</p> : null}</td><td>{point.denominator}</td><td>{point.revisions.map(revision=><p key={revision.revisionId}>Revision {revision.revisionNumber}{revision.prompt?` · ${revision.prompt}`:' · question absent'}</p>)}</td></tr>)}</tbody></table></div>
      <p className="muted">The denominator counts released responses answering this question in each period. Optional omissions and revisions without the question are excluded. Type changes require a single revision.</p></>:null}
  </section>
}

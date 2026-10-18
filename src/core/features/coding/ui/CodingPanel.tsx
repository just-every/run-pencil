import {useEffect,useState} from 'react'
import type {LedgerFilter} from '../../../app/api'
import {codingQuery,codingRequest,type Code,type CodedAnswer,type Suggestion,type Counts,type Cross} from './api'
import {CodeMetrics} from './CodeMetrics'
import {CodingAnswers} from './CodingAnswers'
import {CodingSuggestions} from './CodingSuggestions'
import './coding.css'
export function CodingPanel({flowId,filter,onCodeFilter,onChanged,timeZone}:{flowId:string;filter:LedgerFilter;onCodeFilter:(codeId?:string)=>void;onChanged:()=>void;timeZone:string}) {
  const [codes,setCodes]=useState<Code[]>([]),[catalogNext,setCatalogNext]=useState<string|null>(null),[label,setLabel]=useState('')
  const [answers,setAnswers]=useState<{answers:CodedAnswer[];nextAfter:string|null}>(),[suggestions,setSuggestions]=useState<{suggestions:Suggestion[];nextAfter:string|null}>()
  const [counts,setCounts]=useState<Counts>(),[cross,setCross]=useState<Cross>(),[row,setRow]=useState(''),[column,setColumn]=useState('')
  const [answerHistory,setAnswerHistory]=useState<Array<string|undefined>>([]),[answerAfter,setAnswerAfter]=useState<string>(),[suggestionHistory,setSuggestionHistory]=useState<Array<string|undefined>>([]),[suggestionAfter,setSuggestionAfter]=useState<string>(),[countAfter,setCountAfter]=useState<string>()
  const [refresh,setRefresh]=useState(0),[error,setError]=useState<string>(),[notice,setNotice]=useState<string>(),[busy,setBusy]=useState(false)
  const root=`flows/${encodeURIComponent(flowId)}/coding`,scope=JSON.stringify({...filter,offset:undefined})
  const loadCodes=async(after?:string)=>{const result=await codingRequest<{codes:Code[];nextAfter:string|null}>('codes?'+new URLSearchParams(after?{after}:{}));setCodes(current=>after?[...current,...result.codes]:result.codes);setCatalogNext(result.nextAfter)}
  useEffect(()=>{void loadCodes().catch(reason=>setError((reason as Error).message))},[])
  useEffect(()=>{setAnswerAfter(undefined);setAnswerHistory([]);setCountAfter(undefined)},[scope])
  useEffect(()=>{
    let active=true;setAnswers(undefined);setCounts(undefined);setError(undefined)
    Promise.all([
      codingRequest<{answers:CodedAnswer[];nextAfter:string|null}>(root+'/answers?'+codingQuery(filter,{after:answerAfter})),
      codingRequest<Counts>(root+'/counts?'+codingQuery(filter,{after:countAfter})),
    ]).then(([a,c])=>{if(active){setAnswers(a);setCounts(c)}}).catch(reason=>{if(active)setError((reason as Error).message)})
    return()=>{active=false}
  },[flowId,scope,answerAfter,countAfter,refresh])
  useEffect(()=>{
    let active=true;setSuggestions(undefined)
    codingRequest<{suggestions:Suggestion[];nextAfter:string|null}>(root+'/suggestions?'+new URLSearchParams(suggestionAfter?{after:suggestionAfter}:{})).then(result=>{if(active)setSuggestions(result)}).catch(reason=>{if(active)setError((reason as Error).message)})
    return()=>{active=false}
  },[flowId,suggestionAfter,refresh])
  useEffect(()=>{
    let active=true;setCross(undefined)
    if(row&&column)codingRequest<Cross>(root+'/crosstab?'+codingQuery(filter,{rowCodeId:row,columnCodeId:column})).then(result=>{if(active)setCross(result)}).catch(reason=>{if(active)setError((reason as Error).message)})
    return()=>{active=false}
  },[flowId,scope,row,column,refresh])
  const mutate=async(action:()=>Promise<unknown>,message:string)=>{
    setBusy(true);setError(undefined);setNotice(undefined)
    try{await action();setNotice(message);onChanged();setRefresh(current=>current+1)}catch(reason){setError((reason as Error).message)}finally{setBusy(false)}
  }
  const assignment=(answer:CodedAnswer,codeId:string)=>`responses/${encodeURIComponent(answer.responseId)}/answers/${encodeURIComponent(answer.questionId)}/codes/${encodeURIComponent(codeId)}`
  return <section className="panel results-card coding-panel" aria-labelledby="coding-title">
    <p className="eyebrow">Codes</p><h2 className="display" id="coding-title">Organize feedback with codes</h2><p className="muted">Create a workspace vocabulary, tag retained answers, and compare the feedback. Counts and answers use the ledger filters; suggestions retain their analysis evidence.</p>
    <form className="coding-create" onSubmit={event=>{event.preventDefault();void mutate(async()=>{await codingRequest('codes',{label});await loadCodes();setLabel('')},'Workspace code created.')}}><label className="inspector-field">New code<input className="text-input" maxLength={100} required value={label} onChange={event=>setLabel(event.target.value)} /></label><button className="secondary-button focus-ring" disabled={busy||!label.trim()} type="submit">Create code</button><button className="quiet-button" type="button" disabled={busy} onClick={()=>setRefresh(current=>current+1)}>Refresh coding</button></form>
    <label className="inspector-field coding-filter">Code filter for answers, ledger and exports<select className="text-input" value={filter.codeId ?? ''} onChange={event=>onCodeFilter(event.target.value||undefined)}><option value="">All codes and uncoded responses</option>{codes.map(code=><option key={code.id} value={code.id}>{code.label}</option>)}</select></label>
    {catalogNext?<button className="quiet-button" type="button" onClick={()=>void loadCodes(catalogNext).catch(reason=>setError((reason as Error).message))}>Load more workspace codes</button>:null}
    {error?<p role="alert" className="status-note" data-tone="error">{error}</p>:null}{notice?<p className="status-note" role="status">{notice}</p>:null}
    <CodeMetrics counts={counts} cross={cross} codes={codes} row={row} column={column} onRow={setRow} onColumn={setColumn} onMore={()=>setCountAfter(counts?.nextAfter??undefined)} />
    <div className="coding-lower"><CodingAnswers timeZone={timeZone} answers={answers?.answers} codes={codes} busy={busy} onAssign={(answer,codeId)=>void mutate(()=>codingRequest(assignment(answer,codeId),{},'PUT'),'Code assigned.')} onRemove={(answer,codeId)=>void mutate(()=>codingRequest(assignment(answer,codeId),{},'DELETE'),'Code removed.')} next={!!answers?.nextAfter} previous={!!answerHistory.length} onNext={()=>{setAnswerHistory(current=>[...current,answerAfter]);setAnswerAfter(answers?.nextAfter??undefined)}} onPrevious={()=>{setAnswerAfter(answerHistory.at(-1));setAnswerHistory(current=>current.slice(0,-1))}} />
    <CodingSuggestions timeZone={timeZone} suggestions={suggestions?.suggestions} codes={codes} busy={busy} onDecide={(quote,codeId)=>void mutate(()=>codingRequest(`coding/suggestions/${encodeURIComponent(quote.id)}`,{decision:codeId?'accepted':'rejected',...(codeId?{codeId}:{})},'PUT'),codeId?'Suggestion accepted.':'Suggestion rejected.')} next={!!suggestions?.nextAfter} previous={!!suggestionHistory.length} onNext={()=>{setSuggestionHistory(current=>[...current,suggestionAfter]);setSuggestionAfter(suggestions?.nextAfter??undefined)}} onPrevious={()=>{setSuggestionAfter(suggestionHistory.at(-1));setSuggestionHistory(current=>current.slice(0,-1))}} /></div>
  </section>
}

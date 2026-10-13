import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { reportingApi } from '../../../app/api'
export function TextAnswers({ flowId, revisionId, questionId }: {flowId:string;revisionId:string;questionId:string}) {
  const [search,setSearch] = useState('')
  const [texts,setTexts] = useState<string[]>([])
  const [cursor,setCursor] = useState<string>()
  const [matching,setMatching] = useState<number>()
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState<string>()
  const [page,setPage] = useState(0)
  const request = useRef<AbortController | undefined>(undefined)
  const countRequest = useRef<AbortController | undefined>(undefined)
  const countMatches = async (cursor: string, abort: AbortController) => {
    try {
      let next: string | undefined = cursor
      do {
        const result = await reportingApi.textPage(flowId,{revisionId,questionId,search,cursor:next,countOnly:true},abort.signal)
        if (abort.signal.aborted) return
        next = result.countCursor
        if (!next) setMatching(result.matching)
      } while (next)
    } catch (reason) {
      if (!abort.signal.aborted) { request.current?.abort(); setBusy(false); setTexts([]); setCursor(undefined); setMatching(undefined); setError(reason instanceof Error ? reason.message : 'Answers could not be counted.') }
    }
  }
  const load = async (after?: string) => {
    request.current?.abort()
    const abort = new AbortController(); request.current = abort
    if (!after) { countRequest.current?.abort(); countRequest.current=new AbortController(); setMatching(undefined) }
    setBusy(true); setError(undefined); setTexts([])
    const loaded: string[] = []
    let next = after
    try {
      do {
        const result = await reportingApi.textPage(flowId,{revisionId,questionId,search,cursor:next},abort.signal)
        if (abort.signal.aborted) return
        if (result.countCursor) void countMatches(result.countCursor,countRequest.current!)
        if (result.matching !== undefined) setMatching(result.matching)
        loaded.push(...result.texts); next = result.cursor
        setTexts([...loaded])
      } while (next && loaded.length < (after ? 10 : 5))
      setCursor(next); setPage(value => after ? value+1 : 0)
    } catch (reason) { if (!abort.signal.aborted) { countRequest.current?.abort(); setMatching(undefined); setTexts([]); setError(reason instanceof Error ? reason.message : 'Answers could not load.'); setCursor(undefined) } }
    finally { if (!abort.signal.aborted) setBusy(false) }
  }
  useEffect(() => { void load(); return () => { request.current?.abort(); countRequest.current?.abort() } },[flowId,revisionId,questionId,search])
  return <>
    <label className="search-field"><span className="sr-only">Search answers</span><Search aria-hidden="true" size={18} strokeWidth={1.75} /><input className="text-input" type="search" placeholder="Search answers" maxLength={5000} value={search} onChange={event=>setSearch(event.target.value)} /></label>
    <p className="muted" aria-live="polite">{matching === undefined ? error ? 'Matching count unavailable.' : 'Counting all matching answers…' : `${matching} matching ${matching === 1 ? 'answer' : 'answers'} · latest first`}{busy ? ' Searching released answers…' : ` · ${texts.length} on this page`}</p>
    {texts.length ? <ul className="text-answers">{texts.map((text,index)=><li key={index} data-empty={text ? undefined : ''}>{text || 'Empty answer'}</li>)}</ul> : null}
    {error ? <p role="alert" className="status-note" data-tone="error">{error}</p> : null}
    {cursor && !busy ? <button className="quiet-button focus-ring" type="button" onClick={()=>void load(cursor)}>Show more answers</button> : null}
    {page || error ? <button className="quiet-button focus-ring" type="button" disabled={busy} onClick={()=>void load()}>Latest answers</button> : null}
  </>
}

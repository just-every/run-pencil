import { useCallback, useEffect, useState } from 'react'
import { keepIfSame, useQuietRefresh } from '../../shared/ui/useQuietRefresh'
type Item={id:string;ruleName:string;flowTitle:string;flowId:string;status:string;reason:string|null;readAt:string|null;createdAt:string}
export function AnswerAlertAttention({flowId}:{flowId:string}) {
  const [items,setItems]=useState<Item[]>(),[busy,setBusy]=useState(false),[error,setError]=useState<string>(),[notice,setNotice]=useState<string>()
  const refresh=useCallback(async()=>{const response=await fetch(`/api/app/answer-alerts?flowId=${encodeURIComponent(flowId)}`);if(!response.ok)throw new Error('Answer alerts could not be loaded.');const next=(await response.json() as {items:Item[]}).items;setItems(current=>current?keepIfSame(current,next):next)},[flowId])
  useQuietRefresh(refresh)
  useEffect(()=>{void refresh().catch(reason=>setError((reason as Error).message))},[refresh])
  const act=async(item:Item,kind:'read'|'retry')=>{setBusy(true);setError(undefined);setNotice(undefined);try{const response=await fetch(`/api/app/answer-alerts/${encodeURIComponent(item.id)}/${kind}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(kind==='retry'?{duplicateRiskAccepted:item.status==='unknown'}:{})});if(!response.ok)throw new Error('The alert could not be updated.');await refresh();setNotice(kind==='read'?'Alert marked as read.':'Alert retry queued.')}catch(reason){setError((reason as Error).message)}finally{setBusy(false)}}
  return <section aria-label="Answer alert attention"><h3>Answer alerts</h3><p>Matching rules appear here for your account. Email contains no answer text.</p>
    {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
    {!items?<p aria-busy="true">Loading answer alerts…</p>:items.length?<ul>{items.map(item=><li key={item.id}><strong>{item.ruleName}</strong> · {item.flowTitle} · {item.status}{item.readAt?' · Read':' · Unread'}
      {item.reason?<p>{item.reason}</p>:null}
      {!item.readAt?<button className="quiet-button focus-ring" disabled={busy} type="button" onClick={()=>void act(item,'read')}>Mark alert as read</button>:null}
      {['failed','unknown'].includes(item.status)?<button className="secondary-button focus-ring" disabled={busy} type="button" onClick={()=>{if(item.status!=='unknown'||window.confirm('The previous alert outcome is unknown. Sending again may duplicate email. Send again?'))void act(item,'retry')}}>Retry alert email</button>:null}
    </li>)}</ul>:<p>No matching answer alerts yet.</p>}
  </section>
}

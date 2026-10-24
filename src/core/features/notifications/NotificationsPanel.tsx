import { AnswerAlertAttention } from './AnswerAlertAttention'
import { useId } from 'react'
import { useNotifications } from './useNotifications'
import type { NotificationMode } from './repository'
export function NotificationsPanel({flowId,timeZone}:{flowId:string;timeZone:string}) {
  const when=(value:string)=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short',timeZone}).format(new Date(value))
  const id=useId(), {state,error,busy,notice,setMode,retry,refresh}=useNotifications(flowId)
  return <section className="panel" aria-labelledby={id} style={{minWidth:0,overflowWrap:'anywhere'}}>
    <h2 id={id}>Response notifications</h2>
    <p>Choose when this flow emails you. Each message names the business and flow and links to signed-in results. Answers and respondent details stay in Pencil.</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!state ? <p aria-busy="true">Loading notifications…</p> : <>
      {state.hostedDemo ? <p role="status">This is a demo: email sends are simulated and nothing is sent. A Sent status here records a simulated delivery.</p> : state.localMail ? <p role="status">Local development suppresses email. A Sent status here records a completed local delivery; no message leaves this computer.</p> : <p>Immediately sends when a response is received or Pencil is next used, usually within a minute. {state.timerLastStartedAt ? 'The automatic timer is running too.' : 'Cloudflare’s automatic timer is starting. You can keep collecting responses: ordinary page visits and requests send due notices while it starts.'}</p>}
      {state.senderError && <p role="alert">{state.senderError}</p>}
      <label className="inspector-field">Email me about completed responses<select className="text-input" value={state.mode} disabled={busy} onChange={e=>void setMode(e.target.value as NotificationMode)}><option value="immediately">Immediately</option><option value="daily">Daily</option><option value="off">Off</option></select></label>
      <p>Your choice applies only to your account and this flow.</p><p>Daily starts when enabled, with no historical mail.</p>
      {state.daily && <p>Daily at {state.daily.opening} ({state.daily.zone}). Next cutoff: {when(state.daily.nextOpening)} ({timeZone}).</p>}
      {state.failureReason && <p role="alert">{state.failureReason}</p>}
      <h3>Recent notification deliveries</h3>
      <button className="quiet-button focus-ring" type="button" disabled={busy} onClick={()=>void refresh()}>Refresh delivery status</button>
      {state.deliveries.length ? <ul>{state.deliveries.map(delivery=><li key={delivery.id}>
        <strong>{delivery.status.charAt(0).toUpperCase()+delivery.status.slice(1)}</strong> · {delivery.attempts===1?'1 attempt':`${delivery.attempts} attempts`} · {when(delivery.updatedAt)} · to {delivery.recipient}
        {delivery.day && <p>Digest for {delivery.day} · {when(delivery.cutoffStart!)} to {when(delivery.cutoffEnd!)} ({timeZone})</p>}
        {delivery.reason && <p>{delivery.reason}</p>}
        {delivery.replayEnabled !== 0 && ['failed','unknown'].includes(delivery.status) && <button className="secondary-button focus-ring" type="button" disabled={busy || state.mode==='off' || !!state.senderError} onClick={()=>{const accepted=delivery.status==='unknown' && window.confirm('The previous delivery outcome is unknown. Sending again may deliver a duplicate email. Send again anyway?'); if(delivery.status!=='unknown'||accepted) void retry(delivery.id,accepted)}}>{delivery.status==='unknown'?'Send again':'Retry'}</button>}
      </li>)}</ul> : <p>No response notifications yet.</p>}
      <AnswerAlertAttention flowId={flowId}/>
    </>}
  </section>
}

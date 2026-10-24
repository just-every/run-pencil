import { useEffect,useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { chatRequest } from './client'

export function ChatConnections(){
  const [slack,setSlack]=useState<{saved:boolean;interactionUrl:string}>(),[teams,setTeams]=useState<{saved:boolean}>()
  const [botToken,setBot]=useState(''),[signingSecret,setSecret]=useState(''),[webhook,setWebhook]=useState('')
  const [busy,setBusy]=useState(false),[error,setError]=useState<string>(),[notice,setNotice]=useState<string>()
  const load=async()=>{const [s,t]=await Promise.all([chatRequest<{saved:boolean;interactionUrl:string}>('/api/app/connections/slack'),chatRequest<{saved:boolean}>('/api/app/connections/teams')]);setSlack(s);setTeams(t)}
  useEffect(()=>{void load().catch(reason=>setError((reason as Error).message))},[])
  const save=async(platform:'slack'|'teams',remove=false)=>{setBusy(true);setError(undefined);setNotice(undefined);try{await chatRequest(`/api/app/connections/${platform}`,remove?'DELETE':'PUT',remove?{}:platform==='slack'?{botToken,signingSecret}:{webhookUrl:webhook});setBot('');setSecret('');setWebhook('');await load();setNotice(`${platform==='slack'?'Slack':'Teams'} connection ${remove?'removed':'saved'}.`)}catch(reason){setError((reason as Error).message)}finally{setBusy(false)}}
  return <section className="panel settings-card" aria-labelledby="chat-connections-title" aria-busy={busy||!slack&&!error}>
    <header className="card-title"><MessageSquare aria-hidden="true" size={22} strokeWidth={1.75}/><h2 className="display" id="chat-connections-title">Slack and Teams</h2></header>
    <p>The installation owner connects chat. Credentials stay sealed and are excluded from backups. Choose each form’s channel, summary and action owner in its builder settings.</p>
    <details><summary className="focus-ring">Slack connection{slack?.saved?' · connected':''}</summary>
      <p>Use a bot with permission to post in the selected channel. Save its signing secret to verify action requests.</p>
      <form onSubmit={event=>{event.preventDefault();void save('slack')}}>
        <label className="inspector-field">Slack bot token<input className="text-input" type="password" autoComplete="new-password" required value={botToken} disabled={busy} onChange={event=>setBot(event.target.value)}/></label>
        <label className="inspector-field">Slack signing secret<input className="text-input" type="password" autoComplete="new-password" required value={signingSecret} disabled={busy} onChange={event=>setSecret(event.target.value)}/></label>
        <button className="secondary-button focus-ring" type="submit" disabled={busy}>Save Slack connection</button>
      </form>
      {slack?.interactionUrl?<><p>Set the Slack app’s interaction request URL to:</p><p style={{overflowWrap:'anywhere'}}>{slack.interactionUrl}</p></>:null}
      {slack?.saved?<button className="quiet-button focus-ring" type="button" disabled={busy} onClick={()=>void save('slack',true)}>Remove Slack connection</button>:null}
    </details>
    <details><summary className="focus-ring">Teams connection{teams?.saved?' · connected':''}</summary>
      <p>Save the channel’s incoming-webhook address. Each form maps an action owner’s Microsoft user ID so reminders can mention that owner.</p>
      <form onSubmit={event=>{event.preventDefault();void save('teams')}}>
        <label className="inspector-field">Teams incoming webhook<input className="text-input" type="password" autoComplete="new-password" required value={webhook} disabled={busy} onChange={event=>setWebhook(event.target.value)}/></label>
        <button className="secondary-button focus-ring" type="submit" disabled={busy}>Save Teams connection</button>
      </form>
      {teams?.saved?<button className="quiet-button focus-ring" type="button" disabled={busy} onClick={()=>void save('teams',true)}>Remove Teams connection</button>:null}
    </details>
    {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
  </section>
}

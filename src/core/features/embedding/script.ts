import type { Hono } from 'hono'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'

/** No respondent state crosses this interface. The only dynamic value is layout. */
export function embeddingScript(install: string, host: string, slug: string) {
  const literal = (value: string) => JSON.stringify(value).replace(/</g, '\\u003c')
  return `(() => {
'use strict';
const install=${literal(install)}, host=${literal(host)}, slug=${literal(slug)};
const script=document.currentScript;
if (!script || new URL(script.src).origin !== install || location.origin !== host) return;
const challenge=Array.from(crypto.getRandomValues(new Uint8Array(16)), n=>n.toString(16).padStart(2,'0')).join('');
const frame=document.createElement('iframe');
frame.title='Feedback form'; frame.setAttribute('sandbox','allow-scripts allow-forms');
frame.referrerPolicy='origin'; frame.style.cssText='display:block;border:0;width:100%;height:700px';
frame.src=install+'/embed/'+encodeURIComponent(slug)+'#pencil-embed='+challenge;
let completed=false, loaded=false;
const receive=(event)=>{
 if(event.source!==frame.contentWindow || event.origin!=='null') return;
 const data=event.data;
 if(!data || typeof data!=='object' || Array.isArray(data) || data.challenge!==challenge) return;
 const keys=Object.keys(data);
 if(data.type==='pencil:height' && keys.length===3 && Number.isInteger(data.height) && data.height>0 && data.height<=100000 && loaded) { frame.style.height=data.height+'px'; frame.dispatchEvent(new CustomEvent('pencil:height',{detail:{height:data.height},bubbles:true})); }
 else if(data.type==='pencil:loaded' && keys.length===2) { if(!loaded) { loaded=true; frame.dispatchEvent(new CustomEvent('pencil:loaded',{bubbles:true})); } frame.contentWindow.postMessage({type:'pencil:init',challenge},'*'); }
 else if(data.type==='pencil:completed' && keys.length===2 && loaded && !completed) { completed=true; frame.dispatchEvent(new CustomEvent('pencil:completed',{bubbles:true})); }
};
addEventListener('message',receive);
script.insertAdjacentElement('afterend',frame);
const observer=new MutationObserver(()=>{ if(!frame.isConnected){removeEventListener('message',receive); observer.disconnect();} });
observer.observe(document.documentElement,{childList:true,subtree:true});
})();`
}

export function registerEmbeddingRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  app.get('/embed.js', async c => {
    const params = new URL(c.req.url).searchParams
    const slug = params.get('flow') ?? ''
    if (params.size !== 1 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return c.json({ error: 'VALIDATION_ERROR', message: 'Choose a published flow.' }, 400)
    const workspaceId = await services(c).flows.getFlowWorkspaceId(slug)
    let host: string | undefined
    try { host = new URL(c.req.header('Referer') ?? '').origin } catch { /* fail closed */ }
    const origins = workspaceId ? (await services(c).workspace.getSettings(workspaceId)).embedAllowedOrigins : []
    if (!host || !origins.includes(host)) return c.text('This host is not allowed to embed the flow.', 403, { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' })
    return c.body(embeddingScript(c.get('platform').configuration.appOrigin, host, slug), 200, { 'Content-Type': 'text/javascript; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Vary': 'Referer' })
  })
}

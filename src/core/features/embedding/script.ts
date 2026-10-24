import type { Hono } from 'hono'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
import { checkoutOrigin } from './messages'

/** No respondent answer crosses this interface. The dynamic values are layout and, for a payment step, the Stripe
 * Checkout page the host opens at top level (Checkout refuses to load in a frame). */
export function embeddingScript(install: string, host: string, slug: string, collectorKey?: string) {
  const literal = (value: string) => JSON.stringify(value).replace(/</g, '\\u003c')
  return `(() => {
'use strict';
const install=${literal(install)}, host=${literal(host)}, slug=${literal(slug)}, collector=${literal(collectorKey ?? '')};
const script=document.currentScript;
if (!script || new URL(script.src).origin !== install || location.origin !== host) return;
const challenge=Array.from(crypto.getRandomValues(new Uint8Array(16)), n=>n.toString(16).padStart(2,'0')).join('');
const frame=document.createElement('iframe');
frame.title='Feedback form'; frame.setAttribute('sandbox','allow-scripts allow-forms allow-top-navigation-by-user-activation');
frame.referrerPolicy='origin'; frame.style.cssText='display:block;border:0;width:100%;height:700px';
frame.src=install+'/embed/'+encodeURIComponent(slug)+(collector?'?collector='+encodeURIComponent(collector):'')+'#pencil-embed='+challenge;
let completed=false, loaded=false;
const checkoutSessions=new Set();
const validCheckout=(value)=>{try{const url=new URL(value);return typeof value==='string' && url.origin==='${checkoutOrigin}' && !url.username && !url.password;}catch{return false;}};
const receive=(event)=>{
 if(event.source!==frame.contentWindow || event.origin!=='null') return;
 const data=event.data;
 if(!data || typeof data!=='object' || Array.isArray(data) || data.challenge!==challenge) return;
 const keys=Object.keys(data);
 if(data.type==='pencil:height' && keys.length===3 && Number.isInteger(data.height) && data.height>0 && data.height<=100000 && loaded) { frame.style.height=data.height+'px'; frame.dispatchEvent(new CustomEvent('pencil:height',{detail:{height:data.height},bubbles:true})); }
 else if(data.type==='pencil:loaded' && keys.length===2) { if(!loaded) { loaded=true; frame.dispatchEvent(new CustomEvent('pencil:loaded',{bubbles:true})); } frame.contentWindow.postMessage({type:'pencil:loaded',challenge},'*'); }
 else if(data.type==='pencil:completed' && keys.length===2 && loaded && !completed) { completed=true; frame.dispatchEvent(new CustomEvent('pencil:completed',{bubbles:true})); }
 else if(data.type==='pencil:checkout' && keys.length===4 && loaded && validCheckout(data.url) && typeof data.sessionId==='string' && /^[A-Za-z0-9_-]{1,255}$/.test(data.sessionId) && !checkoutSessions.has(data.sessionId)) { checkoutSessions.add(data.sessionId); frame.dispatchEvent(new CustomEvent('pencil:checkout',{detail:{url:data.url,sessionId:data.sessionId},bubbles:true})); location.assign(data.url); }
};
addEventListener('message',receive);
const mode=script.getAttribute('data-pencil-mode') || 'inline';
if (!['inline','full-page','popup','popover','slider','side-tab'].includes(mode)) return;
const campaign=new URLSearchParams();
for (const [key,value] of new URLSearchParams(location.search)) if (/^utm_[a-z_]{1,50}$/.test(key) && value.length<=1000) campaign.set(key,value);
if (campaign.size) frame.src=frame.src.replace('#', (frame.src.includes('?')?'&':'?')+campaign.toString()+'#');
if (mode==='inline') script.insertAdjacentElement('afterend',frame);
else {
 const shell=document.createElement('section');
 shell.setAttribute('role','dialog'); shell.setAttribute('aria-label','Feedback form'); shell.hidden=true;
 shell.style.cssText='position:fixed;z-index:2147483000;overflow:auto;background:white;color:#242424;box-shadow:0 8px 40px #0004;max-width:100vw;max-height:100dvh;';
 shell.style.cssText+=mode==='full-page'?'inset:0;':mode==='popup'?'inset:5vh max(12px,calc((100vw - 760px)/2));border-radius:16px;':mode==='popover'?'right:16px;bottom:76px;width:min(420px,calc(100vw - 32px));border-radius:16px;':mode==='slider'?'right:0;top:0;bottom:0;width:min(560px,100vw);':'right:0;top:8vh;bottom:8vh;width:min(480px,100vw);border-radius:16px 0 0 16px;';
 const close=document.createElement('button'); close.type='button';close.textContent='Close form';close.style.cssText='font:16px sans-serif;margin:12px;padding:8px 12px;';
 const launcher=document.createElement('button');launcher.type='button';launcher.textContent=script.getAttribute('data-pencil-label') || 'Open form';launcher.style.cssText='position:fixed;z-index:2147482999;right:16px;bottom:16px;font:16px sans-serif;padding:12px 18px;border:1px solid #555;border-radius:24px;background:white;color:#242424;';
 if (mode==='side-tab')launcher.style.cssText+='bottom:50%;right:0;border-radius:12px 0 0 12px;';
 const capText=script.getAttribute('data-pencil-cap') || '1', cap=Number(capText);
 const trigger=script.getAttribute('data-pencil-trigger') || 'click';
 if (!Number.isSafeInteger(cap)||cap<1||cap>100||!['click','delay','scroll','exit'].includes(trigger)) return;
 const key='pencil:opens:'+install+':'+slug+':'+mode;
 let opened=false, previousFocus;
 const open=()=>{
  if(opened)return;
  let count;try{count=Number(localStorage.getItem(key)||'0');if(!Number.isSafeInteger(count)||count<0||count>=cap)return;localStorage.setItem(key,String(count+1));}catch{return;}
  opened=true;previousFocus=document.activeElement;shell.hidden=false;shell.append(close,frame);close.focus();
 };
 const shut=()=>{shell.hidden=true;opened=false;previousFocus?.focus();};
 close.addEventListener('click',shut);
 shell.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();shut();}if(event.key==='Tab'){const controls=[close,frame];if(event.shiftKey&&document.activeElement===close){event.preventDefault();frame.focus();}else if(!event.shiftKey&&document.activeElement===frame){event.preventDefault();close.focus();}}});
 document.body.append(shell,launcher); launcher.addEventListener('click',open);
 const selector=script.getAttribute('data-pencil-target');
 if(selector){let target;try{target=document.querySelector(selector);}catch{return;}target?.addEventListener('click',open);}
 if(trigger==='delay'){const delay=Number(script.getAttribute('data-pencil-delay')||'1000');if(Number.isFinite(delay)&&delay>=0&&delay<=3600000)setTimeout(open,delay);}
 if(trigger==='scroll'){const depth=Number(script.getAttribute('data-pencil-scroll')||'50');if(Number.isFinite(depth)&&depth>=0&&depth<=100){const scroll=()=>{const range=document.documentElement.scrollHeight-innerHeight;if(range>0&&scrollY/range*100>=depth){removeEventListener('scroll',scroll);open();}};addEventListener('scroll',scroll,{passive:true});scroll();}}
 if(trigger==='exit'){const exit=event=>{if(event.clientY<=0&&!event.relatedTarget){document.removeEventListener('mouseout',exit);open();}};document.addEventListener('mouseout',exit);}
}

const observer=new MutationObserver(()=>{ if(loaded && !frame.isConnected){removeEventListener('message',receive); observer.disconnect();} });
observer.observe(document.documentElement,{childList:true,subtree:true});
})();`
}

export function registerEmbeddingRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  app.get('/embed.js', async c => {
    const params = new URL(c.req.url).searchParams
    const slug = params.get('flow') ?? ''
    const collector=params.get('collector') ?? undefined
    if (params.size !== (collector===undefined?1:2) || (collector!==undefined && !/^[a-f0-9]{32}$/.test(collector)) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return c.json({ error: 'VALIDATION_ERROR', message: 'Choose a published flow.' }, 400)
    const workspaceId = await services(c).flows.getFlowWorkspaceId(slug)
    let host: string | undefined
    try { host = new URL(c.req.header('Referer') ?? '').origin } catch { /* fail closed */ }
    const origins = workspaceId ? (await services(c).workspace.getSettings(workspaceId)).embedAllowedOrigins : []
    if (!host || !origins.includes(host)) return c.text('This host is not allowed to embed the flow.', 403, { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' })
    return c.body(embeddingScript(c.get('platform').configuration.appOrigin, host, slug, collector), 200, { 'Content-Type': 'text/javascript; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Vary': 'Referer' })
  })
}

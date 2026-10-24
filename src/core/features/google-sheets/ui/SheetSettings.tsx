import {useEffect,useState} from 'react'
export function SheetSettings({flowId,disclosed,onDisclosure}:{flowId:string;disclosed:boolean;onDisclosure:(value:boolean)=>Promise<void>}){
 const [value,setValue]=useState(disclosed),[spreadsheetId,setId]=useState(''),[tabs,setTabs]=useState<Array<{title:string;id:number}>>([]),[tab,setTab]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string>(),[linked,setLinked]=useState<string>()
 const base=`/api/app/flows/${encodeURIComponent(flowId)}/google-sheet`
 useEffect(()=>{void fetch(base).then(async r=>{if(!r.ok)throw new Error('Worksheet settings could not load.');const result=await r.json() as {link:{spreadsheetId:string;tab:string;armed:number}|null};if(result.link){setId(result.link.spreadsheetId);setLinked(`${result.link.tab}${result.link.armed?'':' · restored, reconnect explicitly'}`)}}).catch(e=>setError((e as Error).message))},[base])
 const act=async(run:()=>Promise<void>)=>{setBusy(true);setError(undefined);try{await run()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const call=async(path:string,method='GET',body?:unknown)=>{const r=await fetch(path,{method,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});const data=await r.json() as {message?:string;worksheets:Array<{id:number;title:string}>;link:{tab:string}};if(!r.ok)throw new Error(data.message??'The worksheet request failed.');return data}
 return <details><summary className="focus-ring">Google Sheets</summary>
 <label className="toggle-row"><input type="checkbox" checked={value} disabled={busy} onChange={e=>setValue(e.target.checked)}/>Disclose Google Sheets to respondents</label>
 <button className="secondary-button focus-ring" type="button" disabled={busy||value===disclosed} onClick={()=>void act(()=>onDisclosure(value))}>Save Sheets disclosure</button><p>Publish this disclosure before attaching a worksheet. Only responses whose published revision names Google Sheets are sent.</p>
 {linked?<p>Connected worksheet: {linked}</p>:null}
 <label className="inspector-field">Spreadsheet ID<input className="text-input" value={spreadsheetId} disabled={busy} onChange={e=>{setId(e.target.value);setTabs([]);setTab('')}}/></label>
 <button className="quiet-button focus-ring" type="button" disabled={busy||!spreadsheetId} onClick={()=>void act(async()=>{const result=await call('/api/app/connections/google/worksheets?spreadsheetId='+encodeURIComponent(spreadsheetId));setTabs(result.worksheets);setTab(result.worksheets[0]?.title??'')})}>Find worksheets</button>
 <label className="inspector-field">Worksheet<select aria-label="Worksheet" className="text-input" value={tab} disabled={busy||!tabs.length} onChange={e=>setTab(e.target.value)}><option value="">Choose a worksheet</option>{tabs.map(sheet=><option key={sheet.id} value={sheet.title}>{sheet.title}</option>)}</select></label>
 <button className="secondary-button focus-ring" type="button" disabled={busy||!tab} onClick={()=>void act(async()=>{const result=await call(base,'PUT',{spreadsheetId,tab});setLinked(result.link.tab)})}>Attach worksheet</button>
 {linked?<button className="quiet-button focus-ring" type="button" disabled={busy} onClick={()=>void act(async()=>{await call(base+'/sync','POST',{})})}>Sync pending rows</button>:null}
 {error?<p role="alert">{error}</p>:null}</details>
}

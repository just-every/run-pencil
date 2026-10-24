import { useEffect, useState } from 'react'
import { formatUsd, paymentStateLabels, type PaymentState } from '../../../shared/payments'
import './payments.css'

type Row = {responseId:string;provider:string;id:string|null;state:PaymentState;amount:number;total:number|null;refundedAmount:number;methodType:string|null;methodLast4:string|null;subscriptionStatus:string|null;at:string}
async function read<T>(path:string,data?:unknown):Promise<T> {
  const response=await fetch(path,{credentials:'same-origin',...(data===undefined ? {} : {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)})})
  const body=await response.json() as T & {message?:string}
  if(!response.ok)throw new Error(body.message??'The payment request could not be completed.')
  return body
}

/** Reached from a response's existing payment record; financial mutations remain owner-only on the server. */
export function PaymentsPage() {
  const [rows,setRows]=useState<Row[]>([]),[state,setState]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
  const [selected,setSelected]=useState<Row>(),[amount,setAmount]=useState('10.00'),[confirmed,setConfirmed]=useState(false)
  const [period,setPeriod]=useState(new Date().toISOString().slice(0,7))
  const [report,setReport]=useState<{pencil:number;providerPaid:number;providerRefunded:number;providerNet:number;mismatch:boolean;gap:string}>()
  const load=async()=>{const result=await read<{payments:Row[]}>(`/api/app/payments${state?'?state='+encodeURIComponent(state):''}`);setRows(result.payments)}
  useEffect(()=>{void load().catch(error=>setNotice(error.message))},[state])
  const act=async(action:()=>Promise<void>)=>{setBusy(true);setNotice('');try{await action()}catch(error){setNotice(error instanceof Error?error.message:'Payment request failed.')}finally{setBusy(false)}}
  return <main className="payments-page"><header><h1>Payments</h1><p>Stripe payments and refunds. Billing management belongs to Stripe’s customer portal.</p></header>
    <div className="payments-tools"><label>Status<select className="text-input" value={state} onChange={event=>setState(event.target.value)}><option value="">All statuses</option>{Object.entries(paymentStateLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <a className="secondary-button focus-ring" href={`/api/app/payments?format=csv${state?'&state='+encodeURIComponent(state):''}`}>Export payments</a><button className="secondary-button focus-ring" disabled={busy} onClick={()=>void act(load)}>Refresh payments</button></div>
    {notice?<p role="status">{notice}</p>:null}
    <section aria-label="Payment ledger" className="payments-list">{rows.map(row=><article className="payments-row" key={row.responseId}>
      <div><strong>{paymentStateLabels[row.state]}</strong><p>{row.provider} · <code>{row.id??'Checkout not opened'}</code></p><p>{row.methodType??'Method not received'}{row.methodLast4?` · ending ${row.methodLast4}`:''}</p>{row.subscriptionStatus?<p>Subscription: {row.subscriptionStatus}</p>:null}</div>
      <div><p>{row.total===null?'Quoted':'Charged'} {formatUsd(row.total??row.amount)}</p><p>Refunded {formatUsd(row.refundedAmount)}</p>{['paid','partially_refunded'].includes(row.state)?<button className="quiet-button focus-ring" onClick={()=>{setSelected(row);setConfirmed(false)}}>Refund payment</button>:null}</div>
    </article>)}</section>
    {selected?<form className="payment-pricing" aria-label="Confirm refund" onSubmit={event=>{event.preventDefault();void act(async()=>{await read(`/api/app/payments/${encodeURIComponent(selected.responseId)}/refund`,{amount:Math.round(Number(amount)*100),confirm:confirmed});setSelected(undefined);setNotice('Refund requested. Refresh after Stripe confirms it by webhook.');await load()})}}>
      <h2>Confirm refund</h2><p>Stripe payment <code>{selected.id}</code>. Remaining {formatUsd((selected.total??selected.amount)-selected.refundedAmount)}.</p>
      <label>Refund amount (USD)<input className="text-input" type="number" min="0.01" max={((selected.total??selected.amount)-selected.refundedAmount)/100} step="0.01" required value={amount} onChange={event=>{setAmount(event.target.value);setConfirmed(false)}} /></label>
      <label className="payment-choice"><input type="checkbox" required checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} />I confirm a refund of {formatUsd(Math.round(Number(amount)*100))}</label>
      <div className="payments-tools"><button className="primary-button focus-ring" disabled={busy||!confirmed}>Issue refund</button><button type="button" className="secondary-button focus-ring" onClick={()=>setSelected(undefined)}>Cancel refund</button></div>
    </form>:null}
    <details><summary>Reconcile with Stripe</summary><form className="payment-pricing" onSubmit={event=>{event.preventDefault();void act(async()=>setReport(await read('/api/app/payments/reconcile',{period})))}}><p>Only the installation owner can reconcile or refund.</p><label>UTC day or month<input className="text-input" value={period} required pattern="[0-9]{4}-[0-9]{2}(-[0-9]{2})?" onChange={event=>setPeriod(event.target.value)} /></label><button className="secondary-button focus-ring" disabled={busy}>Reconcile period</button></form>
      {report?<div role="status"><p>{report.mismatch?'Mismatch: review Stripe records.':'Totals match.'}</p><p>Pencil net {formatUsd(report.pencil)} · Stripe charged {formatUsd(report.providerPaid)} · refunded {formatUsd(report.providerRefunded)} · net {formatUsd(report.providerNet)}</p><p>{report.gap}</p></div>:null}
    </details>
  </main>
}

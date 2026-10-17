import { useId } from 'react'
import { Ban, Info } from 'lucide-react'
import type { CrossTabReport } from '../../reporting/crosstabs'
import { reportTime } from './useFlowReports'
const count=(value:number|null)=>value===null?'Withheld':value.toLocaleString()
const percent=(value:number)=>`${value.toLocaleString(undefined,{maximumFractionDigits:1})}%`
export function CrosstabTable({report,compact=false}:{report:CrossTabReport;compact?:boolean}){
  const id=useId(),cells=new Map(report.cells.map(cell=>[`${cell.rowKey}\0${cell.columnKey}`,cell]))
  return <>
    <p className="rv-scroll-cue" id={id}>Scroll horizontally to see every category.</p>
    <div className={`rv-table-frame${compact?' rv-table-frame--compact':''}`} role="region" aria-label={`${report.row.label} by ${report.column.label} results`} aria-describedby={id} tabIndex={0}>
      <table className="rv-table" style={{minWidth:Math.max(compact?360:620,(report.columns.length+2)*(compact?96:174))}}>
        <caption className="sr-only">{report.row.label} by {report.column.label}. Counts of paired respondents{compact?'':', with row and column percentages'}.</caption>
        <thead><tr><th rowSpan={2} scope="col">{report.row.label}</th><th colSpan={report.columns.length} scope="colgroup">{report.column.label}</th><th rowSpan={2} scope="col" className="rv-margin">Paired respondents in row</th></tr><tr>{report.columns.map(column=><th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
        <tbody>{report.rows.map(row=><tr key={row.key}><th scope="row">{row.label}</th>{report.columns.map(column=>{
          const cell=cells.get(`${row.key}\0${column.key}`)!
          return <td key={column.key} className={cell.suppressed?'rv-suppressed':undefined}>{cell.count===null?<span className="rv-suppressed-line"><Ban aria-hidden="true" size={17}/>{cell.suppressed?'Suppressed':'Withheld'}</span>:<strong className="rv-cell-count">{count(cell.count)}</strong>}{!compact&&<div className="rv-cell-percent">{cell.rowPercent!==null?<span>{percent(cell.rowPercent)} of row</span>:<span>{row.pairedRespondents===0?'No paired respondents in row':'Row percentage withheld'}</span>}{cell.columnPercent!==null?<span>{percent(cell.columnPercent)} of column</span>:<span>{column.pairedRespondents===0?'No paired respondents in column':'Column percentage withheld'}</span>}</div>}</td>
        })}<td className="rv-margin">{count(row.pairedRespondents)}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row">Paired respondents in column</th>{report.columns.map(column=><td className="rv-margin" key={column.key}>{count(column.pairedRespondents)}</td>)}<td className="rv-margin">{count(report.pairedRespondents)}</td></tr></tfoot>
      </table>
    </div>
  </>
}
export function CrosstabEvidence({report,timeZone}:{report:CrossTabReport;timeZone:string}){
  const statistics=[report.chiSquare.statistic===null?undefined:`Chi-square statistic ${report.chiSquare.statistic.toLocaleString(undefined,{maximumFractionDigits:3})}`,report.chiSquare.df===null?undefined:`${report.chiSquare.df} degrees of freedom`,report.chiSquare.minimumExpected===null?undefined:`Minimum expected count ${report.chiSquare.minimumExpected.toLocaleString(undefined,{maximumFractionDigits:2})}`].filter(Boolean)
  return <div className="rv-evidence">
    <p className="rv-cutoff">Revision {report.revision.number} · Cutoff {reportTime(report.cutoff,timeZone)} ({timeZone})</p>
    {report.totalRespondents!==null&&<p>{count(report.totalRespondents)} completed, released responses · {count(report.pairedRespondents)} paired · {count(report.unpairedRespondents)} without both dimensions answered</p>}
    <p>{report.percentages}</p>
    <div className="rv-notice"><Info aria-hidden="true" size={18}/><div><p><strong>{report.chiSquare.eligible?'Chi-square eligible.':'Chi-square not eligible.'}</strong> {report.chiSquare.reason}</p>{statistics.length>0&&<p>{statistics.join(' · ')}</p>}<p>{report.chiSquare.expectedCondition}</p></div></div>
    <p className="rv-disclosure">{report.disclosure.note}</p>
  </div>
}

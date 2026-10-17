import { useEffect, useRef, useState } from 'react'
import type { TrendReport } from '../../reporting'
export function TrendChart({report}:{report:TrendReport}) {
  const figure=useRef<HTMLElement>(null),[width,setWidth]=useState(780)
  useEffect(()=>{
    const element=figure.current
    if(!element)return
    const resize=()=>setWidth(Math.max(280,element.clientWidth))
    const observer=new ResizeObserver(resize);observer.observe(element);resize()
    return()=>observer.disconnect()
  },[])
  const left=55,right=width-20
  const values=report.periods.flatMap(point=>point.value===null?[]:[point.value]), low=Math.min(0,...values), high=Math.max(low+1,...values), x=(index:number)=>left+index/Math.max(1,report.periods.length-1)*(right-left), y=(value:number)=>175-(value-low)/(high-low)*145
  const paths:string[]=[];let path=''
  report.periods.forEach((point,index)=>{if(point.value===null){if(path)paths.push(path);path=''}else path+=`${path?' L':'M'}${x(index)},${y(point.value)}`});if(path)paths.push(path)
  return <figure ref={figure} className="trend-chart"><svg viewBox={`0 0 ${width} 210`} role="img" aria-label={`${report.metric==='share'?'Answer share':'Score'} trend; gaps mark periods below the minimum. Exact values follow in the table.`}><line x1={left} x2={right} y1="175" y2="175" className="trend-axis"/><text x="5" y="35">{high.toLocaleString(undefined,{maximumFractionDigits:1})}</text><text x="5" y="175">{low.toLocaleString(undefined,{maximumFractionDigits:1})}</text>{paths.map((value,index)=><path key={index} d={value} className="trend-line"/>)}{report.periods.map((point,index)=><g key={point.start}>{point.revisions.length?<line x1={x(index)} x2={x(index)} y1="20" y2="180" className="trend-revision"><title>{point.revisions.map(revision=>`Revision ${revision.revisionNumber}`).join(', ')}</title></line>:null}{point.value!==null?<circle cx={x(index)} cy={y(point.value)} r="4" className="trend-point"><title>{point.label}: {point.value}, {point.denominator} answered</title></circle>:null}</g>)}<text x={left} y="202">{report.periods[0]?.label}</text><text x={right} y="202" textAnchor="end">{report.periods.at(-1)?.label}</text></svg><figcaption>Dashed lines mark published revision boundaries. Gaps carry no score.</figcaption></figure>
}

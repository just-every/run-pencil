import { useEffect, useRef, useState } from 'react'
import type { CrossTabOptions, CrossTabReport, Dimension } from '../../reporting/crosstabs'
import type { ReportDashboard, ReportView, ReportViewDefinition } from '..'
import { failureMessage, reportViewsApi } from './client'
import type { FlowReportMetadata } from './useFlowReports'
export const dimensionValue=(dimension:Dimension)=>JSON.stringify(dimension)
type Selection={revisionId:string;row?:Dimension;column?:Dimension;filter:NonNullable<ReportViewDefinition['filter']>}
type Shown={report:CrossTabReport;definition:ReportViewDefinition;saved?:ReportView}
export function useCrosstab(flowId:string,metadata:FlowReportMetadata|undefined,viewId:string|undefined,onViewChange:(id?:string)=>void){
  const [selection,setSelection]=useState<Selection>({revisionId:'',filter:{}})
  const [options,setOptions]=useState<CrossTabOptions>(),[optionsError,setOptionsError]=useState<string>(),[optionVersion,setOptionVersion]=useState(0)
  const [dashboard,setDashboard]=useState<ReportDashboard>(),[shown,setShown]=useState<Shown>()
  const [error,setError]=useState<string>(),[note,setNote]=useState<string>(),[running,setRunning]=useState(false),[saving,setSaving]=useState(false),[loadingView,setLoadingView]=useState(false),[viewVersion,setViewVersion]=useState(0)
  const [name,setName]=useState(''),runController=useRef<AbortController|undefined>(undefined)
  useEffect(()=>setDashboard(metadata?.dashboard),[metadata])
  useEffect(()=>{if(metadata&&!viewId)setSelection(current=>current.revisionId?current:{...current,revisionId:(metadata.revisions.find(revision=>revision.isCurrent)??metadata.revisions[0])?.id??''})},[metadata,viewId])
  useEffect(()=>()=>runController.current?.abort(),[])
  useEffect(()=>{
    if(!selection.revisionId){setOptions(undefined);return}
    const controller=new AbortController();setOptions(undefined);setOptionsError(undefined)
    reportViewsApi.options(flowId,selection.revisionId,controller.signal).then(value=>{
      setOptions(value)
      setSelection(current=>current.revisionId!==value.revision.id?current:{...current,row:current.row??value.dimensions[0]?.dimension,column:current.column??value.dimensions[1]?.dimension})
    }).catch(error=>{if(!controller.signal.aborted)setOptionsError(failureMessage(error))})
    return()=>controller.abort()
  },[flowId,selection.revisionId,optionVersion])
  useEffect(()=>{
    runController.current?.abort();setRunning(false)
    if(!viewId){setLoadingView(false);return}
    const controller=new AbortController();setLoadingView(true);setShown(undefined);setError(undefined);setNote(undefined)
    reportViewsApi.get(flowId,viewId,controller.signal).then(saved=>{
      setSelection({...saved.definition,filter:saved.definition.filter??{}})
      setShown({report:saved.snapshot,definition:saved.definition,saved})
      setNote('This is a saved snapshot. Run a live crosstab to include newer responses.')
    }).catch(error=>{if(!controller.signal.aborted)setError(failureMessage(error))}).finally(()=>{if(!controller.signal.aborted)setLoadingView(false)})
    return()=>controller.abort()
  },[flowId,viewId,viewVersion])
  const change=(next:Selection)=>{
    runController.current?.abort();setRunning(false);setSelection(next);setShown(undefined);setError(undefined);setNote(undefined)
    if(viewId)onViewChange(undefined)
  }
  const valid=Boolean(options&&selection.row&&selection.column&&dimensionValue(selection.row)!==dimensionValue(selection.column)&&[selection.row,selection.column].every(dimension=>options.dimensions.some(option=>dimensionValue(option.dimension)===dimensionValue(dimension!))))
  const run=async()=>{
    if(!valid||!selection.row||!selection.column)return
    const definition:ReportViewDefinition={revisionId:selection.revisionId,row:selection.row,column:selection.column,filter:{...selection.filter}}
    runController.current?.abort();const controller=new AbortController();runController.current=controller
    setRunning(true);setShown(undefined);setError(undefined);setNote(undefined)
    try{const report=await reportViewsApi.crossTab(flowId,definition,controller.signal);if(!controller.signal.aborted){setShown({report,definition});setNote('Live crosstab. Save a view to keep this snapshot.');if(viewId)onViewChange(undefined)}}
    catch(error){if(!controller.signal.aborted)setError(failureMessage(error))}
    finally{if(!controller.signal.aborted)setRunning(false)}
  }
  const save=async()=>{
    if(!shown||!name.trim()||saving)return
    setSaving(true);setError(undefined);setNote(undefined)
    try{
      const saved=await reportViewsApi.save(flowId,{name:name.trim(),definition:shown.definition,cutoff:shown.report.cutoff})
      setShown({report:saved.snapshot,definition:saved.definition,saved});setName('');setNote(`Saved “${saved.name}”.`);onViewChange(saved.id)
      try{setDashboard(await reportViewsApi.list(flowId))}catch(error){setDashboard(undefined);setError(`The view was saved. ${failureMessage(error)}`)}
    }catch(error){setError(failureMessage(error))}finally{setSaving(false)}
  }
  const reloadViews=async()=>{try{setDashboard(await reportViewsApi.list(flowId));setError(undefined)}catch(error){setError(failureMessage(error))}}
  const chooseView=(id?:string)=>{setShown(undefined);setError(undefined);setNote(undefined);setName('');onViewChange(id)}
  return {selection,options,optionsError,dashboard,shown,error,note,running,saving,loadingView,name,setName,change,run,save,chooseView,valid,reloadViews,
    filterError:(message:string)=>{setShown(undefined);setError(message)},retryOptions:()=>setOptionVersion(value=>value+1),retryView:()=>setViewVersion(value=>value+1)}
}

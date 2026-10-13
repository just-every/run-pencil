import type { ImportForm, ImportStep } from './model'
export type GoogleSection={id:string;title:string;entries:(ImportStep|null)[]}
export type GoogleNavigation={step:ImportStep;section:number;option:number;value:string;action?:string;target?:string;location:string}
export function googleLogic(form:ImportForm,sections:GoogleSection[],actions:GoogleNavigation[],completion:ImportStep) {
  const entries=sections.flatMap(s=>s.entries.length?s.entries:[null])
  for(const [i,step] of entries.entries()) if(step) step.next=i===entries.length-1?completion.id:entries[i+1]?.id??null
  // An omitted first item has no predecessor: invalidate the first native question.
  const incomplete=new Set<ImportStep>()
  if(entries[0]===null) { const first=form.steps.find(s=>s.kind==='question'); if(first) incomplete.add(first) }
  for(const action of actions) {
    const {step,section}=action, current=sections[section]
    let reason='',destination:ImportStep|undefined
    if(action.action!==undefined&&action.target!==undefined) reason='A routing option has two destinations.'
    else if(current.entries[current.entries.length-1]!==step) reason='Google routes at section end; this question has trailing items. Native routing is immediate, so this path is unsupported until the operator repairs or reorders it.'
    else if(!['single_choice','dropdown','yes_no'].includes(step.questionType!)) reason='Only single-choice, dropdown or explicitly confirmed Yes/No navigation is supported.'
    else if(action.action==='RESTART_FORM') reason='Restart creates a cycle; native publication forbids cycles.'
    else if(action.action==='SUBMIT_FORM') destination=completion
    else {
      const index=action.target!==undefined?sections.findIndex(s=>s.id===action.target):action.action==='NEXT_SECTION'?section+1:-1
      if(index===sections.length&&action.action==='NEXT_SECTION') destination=completion
      else if(index<0) reason='Missing or unsupported section destination.'
      else if(index<=section) reason='Backward or same-section routing can loop; no path is guessed.'
      else { destination=sections[index]?.entries[0]??undefined; if(!destination) reason='Destination section is empty or begins with an omitted item; no replacement destination is guessed.' }
    }
    if(destination) {
      const expected=step.questionType==='yes_no'?action.value===step.settings.importYesLabel:step.choices[action.option]?.id
      form.rules.push({source:step.id,destination:destination.id,predicate:'equals',expected,position:form.rules.filter(r=>r.source===step.id).length})
    } else incomplete.add(step)
    form.report.push({location:action.location,label:step.prompt,sourceType:'section navigation',state:destination?'imported':'unsupported',change:destination?`Option ${action.option+1} → ${destination.prompt}`:'Path requires repair before publication',reason:destination?'Ordered first-match choice path at the last question of its section.':reason})
  }
  for(const step of incomplete) {
    step.next=null
    form.rules=form.rules.filter(r=>r.source!==step.id)
    for(const action of actions.filter(a=>a.step===step)) {
      const item=form.report.find(r=>r.location===action.location)
      if(item?.state==='imported') { item.state='unsupported'; item.change='Routing requires repair before publication'; item.reason='Another item or routing option leaves this source path incomplete. Its branches are withheld together so exhaustive choices cannot conceal an unsupported path.' }
    }
  }
}

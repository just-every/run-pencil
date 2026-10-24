import type { FlowStep, ChoiceOption } from '../app/api'
import { screenLayout } from './screenLayout'

export type PresentationOrder = { choices: Record<string, string[]>; blocks: Record<string, string[]> }
type Graph = {steps:FlowStep[];choices:ChoiceOption[]}
const choiceTypes = ['single_choice','multiple_choice','dropdown','priority']
export function randomizableChoices(type:string|null) { return choiceTypes.includes(type ?? '') }
function shuffle<T>(items:T[]) {
  const result=[...items]
  for(let i=result.length-1;i>0;i--) {
    const range=i+1,limit=0x100000000-(0x100000000%range)
    let value:number
    do { value=crypto.getRandomValues(new Uint32Array(1))[0] } while(value>=limit)
    const j=value%range;[result[i],result[j]]=[result[j],result[i]]
  }
  return result
}
function permutation(actual:unknown,expected:string[]) {
  return Array.isArray(actual)&&actual.length===expected.length&&new Set(actual).size===actual.length&&actual.every(id=>typeof id==='string'&&expected.includes(id))
}
export function presentationOrder(graph:Graph,proposed?:PresentationOrder):PresentationOrder {
  const order:PresentationOrder={choices:{},blocks:{}}
  for(const step of graph.steps) {
    if(step.questionSettings?.randomizeChoices===true&&randomizableChoices(step.questionType)) {
      const options=graph.choices.filter(choice=>choice.stepId===step.id).sort((a,b)=>a.position-b.position)
      const settings=step.questionSettings
      const fixed=options.filter(choice=>choice.id===settings.otherChoiceId||choice.id===settings.noneChoiceId).map(choice=>choice.id)
      const movable=options.filter(choice=>!fixed.includes(choice.id)).map(choice=>choice.id)
      const supplied=proposed?.choices[step.id]
      if(proposed&&(!permutation(supplied,[...movable,...fixed])||fixed.some((id,index)=>supplied![supplied!.length-fixed.length+index]!==id))) throw new Error('The presented choice order is invalid. Reload this form.')
      order.choices[step.id]=supplied ?? [...shuffle(movable),...fixed]
    }
    const screen=screenLayout(step)
    if(screen?.randomize) {
      const supplied=proposed?.blocks[step.id]
      if(proposed&&!permutation(supplied,screen.questionIds))throw new Error('The presented question block order is invalid. Reload this form.')
      order.blocks[step.id]=supplied ?? shuffle(screen.questionIds)
    }
  }
  if(proposed&&(Object.keys(proposed.choices).some(id=>!Object.hasOwn(order.choices,id))||Object.keys(proposed.blocks).some(id=>!Object.hasOwn(order.blocks,id))))throw new Error('The presented order belongs to another form. Reload this form.')
  return order
}
export function presentFlow<T extends Graph>(flow:T,order=presentationOrder(flow)):T&{presentation:PresentationOrder} {
  const choices=flow.choices.map(choice=>({...choice,position:order.choices[choice.stepId]?.indexOf(choice.id) ?? choice.position})).sort((a,b)=>a.position-b.position)
  const settings=(flow as T & {formSettings?:import('./hiddenFields').FormSettings}).formSettings
  const publicSettings=settings?{...settings,answerAlerts:undefined}:undefined
  return {...flow,...(publicSettings?{formSettings:publicSettings}:{}),choices,presentation:order}
}
export function retainedPresentation(order:PresentationOrder,reached:string[]):PresentationOrder {
  const visible=new Set(reached)
  return {choices:Object.fromEntries(Object.entries(order.choices).filter(([id])=>visible.has(id))),blocks:Object.fromEntries(Object.entries(order.blocks).filter(([id])=>visible.has(id)).map(([id,ids])=>[id,ids.filter(member=>visible.has(member))]))}
}

import { z } from 'zod'
export const biasKinds = ['leading','double_barreled','loaded','unbalanced'] as const
export const studioInput = z.object({
  mode:z.enum(['form','study']),goal:z.string().trim().min(1).max(2000),source:z.string().max(50000).default(''),sourceType:z.enum(['text','markdown','csv','html']).default('text'),
  priorForms:z.array(z.string().trim().min(1).max(200)).max(10).default([]).refine(ids=>new Set(ids).size===ids.length),population:z.number().int().min(1).max(1_000_000_000).default(1000),margin:z.number().min(.01).max(.2).default(.05),
}).strict()
export type StudioInput = z.infer<typeof studioInput>
export const studySchema=z.object({decision:z.string().trim().min(1).max(1000),hypotheses:z.array(z.string().trim().min(1).max(1000)).min(1).max(10),audience:z.string().trim().min(1).max(1000),channel:z.string().trim().min(1).max(1000),analysisPlan:z.string().trim().min(1).max(2000)}).strict()
export type Study = z.infer<typeof studySchema>
const key=z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,49}$/)
export const outputSchema=z.object({
  title:z.string().trim().min(1).max(200),
  steps:z.array(z.object({key,kind:z.enum(['question','completion']),questionType:z.enum(['short_text','long_text','email','number','single_choice','multiple_choice','yes_no','rating','nps']).nullable(),prompt:z.string().trim().min(1).max(1000),required:z.boolean(),choices:z.array(z.string().trim().min(1).max(300)).max(20),scale:z.object({min:z.number().int().min(0).max(1),max:z.number().int().min(1).max(11)}).strict().nullable(),next:key.nullable()}).strict()).min(2).max(30),
  branches:z.array(z.object({source:key,destination:key,predicate:z.enum(['equals','greater_than','less_than']),choiceIndex:z.number().int().min(0).max(19).nullable(),numberValue:z.number().nullable(),booleanValue:z.boolean().nullable()}).strict()).max(30),
  study:studySchema.nullable(),flags:z.array(z.object({step:key,kind:z.enum(biasKinds),reason:z.string().trim().min(1).max(1000)}).strict()).max(50),
}).strict()
export type StudioOutput=z.infer<typeof outputSchema>
export type BiasFlag={stepId:string;kind:typeof biasKinds[number];reason:string;source:'deterministic'|'provider'}
export type StudioDraft={flowId:string;title:string;slug:string;version:number;steps:Array<{id:string;prompt:string;questionType:string|null;generated:boolean}>;study:Study|null;sample:{population:number;margin:number;confidence:95;size:number}|null;flags:BiasFlag[]}

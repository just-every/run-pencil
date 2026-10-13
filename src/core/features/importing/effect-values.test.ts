import { expect, vi } from 'vitest'
import { contract } from '../../../test/contract'
import { nativeValueStrings, nativeAnswerString } from './effect-values'

contract(['IMPORT-003','IMPORT-004'],'consent encoding reuses bounded immutable components without repeated JSON escaping',()=>{
  const encoder=nativeValueStrings(),original=JSON.stringify,statements=Array.from({length:49},(_,q)=>String.fromCharCode(0x4e00+q).repeat(256)+'"\\\n😀')
  const expected=statements.map(statement=>[original({accepted:false,statement}),original({accepted:true,statement})])
  const spy=vi.spyOn(JSON,'stringify')
  try{
    for(let row=0;row<100;row++)for(const [q,statement] of statements.entries())expect(nativeAnswerString({accepted:row%2===1,statement},encoder,true)).toBe(expected[q][row%2])
    expect(spy).toHaveBeenCalledTimes(98)
  }finally{spy.mockRestore()}
})
contract(['IMPORT-003','IMPORT-004'],'native encoding observes mutations and preserves generic, accessor and custom JSON semantics',()=>{
  const encoder=nativeValueStrings(),value={accepted:true,statement:'First'}
  expect(nativeAnswerString(value,encoder,true)).toBe(JSON.stringify(value))
  value.accepted=false;value.statement='Changed'
  expect(nativeAnswerString(value,encoder,true)).toBe(JSON.stringify(value))
  const generic={nested:{answer:'before'}};expect(encoder(generic)).toBe(JSON.stringify(generic));generic.nested.answer='after';expect(encoder(generic)).toBe(JSON.stringify(generic))
  for(const other of [{statement:'Reordered',accepted:false},{accepted:true,statement:'Extra',extra:'retained'},{accepted:true,statement:'Custom',toJSON(){return {retained:'custom result'}}},[true,'array'],Object.assign(Object.create({toJSON(){return 'inherited'}}),value)])expect(nativeAnswerString(other,encoder,true)).toBe(JSON.stringify(other))
  let reads=0
  const accessor={get accepted(){reads++;return true},statement:'Accessor'}
  expect(nativeAnswerString(accessor,encoder,true)).toBe('{"accepted":true,"statement":"Accessor"}');expect(reads).toBe(1)
  expect(()=>encoder.consent!('true' as any,'Text')).toThrow('INVALID_CONSENT_COMPONENTS')
})
contract(['IMPORT-003','IMPORT-004'],'native component sharing retains its entry and byte ceilings',()=>{
  const encoder=nativeValueStrings(),spy=vi.spyOn(JSON,'stringify')
  try{
    encoder.consent!(true,'first')
    for(let i=0;i<4096;i++)encoder.consent!(true,'distinct '+i)
    spy.mockClear();encoder.consent!(true,'first');expect(spy).toHaveBeenCalledTimes(1)
    const huge='漢'.repeat(200000);spy.mockClear();encoder.consent!(false,huge);encoder.consent!(false,huge);expect(spy).toHaveBeenCalledTimes(2)
  }finally{spy.mockRestore()}
})

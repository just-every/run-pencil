import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { openCursor, sealCursor } from './cursor'
contract(['BASE-ACCESS-002','BASE-SECRET-001','RSLT-001'], 'report cursors encrypt stable identities and authenticate every payload byte',async()=> {
  const value={kind:'text',sessionId:'private-session-identity',workspaceId:'workspace',flowId:'flow',revisionId:'revision',questionId:'question',searchHash:'search',cutoff:'2024-01-01',generation:3,after:{id:'private-response-identity',time:'2023-01-01'}}
  const secret='synthetic-cursor-test-secret'
  const token=await sealCursor(value,secret)
  expect(await openCursor(token,secret)).toEqual(value)
  expect(await sealCursor(value,secret)).not.toBe(token)
  for(const segment of token.split('.').slice(1)) {
    const decoded=Buffer.from(segment,'base64url').toString('utf8')
    expect(decoded).not.toContain(value.sessionId);expect(decoded).not.toContain(value.after.id)
  }
  await expect(openCursor(token,'different-secret')).rejects.toThrow()
  const [version,nonce,ciphertext]=token.split('.')
  const changed=(ciphertext[0]==='A'?'B':'A')+ciphertext.slice(1)
  for(const invalid of [`${version}.${nonce}.${changed}`,`v2.${nonce}.${ciphertext}`,`v1.${nonce.slice(1)}.${ciphertext}`,'malformed']) await expect(openCursor(invalid,secret)).rejects.toThrow()
})

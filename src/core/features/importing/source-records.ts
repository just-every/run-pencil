import { canonicalHash } from '../../../base/import-kit/src/provenance/canonical-stream'
import type { ResponseStore } from './response-store'
import type { RejectedRows } from './row-errors'
import { type SourceRecord, type Json } from '../../../base/import-kit/src/d1/index'
/** Safe normalized payload strings keep review memory proportional to the
 * accepted input. Native table effects are expanded only by the bounded planner. */
export function sourceRecords(form: SourceRecord, responses: ResponseStore, rejected: RejectedRows, csvHash: string, hashPayload = canonicalHash, artifactName = 'responses.csv'): SourceRecord[] {
  const length = 1 + responses.length + rejected.length
  const at = (index: number): SourceRecord => {
    if (index === 0) return form
    const response = index <= responses.length, payload = (response ? responses.get(index - 1) : rejected.get(index - responses.length - 1)) as { row: number } & Json
    return { namespace: form.namespace, kind: response ? 'response' : 'rejected-row', sourceId: `${response ? 'row' : 'error'}-${payload.row}`, payload, payloadHash: hashPayload(payload), artifactHash: csvHash, location: { artifact: artifactName, row: payload.row } }
  }
  return new Proxy(new Array<SourceRecord>(length), {
    get(target, key, receiver) { if (typeof key === 'string' && /^(0|[1-9][0-9]*)$/.test(key)) return Number(key) < length ? at(Number(key)) : undefined; return Reflect.get(target,key,receiver) },
    has(target,key) { return typeof key === 'string' && /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < length || Reflect.has(target,key) },
  })
}

import { cloneJson } from '../../../base/import-kit/src/provenance/canonical-stream'

/** Copy every field exactly once, transforming only the named field. This
 * avoids keeping an unused deep copy of an encoded table beside native rows. */
export function copyWithField(value: any, field: string, transform: (value: any) => unknown): any {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('IMPORT_PLAN_CODEC_MISMATCH')
  const keys = Object.keys(value).sort()
  if (!keys.includes(field)) throw new Error('IMPORT_PLAN_CODEC_MISMATCH')
  const result: Record<string, unknown> = {}
  for (const key of keys) Object.defineProperty(result, key, { value: key === field ? transform(value[key]) : cloneJson(value[key]), enumerable: true, writable: true, configurable: true })
  return result
}

export function copyArray(value: any, transform: (value: any) => unknown): any[] {
  if (!Array.isArray(value)) throw new Error('IMPORT_PLAN_CODEC_MISMATCH')
  return Array.from({ length: value.length }, (_, index) => transform(value[index]))
}

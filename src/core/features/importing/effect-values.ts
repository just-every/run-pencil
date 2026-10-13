import { Buffer } from 'node:buffer'
export type NativeValueEncoder = ((value: unknown) => string) & { consent?: (accepted: boolean, statement: string) => string }
/** One bounded pool shares immutable strings. Generic objects are serialized
 * freshly; the explicit consent path accepts only validated scalar components. */
export function nativeValueStrings(): NativeValueEncoder {
  const values = new Map<string, string>(), consents = new Map<string, Map<boolean, string>>()
  let bytes = 0, entries = 0
  const admit = (size: number) => {
    if (entries >= 4096 || bytes + size > 1024 * 1024) { values.clear(); consents.clear(); bytes = 0; entries = 0 }
    if (size > 1024 * 1024) return false
    bytes += size; entries++; return true
  }
  const encode: NativeValueEncoder = (value: unknown): string => {
    const encoded = JSON.stringify(value)
    if (encoded === undefined) throw new Error('INVALID_JSON: native answers must be finite JSON')
    const prior = values.get(encoded)
    if (prior !== undefined) return prior
    if (admit(Buffer.byteLength(encoded))) values.set(encoded, encoded)
    return encoded
  }
  encode.consent = (accepted, statement) => {
    if (typeof accepted !== 'boolean' || typeof statement !== 'string') throw new Error('INVALID_CONSENT_COMPONENTS')
    const prior = consents.get(statement)?.get(accepted)
    if (prior !== undefined) return prior
    const encoded = JSON.stringify({ accepted, statement })
    // Charge the retained key as well as its encoded output, for each variant.
    if (admit(Buffer.byteLength(statement) + Buffer.byteLength(encoded))) {
      let pair = consents.get(statement)
      if (!pair) { pair = new Map(); consents.set(statement, pair) }
      pair.set(accepted, encoded)
    }
    return encoded
  }
  return encode
}

/** Source records supplied by planning are fresh validated JSON containers. Keep
 * generic, accessor, extra-field and custom serialization behavior unchanged. */
export function nativeAnswerString(value: unknown, encoder: NativeValueEncoder, consent: boolean): string {
  if (consent && encoder.consent && value && typeof value === 'object' && !Array.isArray(value) && !('toJSON' in value)) {
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Object.keys(value)
    const accepted = descriptors.accepted, statement = descriptors.statement
    if (keys.length === 2 && keys[0] === 'accepted' && keys[1] === 'statement' && accepted && statement && 'value' in accepted && 'value' in statement && typeof accepted.value === 'boolean' && typeof statement.value === 'string') return encoder.consent(accepted.value, statement.value)
  }
  return encoder(value)
}

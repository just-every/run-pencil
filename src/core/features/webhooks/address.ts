import { ValidationError } from '../../shared/errors'
import { loopbackHosts } from '../../platform/config/task-destination'

const privateHost = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.|\[?(?:::1|fc|fd|fe80))/i

/** HTTPS only; plain http only on a loopback address in local development and tests. No credentials, query or fragment, and no private address in production. */
export function validateEndpointAddress(value: string, allowLoopbackHttp: boolean) {
  const url = new URL(value)
  const loopback = loopbackHosts.has(url.hostname)
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(allowLoopbackHttp && loopback && url.protocol === 'http:'))) {
    throw new ValidationError('Use an HTTPS address without credentials, query or fragment. Local development also accepts a loopback HTTP address.')
  }
  if (loopback ? !allowLoopbackHttp : privateHost.test(url.hostname)) throw new ValidationError('Use a public HTTPS address. Private and loopback addresses are refused.')
  return url
}

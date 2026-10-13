import { test } from './fixtures'

export function contract(id: string | string[], name: string, body: Parameters<typeof test>[2]) {
  test(`[${Array.isArray(id) ? id.join(',') : id}] ${name}`, body)
}

import { test } from './fixtures'

export function contract(id: string | string[], name: string, body: Parameters<typeof test>[1]) {
  test(`[${Array.isArray(id) ? id.join(',') : id}] ${name}`, body)
}

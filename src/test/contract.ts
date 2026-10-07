import { test } from 'vitest'

type ContractBody = () => void | Promise<void>

export const contract = Object.assign(
  (id: string | string[], name: string, body: ContractBody, timeout?: number) => test(`[${Array.isArray(id) ? id.join(',') : id}] ${name}`, body, timeout),
  { todo: (id: string, name: string) => test.todo(`[${id}] ${name}`) },
)

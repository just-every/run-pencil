import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function devKeyHeaders(root = process.cwd()) {
  const key = /^RER_DEV_KEY=(\S+)$/m.exec(readFileSync(join(root, '.rer/local/dev-key.env'), 'utf8'))?.[1]
  if (!key) throw new Error('This checkout has no dev key. Run rer setup first.')
  return { 'x-rer-dev-key': key }
}

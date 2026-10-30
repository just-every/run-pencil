// Every string and command on Pencil's Run page (run-pencil.com/run), from Base's RunData.
import type { RunData } from '../base/run-site'
import { runPricing } from '../base/run-pricing'

export const run: RunData = {
  name: 'Pencil',
  repository: 'https://github.com/just-every/run-pencil',
  clone: 'npx -y @runeditrun/rer dev just-every/run-pencil',
  licence: 'MIT',
  docs: true,
  paths: { product: null },
  pricing: runPricing,
}

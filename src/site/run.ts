// Every string and command on Pencil's Run page (run-pencil.com/run), from Base's RunData.
import type { RunData } from '../base/run-site'

export const run: RunData = {
  name: 'Pencil',
  repository: 'https://github.com/just-every/run-pencil',
  clone: 'git clone https://github.com/just-every/run-pencil.git pencil',
  folder: 'pencil',
  requirements: 'Needs Node 22 or later and pnpm 10.12.4, on macOS, Linux or Windows with WSL2.',
  licence: 'MIT',
  docs: true,
  hosted: [],
}

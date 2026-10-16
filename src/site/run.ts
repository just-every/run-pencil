// Every string and command on Pencil's Run page (run-pencil.com/run), from Base's RunData.
import type { RunData } from '../base/run-site'

export const run: RunData = {
  name: 'Pencil',
  repository: 'https://github.com/just-every/run-pencil',
  clone: 'npx -y @runeditrun/rer dev just-every/run-pencil',
  folder: 'run-pencil',
  requirements: 'Works on macOS, Linux or Windows with WSL2. rer installs the pinned Node and pnpm for you. Local rer setup is optional.',
  licence: 'MIT',
  docs: true,
  hosted: [{
    title: 'Host Pencil on your own account',
    body: 'Set OWNER_EMAIL at deploy, using the hosting guide’s mapping to Pencil’s owner binding. rer claims the hosted owner automatically; sign in by email, with no manual setup-token step.',
    href: 'https://run-pencil.com/docs/hosting',
    action: 'Read the hosting guide',
  }],
}

import type { DevPersona } from '../../../base/operator-auth/dev/index.mjs'

// Local dev personas: real operators at <as>@dev.localhost, created only by local dev sign-in and suspended in exports.
// Pencil's operators are one kind: the setup owner (the identity `rer setup` claimed) and the colleagues the owner invites.
// `operator` is an invited colleague, so it can use every operator page but is not the protected setup operator.
// Respondents have no accounts. Only src/server.dev.ts uses this file.
export function devPersonas(): DevPersona[] {
  return [{ as: 'operator', role: 'admin', displayName: 'Dev operator' }]
}

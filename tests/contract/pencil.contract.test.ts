import { describe } from 'vitest'
import { contract } from '../../src/test/contract'

describe('Pencil contract implementation', () => {
  contract.todo('ANLY-001', 'Analysis run')
  contract.todo('ANLY-002', 'Fixed evidence set')
  contract.todo('ANLY-003', 'Findings')
  contract.todo('ANLY-004', 'Exact evidence')
  contract.todo('ANLY-005', 'Disclosure threshold')
  contract.todo('ANLY-006', 'Recommendations')
  contract.todo('ANLY-007', 'Staleness')
  contract.todo('ANLY-008', 'Provider failure')
  contract.todo('ANLY-009', 'Builder assistance')
  contract.todo('ANLY-010', 'Cost')
  contract.todo('ANLY-011', 'Evidence provenance')
  contract.todo('ANLY-012', 'Output validation')
  contract.todo('ANLY-013', 'Insufficient evidence')
  contract.todo('ANLY-014', 'Untrusted evidence')
  contract.todo('ANLY-015', 'Analysis policy snapshot')
  contract.todo('ANLY-016', 'Provider retry')
  contract.todo('NOTIFY-001', 'Analysis attention')
  contract.todo('NOTIFY-003', 'Digest')
})

// Active requirements now execute in the unit/Worker/native evidence registry.
// See docs/FIRST-RELEASE.md. The deferred ANLY family and two named notification clauses remain unsatisfied in full mode.

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { contract } from './contract'
import { flow, renderOperator } from './ui-fixtures'
import { FlowCard } from '../core/features/dashboard/ui/FlowCard'
beforeEach(() => vi.spyOn(window, 'scrollTo').mockImplementation(() => {}))
afterEach(() => { cleanup(); vi.restoreAllMocks() })
contract('DASH-002', 'dashboard names anonymous starts and explicit invited denominators without inventing percentages for zero eligible participants', async () => {
  for (const [audience, text] of [
    [{ launchedParticipants: 0, eligibleParticipants: 0, completedParticipants: 0 }, 'Audience: Anonymous public link'],
    [{ launchedParticipants: 4, eligibleParticipants: 0, completedParticipants: 0 }, 'Audience: 0 / 0 eligible participants'],
    [{ launchedParticipants: 4, eligibleParticipants: 3, completedParticipants: 2 }, 'Audience: 2 / 3 eligible participants completed'],
  ] as const) {
    const rendered = renderOperator(<FlowCard flow={{ ...flow, audience }} timeZone="UTC" />, '/app')
    await screen.findByText(new RegExp(text))
    expect(screen.getByText('1 completed · 2 starts')).toBeVisible()
    expect(screen.queryByText(/%/)).toBeNull()
    expect(screen.getByText(/Analysis: unconfigured/)).toBeVisible()
    rendered.dispose()
  }
})

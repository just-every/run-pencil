// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, vi } from 'vitest'
import { contract } from './contract'
import { TimeZoneField, canonicalTimeZone } from '../core/features/workspace/ui/TimeZoneField'
afterEach(() => { cleanup(); vi.restoreAllMocks() })
contract(['WS-001'], 'city search chooses the canonical workspace time zone and refuses invented zones', async () => {
  const change = vi.fn()
  render(<TimeZoneField value="brisbane" disabled={false} onChange={change} />)
  fireEvent.focus(screen.getByLabelText('Time zone'))
  fireEvent.click(screen.getByRole('button', { name: 'Australia/Brisbane' }))
  await waitFor(() => expect(change).toHaveBeenCalledWith('Australia/Brisbane'))
  expect(canonicalTimeZone('australia/brisbane')).toBe('Australia/Brisbane')
  expect(canonicalTimeZone('invented-place')).toBeUndefined()
})

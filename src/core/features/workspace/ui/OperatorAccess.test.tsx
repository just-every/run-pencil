// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { UnsavedChangesProvider } from '../../../shared/ui/UnsavedChanges'
import { OperatorAccess } from './OperatorAccess'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test('an invitation needing email proof retains its draft and can be sent after sign-in in another tab', async () => {
  const owner = { id: 'owner', email: 'owner@example.test', displayName: 'Owner', isSetupOperator: true, createdAt: new Date().toISOString() }
  const colleague = { id: 'colleague', email: 'colleague@example.test', displayName: 'Colleague', isSetupOperator: false, createdAt: owner.createdAt }
  let emailConfirmed = false
  const submitted: unknown[] = []
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url !== '/api/app/operators') throw new Error(`Unexpected request: ${url}`)
    if (init?.method === 'POST') {
      submitted.push(JSON.parse(String(init.body)))
      return emailConfirmed ? Response.json({ id: colleague.id }, { status: 201 }) : Response.json({ error: 'step_up_required' }, { status: 403 })
    }
    return Response.json([owner, colleague])
  })
  const routeTree = createRootRoute({ component: () => <UnsavedChangesProvider><OperatorAccess initialOperators={[owner]} operatorId={owner.id} /></UnsavedChangesProvider> })
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }), scrollRestoration: () => false })
  render(<RouterProvider router={router} />)
  fireEvent.change(await screen.findByLabelText('Name'), { target: { value: colleague.displayName } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: colleague.email } })
  fireEvent.click(screen.getByRole('button', { name: 'Invite operator' }))
  const signIn = await screen.findByRole('link', { name: /sign in again/i })
  expect(signIn).toHaveAttribute('href', '/signin')
  expect(signIn).toHaveAttribute('target', '_blank')
  expect(screen.getByRole('alert')).toBeVisible()
  expect(screen.getByLabelText('Name')).toHaveValue(colleague.displayName)
  expect(screen.getByLabelText('Email')).toHaveValue(colleague.email)
  // The Worker journey proves the real confirmation; this network boundary
  // proves that returning to the retained form sends the same invitation.
  emailConfirmed = true
  fireEvent.click(screen.getByRole('button', { name: 'Invite operator' }))
  await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(''))
  expect(submitted).toEqual(Array(2).fill({ email: colleague.email, displayName: colleague.displayName }))
  expect(await screen.findByRole('article', { name: colleague.email })).toBeVisible()
  expect(screen.queryByRole('link', { name: /sign in again/i })).not.toBeInTheDocument()
})

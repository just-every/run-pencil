import { createBrowserHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { BuilderDraft, DashboardFlow, FlowResults, Ledger, WorkspaceSettings } from '../core/app/api'
import type { PublicSeedConfig } from '../core/shared/config'
import { UnsavedChangesProvider } from '../core/shared/ui/UnsavedChanges'
import { OperatorShellPage } from '../core/features/shell/ui/OperatorShellPage'

export const config: PublicSeedConfig = {
  organizationName: 'Review workspace', productName: 'Pencil', publicFlowSlug: 'review', publicFlowBusinessName: 'Review business',
  publicFlowPurpose: 'Improve the next visit.', publicFlowTheme: { accent: '#4f6b3a', background: '#fbfaf6', surface: '#ffffff', text: '#1e2124' }, showPoweredByCredit: false,
}
export const workspace: WorkspaceSettings = { id: 'workspace', name: 'Review workspace', timeZone: 'Australia/Brisbane', sendingWindowStart: '09:00', sendingWindowEnd: '17:00', reminderDelayHours: 48, embedAllowedOrigins: [] }
export const flow: DashboardFlow = { id: 'flow', title: 'Visit review', slug: 'review', status: 'open', draftVersion: 1, lastActivityAt: '2026-10-02T00:00:00.000Z', completedResponses: 1, starts: 2, audience: { launchedParticipants: 0, eligibleParticipants: 0 }, analysisStatus: 'unconfigured' }
export const draft: BuilderDraft = {
  flow: { ...flow }, revision: { id: 'revision', number: 1, publishedAt: null, deadlineAt: null, targetCompletedResponses: null },
  steps: [
    { id: 'question', position: 0, kind: 'question', questionType: 'long_text', prompt: 'How can we improve?', helperText: null, required: true, nextStepId: 'completion', questionSettings: null },
    { id: 'completion', position: 1, kind: 'completion', questionType: null, prompt: 'Thank you', helperText: null, required: false, nextStepId: null, questionSettings: null },
  ], choices: [], branchRules: [],
}
export const results: FlowResults = { flow, revision: { ...draft.revision, publishedAt: '2026-10-02T00:00:00.000Z' }, starts: 2, completedResponses: 1, liveCompletedResponses: 1, importedResponses: 0, completionRate: .5, averageCompletionMilliseconds: 3000, deviceStarts: { mobile: 1, tablet: 0, desktop: 1 }, analysis: { status: 'unconfigured', configuration: '' } }
export const ledger: Ledger = { flow, cutoff: '2026-10-02T00:00:00.000Z', filter: {}, revisions: [{ id: 'revision', number: 1, isCurrent: 1 }], total: 0, responses: [] }

/** Client unit harness only: no runtime session, cookie or external browser. */
export function renderOperator(page: ReactNode, path: string, shell = false) {
  window.history.replaceState({}, '', path)
  const history = createBrowserHistory()
  const root = createRootRoute({ component: () => <UnsavedChangesProvider>{shell ? <OperatorShellPage config={config} editorEnabled={false} /> : <Outlet />}</UnsavedChangesProvider> })
  const routes = ['/app', '/app/settings', '/app/flows/$flowId/builder', '/app/flows/$flowId/results', '/signin'].map((routePath) => createRoute({
    getParentRoute: () => root, path: routePath,
    component: () => routePath === path || routePath.replace('$flowId', 'flow') === path ? page : <h1>Destination {routePath}</h1>,
  }))
  const router = createRouter({ routeTree: root.addChildren(routes), history, defaultPendingMinMs: 0 })
  const rendered = render(<RouterProvider router={router} />)
  return { router, ...rendered, dispose() { rendered.unmount(); history.destroy() } }
}

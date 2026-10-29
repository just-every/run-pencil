import { createFileRoute } from '@tanstack/react-router'
import { loadPublicConfig, requireOperator } from '../core/app/loaders'
import { UnsavedChangesProvider } from '../core/shared/ui/UnsavedChanges'
import { OperatorShellPage } from '../core/features/shell/ui/OperatorShellPage'
import { LoadProblem } from '../core/app/ui/LoadProblem'
export const Route = createFileRoute('/app')({ beforeLoad: () => requireOperator(), loader: () => loadPublicConfig(), component: Page, notFoundComponent: () => <LoadProblem message="Page not found" /> })
function Page() { const { editorEnabled } = Route.useRouteContext(); return <UnsavedChangesProvider><OperatorShellPage config={Route.useLoaderData()} editorEnabled={editorEnabled} /></UnsavedChangesProvider> }

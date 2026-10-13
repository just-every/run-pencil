import { createFileRoute } from '@tanstack/react-router'
import { loadPublicConfig, requireOperator } from '../core/app/loaders'
import { UnsavedChangesProvider } from '../core/shared/ui/UnsavedChanges'
import { OperatorShellPage } from '../core/features/shell/ui/OperatorShellPage'
export const Route = createFileRoute('/app')({ beforeLoad: () => requireOperator(), loader: () => loadPublicConfig(), component: Page })
function Page() { const { editorEnabled } = Route.useRouteContext(); return <UnsavedChangesProvider><OperatorShellPage config={Route.useLoaderData()} editorEnabled={editorEnabled} /></UnsavedChangesProvider> }

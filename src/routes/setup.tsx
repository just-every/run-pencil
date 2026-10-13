import { createFileRoute } from '@tanstack/react-router'
import { loadSetup } from '../core/app/loaders'
import { SetupPage } from '../core/features/workspace/ui/SetupPage'
export const Route = createFileRoute('/setup')({ loader: () => loadSetup(), component: Page })
function Page() { return <SetupPage {...Route.useLoaderData()} /> }
